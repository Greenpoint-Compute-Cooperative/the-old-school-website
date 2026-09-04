import { timingSafeEqual } from "node:crypto";
import { ConfigurationError, getRuntimeConfig, requireSecondaryIndexerConfig } from "../../lib/server/config.js";
import { json, problem } from "../../lib/server/http.js";
import { indexFinalizedOwnership } from "../../lib/server/resale-indexer.js";
import { createSupabaseServiceClient } from "../../lib/server/supabase.js";

const authorized = (request, expected) => {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
};

export const GET = async (request) => {
  const runtime = getRuntimeConfig();
  if (!runtime.cronSecret || !authorized(request, runtime.cronSecret)) {
    return problem(401, "not_authorized", "Cron authorization is required.");
  }
  try {
    const config = requireSecondaryIndexerConfig();
    const result = await indexFinalizedOwnership({ service: createSupabaseServiceClient(), config });
    return json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", operation: "resale_index", code: error?.code || error?.message || "index_error" }));
    if (error instanceof ConfigurationError) return problem(503, "secondary_index_not_configured", "Secondary ownership indexing is not configured.");
    return problem(503, "secondary_index_failed", "Secondary ownership indexing did not complete.");
  }
};
