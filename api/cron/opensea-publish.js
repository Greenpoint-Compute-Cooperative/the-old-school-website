import { timingSafeEqual } from "node:crypto";
import { ConfigurationError, getRuntimeConfig } from "../../lib/server/config.js";
import { json, problem } from "../../lib/server/http.js";
import { publishOpenSeaListing } from "../../lib/server/resale.js";
import { createSupabaseServiceClient } from "../../lib/server/supabase.js";

const authorized = (request, expected) => {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
};

const providerError = (error) => ({
  code: String(error?.status || error?.code || error?.name || "opensea_error").slice(0, 120),
  detail: String(error?.message || "OpenSea publication failed.").slice(0, 1_000)
});

export const GET = async (request) => {
  const config = getRuntimeConfig();
  if (!config.cronSecret || !authorized(request, config.cronSecret)) {
    return problem(401, "not_authorized", "Cron authorization is required.");
  }
  if (!config.productionDeployment) return problem(409, "wrong_environment", "OpenSea publication runs only in Production.");
  try {
    if (!config.openSea.liveReady) throw new ConfigurationError("OpenSea publication is not ready.");
    const service = createSupabaseServiceClient();
    const now = new Date();
    const { data: publications, error } = await service.from("resale_order_publications")
      .select("id,resale_order_id,state,attempt_count,next_attempt_at")
      .in("state", ["pending", "retry"]).order("created_at", { ascending: true }).limit(10);
    if (error) return problem(503, "publication_queue_unavailable", "The OpenSea publication queue could not be loaded.");
    const summary = { published: 0, retry: 0, failed: 0, skipped: 0 };
    for (const publication of publications) {
      if (publication.next_attempt_at && new Date(publication.next_attempt_at) > now) {
        summary.skipped += 1;
        continue;
      }
      const { data: order, error: orderError } = await service.from("resale_orders")
        .select("id,order_hash,order_components,signature,state,end_time_epoch")
        .eq("id", publication.resale_order_id).maybeSingle();
      if (orderError || !order || order.state !== "open" || BigInt(order.end_time_epoch) <= BigInt(Math.floor(Date.now() / 1_000))) {
        const attempt = Number(publication.attempt_count) + 1;
        await service.from("resale_order_publications").update({
          state: "failed", attempt_count: attempt, last_attempt_at: now.toISOString(), next_attempt_at: null,
          last_error_code: "listing_not_open", last_error_detail: "Local listing is missing, closed, or expired."
        }).eq("id", publication.id);
        summary.failed += 1;
        continue;
      }
      try {
        const signature = `0x${order.signature.slice(2)}`;
        const result = await publishOpenSeaListing({ config, order: order.order_components, signature });
        const providerOrderHash = String(result?.orderHash || result?.order_hash || order.order_hash).toLowerCase();
        if (providerOrderHash !== order.order_hash) throw new Error("OpenSea returned a different order hash.");
        const attempt = Number(publication.attempt_count) + 1;
        const update = await service.from("resale_order_publications").update({
          state: "published", provider_order_hash: providerOrderHash, provider_order_ref: providerOrderHash,
          attempt_count: attempt, last_attempt_at: now.toISOString(), next_attempt_at: null,
          published_at: now.toISOString(), last_error_code: null, last_error_detail: null
        }).eq("id", publication.id);
        if (update.error) throw update.error;
        summary.published += 1;
      } catch (publishError) {
        const attempt = Number(publication.attempt_count) + 1;
        const terminal = attempt >= 8;
        const retryAt = terminal ? null : new Date(now.getTime() + Math.min(3_600, 2 ** attempt * 30) * 1_000).toISOString();
        const details = providerError(publishError);
        await service.from("resale_order_publications").update({
          state: terminal ? "failed" : "retry", attempt_count: attempt, last_attempt_at: now.toISOString(),
          next_attempt_at: retryAt, published_at: null, last_error_code: details.code, last_error_detail: details.detail
        }).eq("id", publication.id);
        summary[terminal ? "failed" : "retry"] += 1;
      }
    }
    return json(summary, { status: summary.failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ConfigurationError) return problem(503, "opensea_not_configured", "OpenSea publication is not configured.");
    return problem(500, "unexpected_error", "OpenSea publication did not complete.");
  }
};
