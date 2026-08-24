import { ConfigurationError, publicConfiguration } from "../lib/server/config.js";
import { json, problem } from "../lib/server/http.js";
import { createSupabaseRequestClient } from "../lib/server/supabase.js";

export const GET = async (request) => {
  try {
    const { supabase, headers } = createSupabaseRequestClient(request);
    const { error } = await supabase.from("works").select("id").limit(1);
    if (error) return problem(503, "database_unreachable", "The Grove database is unavailable.", headers);

    const configuration = publicConfiguration();
    return json({
      status: "ok",
      service: "grove-marketplace-new-york",
      runtime: {
        environment: process.env.VERCEL_ENV || "local",
        region: process.env.VERCEL_REGION || "local"
      },
      database: "reachable",
      providers: configuration.providers,
      acquisition: configuration.acquisition,
      metrics: configuration.metrics
    }, { headers: { ...Object.fromEntries(headers), "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return problem(503, "backend_not_configured", "The Grove backend is not configured.");
    }
    return problem(503, "service_unavailable", "Grove is unavailable.");
  }
};
