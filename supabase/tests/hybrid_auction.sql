begin;

insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');

insert into public.sellers (id, display_name, status, terms_version, terms_accepted_at)
values ('20000000-0000-4000-8000-000000000001', 'Test Artist', 'active', 'terms-v1', now());

insert into public.curators (id, provider, provider_subject, display_name)
values ('10000000-0000-4000-8000-000000000001', 'x', 'subject-one', 'Curator');

insert into public.nft_collections (
  id, standard, contract_address, deployed_code_hash, inventory_safe, deployment_tx_hash,
  deployment_block, contract_version, state
) values (
  '30000000-0000-4000-8000-000000000001', 'ERC721',
  '0x1111111111111111111111111111111111111111',
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '0x2222222222222222222222222222222222222222',
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  100, '1.0.0', 'active'
);

insert into public.works (
  id, slug, curator_id, seller_id, artist_name, title, format, media_url, status,
  contract_status, nft_collection_id, nft_work_id, nft_token_id, nft_quantity,
  nft_custody_state, nft_mint_tx_hash, nft_mint_block, nft_finalized_at
) values (
  '40000000-0000-4000-8000-000000000001', 'auction-work',
  '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  'Test Artist', 'Auction Work', 'paired', 'https://example.test/work.jpg', 'listed',
  'minted', '30000000-0000-4000-8000-000000000001',
  '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 7, 1,
  'inventory-safe',
  '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  101, now()
);

insert into public.smart_accounts (
  id, user_id, account_address, safe_version, module_version, entry_point_address,
  factory_address, code_hash, signer_count, threshold, recovery_ready, state, deployment_block, finalized_at
) values (
  '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '0x3333333333333333333333333333333333333333', '1.4.1', '0.3.0',
  '0x4444444444444444444444444444444444444444',
  '0x5555555555555555555555555555555555555555',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  2, 1, true, 'recovery-ready', 102, now()
);

insert into public.wallet_credentials (
  smart_account_id, credential_commitment, owner_address, purpose
) values
  ('50000000-0000-4000-8000-000000000001',
   '0x9191919191919191919191919191919191919191919191919191919191919191',
   '0x6666666666666666666666666666666666666666', 'owner'),
  ('50000000-0000-4000-8000-000000000001',
   '0x9292929292929292929292929292929292929292929292929292929292929292',
   '0x7777777777777777777777777777777777777777', 'recovery');

insert into public.wallet_link_challenges (
  id, user_id, smart_account_id, challenge_hash, origin_hash, expires_at
) values (
  '51000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000001',
  '0x1111111111111111111111111111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222222222222222222222222222',
  now() + interval '5 minutes'
);

select public.finalize_wallet_link(
  '51000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000001',
  '0x1111111111111111111111111111111111111111111111111111111111111111',
  '0x3333333333333333333333333333333333333333333333333333333333333333',
  103
);

do $$
begin
  if (select count(*) from public.wallet_links) <> 1 then raise exception 'wallet link was not recorded'; end if;
  begin
    perform public.finalize_wallet_link(
      '51000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000001',
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0x3333333333333333333333333333333333333333333333333333333333333333',
      103
    );
    raise exception 'wallet challenge was replayed';
  exception when others then
    if sqlerrm <> 'wallet_challenge_invalid' then raise; end if;
  end;
end;
$$;

insert into public.auctions (
  id, work_id, settlement_rail, bid_currency, state, opens_at, closes_at, original_closes_at,
  reserve_amount, minimum_increment, maximum_card_bid_minor, terms_url, terms_version, terms_hash
) values (
  '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
  'card', 'USD', 'open', now() - interval '1 hour', now() + interval '1 minute', now() + interval '1 minute',
  10000, 500, 50000, 'https://example.test/terms', 'terms-v1',
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

insert into public.bidder_payment_mandates (
  id, auction_id, bidder_user_id, provider_customer_ref, setup_intent_ref, setup_session_ref, payment_method_ref,
  maximum_hammer_minor, mandate_terms_version, mandate_terms_hash, state, setup_usage,
  consent_session_completed_at, consent_terms_accepted_at, ready_at, expires_at
) values (
  '70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', 'cus_test', 'seti_test', 'cs_test', 'pm_test', 50000,
  'terms-v1', '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'ready', 'off_session', now(), now(), now(), now() + interval '1 day'
);

select public.place_verified_auction_bid(
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  10000, 'USD', 1,
  '0x1212121212121212121212121212121212121212121212121212121212121212',
  decode('01', 'hex'), 103, now() - interval '1 minute', now() + interval '1 day',
  '0x3434343434343434343434343434343434343434343434343434343434343434',
  'bid-request-0000000000000001'
);

do $$
declare
  first_bid uuid;
  replay_bid uuid;
begin
  select id into first_bid from public.auction_bids where intent_nonce = 1;
  select id into replay_bid from public.place_verified_auction_bid(
    '60000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    10000, 'USD', 1,
    '0x1212121212121212121212121212121212121212121212121212121212121212',
    decode('01', 'hex'), 103, now() - interval '1 minute', now() + interval '1 day',
    '0x3434343434343434343434343434343434343434343434343434343434343434',
    'bid-request-0000000000000001'
  );
  if replay_bid <> first_bid then raise exception 'idempotent replay created another bid'; end if;
  if (select count(*) from public.auction_bids) <> 1 then raise exception 'unexpected bid count'; end if;
  if (select high_bid_id from public.auctions where id = '60000000-0000-4000-8000-000000000001') <> first_bid then
    raise exception 'high bid not assigned';
  end if;
  if (select extension_count from public.auctions where id = '60000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'anti-snipe extension not applied';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.place_verified_auction_bid(
      '60000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000001',
      10200, 'USD', 2,
      '0x1313131313131313131313131313131313131313131313131313131313131313',
      decode('02', 'hex'), 104, now() - interval '1 minute', now() + interval '1 day',
      '0x3434343434343434343434343434343434343434343434343434343434343434',
      'bid-request-0000000000000002'
    );
    raise exception 'too-low bid was accepted';
  exception when others then
    if sqlerrm <> 'bid_too_low' then raise; end if;
  end;
end;
$$;

update public.auctions set closes_at = now() - interval '1 second'
where id = '60000000-0000-4000-8000-000000000001';

select public.close_auction(
  '60000000-0000-4000-8000-000000000001',
  (select high_bid_id from public.auctions where id = '60000000-0000-4000-8000-000000000001'),
  '0x1212121212121212121212121212121212121212121212121212121212121212',
  105, 105, '0x4545454545454545454545454545454545454545454545454545454545454545'
);
select public.close_auction(
  '60000000-0000-4000-8000-000000000001', null, null, null,
  105, '0x4545454545454545454545454545454545454545454545454545454545454545'
);

do $$
begin
  if (select count(*) from public.auction_settlements) <> 1 then raise exception 'settlement is not idempotent'; end if;
  if (select state from public.auctions where id = '60000000-0000-4000-8000-000000000001') <> 'winner-selected' then
    raise exception 'auction did not select winner';
  end if;
  if (select state from public.auction_bids where intent_nonce = 1) <> 'won' then raise exception 'bid did not win'; end if;
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'bidder_payment_mandates'
      and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then raise exception 'browser can mutate payment mandates'; end if;
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name in ('public_auctions', 'public_auction_bids')
      and grantee in ('PUBLIC', 'anon', 'authenticated') and privilege_type = 'SELECT'
  ) then raise exception 'disabled auction projections are browser-readable'; end if;
