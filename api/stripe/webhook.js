import { createStripeClient, requireStripeWebhookConfig } from "../../lib/server/commerce.js";
import { ConfigurationError } from "../../lib/server/config.js";
import { json, problem } from "../../lib/server/http.js";
import { createSupabaseServiceClient } from "../../lib/server/supabase.js";

const acceptedEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.closed"
]);

const checkoutEvents = new Set([...acceptedEvents].filter((type) => type.startsWith("checkout.session.")));

const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : null;
const reference = (value) => typeof value === "string" ? value : value?.id || null;
export const effectiveDisputeEventType = (status) => ["won", "lost", "warning_closed", "prevented"].includes(status)
  ? "charge.dispute.closed"
  : "charge.dispute.created";

export const POST = async (request) => {
  try {
    const announcedLength = Number(request.headers.get("content-length") || 0);
    if (announcedLength > 512_000) return problem(413, "payload_too_large", "Webhook payload is too large.");

    const config = requireStripeWebhookConfig();
    const signature = request.headers.get("stripe-signature");
    if (!signature) return problem(400, "signature_missing", "Webhook signature is required.");
    const payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > 512_000) return problem(413, "payload_too_large", "Webhook payload is too large.");

    const stripe = createStripeClient(config);
    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, config.commerce.stripeWebhookSecret);
    } catch {
      return problem(400, "signature_invalid", "Webhook signature is invalid.");
    }

    if (!acceptedEvents.has(event.type)) return json({ received: true, ignored: true });
    if (!checkoutEvents.has(event.type)) {
      const announcedObject = event.data.object;
      const currentObject = event.type.startsWith("refund.")
        ? await stripe.refunds.retrieve(announcedObject.id)
        : await stripe.disputes.retrieve(announcedObject.id);
      let paymentIntentId = reference(currentObject.payment_intent);
      if (!paymentIntentId && currentObject.charge) {
        const charge = await stripe.charges.retrieve(reference(currentObject.charge));
        paymentIntentId = reference(charge.payment_intent);
      }
      if (!paymentIntentId) return problem(422, "payment_missing", "Webhook payment metadata is invalid.");
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const acquisitionId = uuid(paymentIntent.metadata?.grove_acquisition_id);
      if (!acquisitionId) return problem(422, "acquisition_missing", "Webhook acquisition metadata is invalid.");
      const effectiveType = event.type.startsWith("charge.dispute.")
        ? effectiveDisputeEventType(currentObject.status)
        : event.type;
      const service = createSupabaseServiceClient();
      const { data: result, error } = await service.rpc("apply_stripe_financial_event", {
        stripe_event_id: event.id,
        stripe_event_type: effectiveType,
        acquisition_uuid: acquisitionId,
        payment_intent_id: paymentIntentId,
        stripe_object_id: currentObject.id,
        object_status: currentObject.status || null,
        object_amount: currentObject.amount || 0,
        object_currency: currentObject.currency || paymentIntent.currency,
        event_payload: {
          id: event.id,
          type: event.type,
          effective_type: effectiveType,
          created: event.created,
          livemode: event.livemode,
          api_version: event.api_version || null,
          request_id: event.request?.id || null
        }
      });
      if (error) return problem(503, "webhook_processing_failed", "Webhook processing will be retried.");
      if (result === "retry") return problem(503, "webhook_dependency_pending", "Webhook processing will be retried.");
      return json({ received: true, result });
    }

    const announcedSession = event.data.object;
    const session = await stripe.checkout.sessions.retrieve(announcedSession.id);
    const acquisitionId = uuid(session.metadata?.grove_acquisition_id || session.client_reference_id);
    if (!acquisitionId) return problem(422, "acquisition_missing", "Webhook acquisition metadata is invalid.");

    const effectiveType = session.payment_status === "paid"
      ? "checkout.session.async_payment_succeeded"
      : session.status === "expired"
        ? "checkout.session.expired"
        : event.type;
    const service = createSupabaseServiceClient();
    const { data: result, error } = await service.rpc("apply_stripe_checkout_event", {
      stripe_event_id: event.id,
      stripe_event_type: effectiveType,
      acquisition_uuid: acquisitionId,
      checkout_session_id: session.id,
      payment_intent_id: reference(session.payment_intent),
      checkout_payment_status: session.payment_status,
      customer_email_address: session.customer_details?.email || null,
      checkout_amount_total: session.amount_total,
      checkout_amount_subtotal: session.amount_subtotal,
      checkout_amount_tax: session.total_details?.amount_tax || 0,
      checkout_amount_shipping: session.total_details?.amount_shipping || 0,
      checkout_currency: session.currency,
      checkout_mode: session.mode,
      automatic_tax_enabled: session.automatic_tax?.enabled === true,
      terms_acceptance_status: session.consent?.terms_of_service || null,
      event_payload: {
        id: event.id,
        type: event.type,
        effective_type: effectiveType,
        created: event.created,
        livemode: event.livemode,
        api_version: event.api_version || null,
        request_id: event.request?.id || null
      }
    });
    if (error) return problem(503, "webhook_processing_failed", "Webhook processing will be retried.");
    return json({ received: true, result });
  } catch (error) {
    if (error instanceof ConfigurationError) return problem(503, "acquisition_not_configured", "Checkout is not configured.");
    return problem(500, "unexpected_error", "Webhook processing failed.");
  }
};
