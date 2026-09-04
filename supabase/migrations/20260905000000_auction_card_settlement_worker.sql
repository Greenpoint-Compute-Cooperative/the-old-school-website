begin;

alter table public.auction_settlements
  add column tax_calculation_ref text unique
    check (tax_calculation_ref is null or tax_calculation_ref ~ '^taxcalc_[A-Za-z0-9_]+$'),
  add column cure_checkout_session_ref text unique
    check (cure_checkout_session_ref is null or cure_checkout_session_ref ~ '^cs_[A-Za-z0-9_]+$'),
  add column cure_prior_payment_intent_ref text
    check (cure_prior_payment_intent_ref is null or cure_prior_payment_intent_ref ~ '^pi_[A-Za-z0-9_]+$'),
  add column cure_state text check (cure_state is null or cure_state in ('open', 'completed', 'expired')),
  add column cure_expires_at timestamptz,
  add check (
    (cure_checkout_session_ref is null and cure_prior_payment_intent_ref is null and cure_state is null and cure_expires_at is null)
    or
    (cure_checkout_session_ref is not null and cure_prior_payment_intent_ref is not null and cure_state is not null and cure_expires_at is not null)
  );

-- Freeze the provider-calculated card total exactly once. Provider calls happen
-- before this RPC with a stable idempotency key; retries must present the same
-- calculation and amounts or fail closed.
create or replace function public.freeze_auction_settlement_total(
  settlement_uuid uuid,
  tax_calculation_id text,
  tax_amount_minor integer,
  shipping_amount_minor integer,
  risk_hold_until_at timestamptz
)
returns public.auction_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_settlement public.auction_settlements%rowtype;
begin
  select * into selected_settlement from public.auction_settlements where id = settlement_uuid for update;
  if not found or selected_settlement.rail <> 'card' or selected_settlement.currency <> 'USD' then
    raise exception 'settlement_mismatch';
  end if;
  if tax_calculation_id is null or tax_calculation_id !~ '^taxcalc_' then
    raise exception 'tax_calculation_invalid';
  end if;
  if tax_amount_minor < 0 or shipping_amount_minor < 0 or risk_hold_until_at is null then
    raise exception 'settlement_amount_invalid';
  end if;
  if selected_settlement.tax_calculation_ref is not null then
    if selected_settlement.tax_calculation_ref is distinct from tax_calculation_id
       or selected_settlement.tax_amount <> tax_amount_minor
       or selected_settlement.shipping_amount <> shipping_amount_minor
       or selected_settlement.total_amount <> selected_settlement.hammer_amount + tax_amount_minor + shipping_amount_minor
       or selected_settlement.risk_hold_until is distinct from risk_hold_until_at then
      raise exception 'settlement_total_already_frozen';
    end if;
    return selected_settlement;
  end if;
  if selected_settlement.state <> 'winner-selected' or selected_settlement.current_payment_intent_ref is not null then
    raise exception 'settlement_not_freezable';
  end if;
  update public.auction_settlements set
    tax_calculation_ref = tax_calculation_id,
    tax_amount = tax_amount_minor,
    shipping_amount = shipping_amount_minor,
    total_amount = hammer_amount + tax_amount_minor + shipping_amount_minor,
    risk_hold_until = risk_hold_until_at,
    state = 'tax-pending'
  where id = settlement_uuid
  returning * into selected_settlement;
  insert into public.auction_events (auction_id, event_type, actor_kind, event_data)
  values (selected_settlement.auction_id, 'settlement.total-frozen', 'system', jsonb_build_object(
    'settlement_id', settlement_uuid,
    'tax_calculation_id', tax_calculation_id,
    'tax_amount_minor', tax_amount_minor,
    'shipping_amount_minor', shipping_amount_minor,
    'total_amount_minor', selected_settlement.total_amount
  ));
  return selected_settlement;
end;
$$;