end;
$$;

update public.auction_settlements
set total_amount = 10000, risk_hold_until = now() + interval '7 days'
where auction_id = '60000000-0000-4000-8000-000000000001';

select public.register_auction_payment_attempt(
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_current', 10000, 'off-session'
);

do $$
begin
  begin
    perform public.register_auction_payment_attempt(
      (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
      'pi_concurrent', 10000, 'off-session'
    );
    raise exception 'concurrent payment intent replaced the bound attempt';
  exception when others then
    if sqlerrm <> 'payment_attempt_already_bound' then raise; end if;
  end;
end;
$$;

select public.apply_stripe_auction_payment_event(
  'evt_failed', 'payment_intent.payment_failed',
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_current', 'pi_current', 'requires_payment_method', 10000, 'usd', '{}'::jsonb
);

do $$
begin
  begin
    perform public.replace_auction_payment_attempt(
      (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
      'pi_current', 'pi_cure', 10000, 'interactive-cure'
    );
    raise exception 'non-canceled payment intent was replaced';
  exception when others then
    if sqlerrm <> 'prior_payment_not_replaceable' then raise; end if;
  end;
end;
$$;

select public.apply_stripe_auction_payment_event(
  'evt_canceled', 'payment_intent.canceled',
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_current', 'pi_current', 'canceled', 10000, 'usd', '{}'::jsonb
);
select public.replace_auction_payment_attempt(
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_current', 'pi_cure', 10000, 'interactive-cure'
);

do $$
begin
  begin
    perform public.apply_stripe_auction_payment_event(
      'evt_old_succeeded', 'payment_intent.succeeded',
      (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
      'pi_current', 'pi_current', 'succeeded', 10000, 'usd', '{}'::jsonb
    );
    raise exception 'superseded payment intent mutated settlement';
  exception when others then
    if sqlerrm <> 'payment_intent_not_current' then raise; end if;
  end;
end;
$$;

select public.apply_stripe_auction_payment_event(
  'evt_succeeded', 'payment_intent.succeeded',
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_cure', 'pi_cure', 'succeeded', 10000, 'usd', '{}'::jsonb
);
select public.apply_stripe_auction_payment_event(
  'evt_late_processing', 'payment_intent.processing',
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_cure', 'pi_cure', 'processing', 10000, 'usd', '{}'::jsonb
);
select public.apply_stripe_auction_payment_event(
  'evt_refund_partial', 'refund.updated',
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_cure', 're_partial', 'succeeded', 2500, 'usd', '{}'::jsonb
);
select public.apply_stripe_auction_payment_event(
  'evt_refund_stale_failure', 'refund.failed',
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_cure', 're_partial', 'failed', 2500, 'usd', '{}'::jsonb
);

do $$
begin
  if (select state from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001') <> 'partially-refunded' then
    raise exception 'payment state regressed after stale event';
  end if;
  if (select status from public.auction_payment_ledger_entries where provider_object_id = 're_partial') <> 'succeeded' then
    raise exception 'refund ledger regressed after stale event';
  end if;
  begin
    perform public.apply_stripe_auction_payment_event(
      'evt_wrong_intent', 'payment_intent.succeeded',
      (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
      'pi_wrong', 'pi_wrong', 'succeeded', 10000, 'usd', '{}'::jsonb
    );
    raise exception 'unbound payment intent was accepted';
  exception when others then
    if sqlerrm <> 'payment_intent_not_current' then raise; end if;
  end;
end;
$$;

select public.apply_stripe_auction_payment_event(
  'evt_dispute_lost', 'charge.dispute.lost',
  (select id from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001'),
  'pi_cure', 'dp_lost', 'lost', 10000, 'usd', '{}'::jsonb
);

do $$
begin
  if (select state from public.auction_settlements where auction_id = '60000000-0000-4000-8000-000000000001') <> 'exception' then
    raise exception 'lost dispute did not freeze release';
  end if;
end;
$$;

rollback;