-- Record the retrieved-current result of the server's immediate Stripe call.
-- A direct observation can stop retries or expose a cure, but deliberately
-- cannot enter paid-risk-hold; only apply_stripe_auction_payment_event can.
create or replace function public.record_auction_payment_observation(
  settlement_uuid uuid,
  payment_intent_id text,
  object_status text,
  object_error_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_settlement public.auction_settlements%rowtype;
  selected_attempt public.payment_attempts%rowtype;
  next_attempt_state text;
  next_settlement_state text;
begin
  select * into selected_settlement from public.auction_settlements where id = settlement_uuid for update;
  if not found or selected_settlement.rail <> 'card'
     or selected_settlement.current_payment_intent_ref is distinct from payment_intent_id then
    raise exception 'payment_intent_not_current';
  end if;
  select * into selected_attempt from public.payment_attempts
  where settlement_id = settlement_uuid and payment_intent_ref = payment_intent_id for update;
  if not found or selected_attempt.generation <> selected_settlement.payment_generation then
    raise exception 'payment_attempt_mismatch';
  end if;
  if object_status not in ('requires_confirmation', 'requires_action', 'requires_payment_method', 'processing', 'succeeded', 'canceled') then
    raise exception 'payment_status_invalid';
  end if;
  if selected_settlement.state in ('paid-risk-hold', 'release-ready', 'nft-submitted', 'nft-finalized', 'fulfilled', 'partially-refunded', 'refunded', 'disputed-post-mint') then
    return selected_settlement.state;
  end if;

  next_attempt_state := case
    when object_status = 'requires_action' then 'requires-action'
    when object_status in ('requires_payment_method') then 'failed'
    when object_status = 'canceled' then 'canceled'
    when object_status in ('processing', 'succeeded') then 'processing'
    else 'created'
  end;
  next_settlement_state := case
    when object_status = 'requires_action' then 'requires-action'
    when object_status in ('requires_payment_method', 'canceled') then 'payment-failed'
    when object_status in ('processing', 'succeeded') then 'processing'
    else 'charge-pending'
  end;
  update public.payment_attempts set
    state = next_attempt_state,
    last_error_code = case when next_attempt_state in ('failed', 'canceled') then left(object_error_code, 120) else null end
  where id = selected_attempt.id;
  update public.auction_settlements set state = next_settlement_state where id = settlement_uuid;
  insert into public.auction_events (auction_id, event_type, actor_kind, event_data)
  values (selected_settlement.auction_id, 'settlement.provider-observed', 'system', jsonb_build_object(
    'settlement_id', settlement_uuid,
    'payment_intent_id', payment_intent_id,
    'provider_status', object_status,
    'settlement_state', next_settlement_state
  ));
  return next_settlement_state;
end;
$$;

create or replace function public.register_auction_payment_cure(
  settlement_uuid uuid,
  expected_payment_intent_id text,
  checkout_session_id text,
  expires_at_value timestamptz
)
returns public.auction_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_settlement public.auction_settlements%rowtype;
  selected_attempt public.payment_attempts%rowtype;
begin
  select * into selected_settlement from public.auction_settlements where id = settlement_uuid for update;
  if not found or selected_settlement.rail <> 'card' then raise exception 'settlement_mismatch'; end if;
  if checkout_session_id is null or checkout_session_id !~ '^cs_' or expires_at_value <= now() then
    raise exception 'cure_session_invalid';
  end if;
  if selected_settlement.cure_checkout_session_ref is not null then
    if selected_settlement.cure_checkout_session_ref is distinct from checkout_session_id
       or selected_settlement.cure_prior_payment_intent_ref is distinct from expected_payment_intent_id then
      raise exception 'cure_session_already_bound';
    end if;
    return selected_settlement;
  end if;
  if selected_settlement.state <> 'payment-failed'
     or selected_settlement.current_payment_intent_ref is distinct from expected_payment_intent_id then
    raise exception 'payment_not_curable';
  end if;
  select * into selected_attempt from public.payment_attempts
  where settlement_id = settlement_uuid and payment_intent_ref = expected_payment_intent_id for update;
  if not found or selected_attempt.state <> 'canceled'
     or selected_attempt.generation <> selected_settlement.payment_generation then
    raise exception 'payment_not_curable';
  end if;
  update public.auction_settlements set
    cure_checkout_session_ref = checkout_session_id,
    cure_prior_payment_intent_ref = expected_payment_intent_id,
    cure_state = 'open',
    cure_expires_at = expires_at_value
  where id = settlement_uuid
  returning * into selected_settlement;
  return selected_settlement;
end;
$$;

-- The signed Checkout webhook binds its newly-created PaymentIntent as the one
-- allowed replacement. This wrapper is retry-idempotent across a crash between
-- binding and applying the same signed provider event.
create or replace function public.bind_auction_payment_cure(
  settlement_uuid uuid,
  checkout_session_id text,
  replacement_payment_intent_id text,
  expected_amount integer
)
returns public.payment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_settlement public.auction_settlements%rowtype;
  prior_attempt public.payment_attempts%rowtype;
  result public.payment_attempts%rowtype;
  next_generation integer;
begin
  select * into selected_settlement from public.auction_settlements where id = settlement_uuid for update;
  if not found or selected_settlement.rail <> 'card'
     or selected_settlement.cure_checkout_session_ref is distinct from checkout_session_id then
    raise exception 'cure_session_mismatch';
  end if;
  if replacement_payment_intent_id is null or replacement_payment_intent_id !~ '^pi_'
     or replacement_payment_intent_id = selected_settlement.cure_prior_payment_intent_ref
     or expected_amount < 50 or selected_settlement.total_amount <> expected_amount then
    raise exception 'cure_payment_invalid';
  end if;
  if selected_settlement.current_payment_intent_ref = replacement_payment_intent_id
     and selected_settlement.cure_state = 'completed' then
    select * into result from public.payment_attempts
    where settlement_id = settlement_uuid and payment_intent_ref = replacement_payment_intent_id;
    if not found then raise exception 'payment_attempt_mismatch'; end if;
    return result;
  end if;
  if selected_settlement.cure_state <> 'open' or selected_settlement.state <> 'payment-failed'
     or selected_settlement.current_payment_intent_ref is distinct from selected_settlement.cure_prior_payment_intent_ref then
    raise exception 'cure_not_bindable';
  end if;
  select * into prior_attempt from public.payment_attempts
  where settlement_id = settlement_uuid and payment_intent_ref = selected_settlement.cure_prior_payment_intent_ref for update;
  if not found or prior_attempt.state <> 'canceled'
     or prior_attempt.generation <> selected_settlement.payment_generation then
    raise exception 'prior_payment_not_replaceable';
  end if;
  next_generation := selected_settlement.payment_generation + 1;
  insert into public.payment_attempts (
    settlement_id, payment_intent_ref, generation, attempt_kind, amount_minor, state
  ) values (
    settlement_uuid, replacement_payment_intent_id, next_generation, 'interactive-cure', expected_amount, 'created'
  ) returning * into result;
  update public.auction_settlements set
    current_payment_intent_ref = replacement_payment_intent_id,
    payment_generation = next_generation,
    state = 'charge-pending',
    cure_state = 'completed'
  where id = settlement_uuid;
  return result;
end;
$$;

create or replace function public.expire_auction_payment_cure(
  stripe_event_id text,
  settlement_uuid uuid,
  checkout_session_id text,
  event_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_settlement public.auction_settlements%rowtype;
begin
  insert into public.provider_events (provider, event_id, event_type, auction_id, settlement_id, payload)
  select 'stripe', stripe_event_id, 'checkout.session.expired', s.auction_id, s.id, event_payload
  from public.auction_settlements s where s.id = settlement_uuid
  on conflict (provider, event_id) do nothing;
  if not found then return 'duplicate'; end if;
  select * into selected_settlement from public.auction_settlements where id = settlement_uuid for update;
  if not found or selected_settlement.cure_checkout_session_ref is distinct from checkout_session_id then
    raise exception 'cure_session_mismatch';
  end if;
  if selected_settlement.cure_state = 'open' then
    update public.auction_settlements set cure_state = 'expired' where id = settlement_uuid;
  end if;
  update public.provider_events set processed_at = now() where provider = 'stripe' and event_id = stripe_event_id;
  return 'expired';
end;
$$;

revoke all on function public.freeze_auction_settlement_total(uuid, text, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.record_auction_payment_observation(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.register_auction_payment_cure(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.bind_auction_payment_cure(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.expire_auction_payment_cure(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.freeze_auction_settlement_total(uuid, text, integer, integer, timestamptz) to service_role;
grant execute on function public.record_auction_payment_observation(uuid, text, text, text) to service_role;
grant execute on function public.register_auction_payment_cure(uuid, text, text, timestamptz) to service_role;
grant execute on function public.bind_auction_payment_cure(uuid, text, text, integer) to service_role;
grant execute on function public.expire_auction_payment_cure(text, uuid, text, jsonb) to service_role;

commit;
