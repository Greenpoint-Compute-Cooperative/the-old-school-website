import { ConfigurationError } from "../lib/server/config.js";
import { json, problem } from "../lib/server/http.js";
import { createSupabaseRequestClient } from "../lib/server/supabase.js";

export const GET = async (request) => {
  try {
    const { supabase, headers } = createSupabaseRequestClient(request);
    const [worksResult, bazaarsResult] = await Promise.all([
      supabase
        .from("works")
        .select("id,slug,title,artist_name,description,format,media_url,price_minor,currency,crypto_amount,crypto_asset,chain,contract_address,token_id,contract_status,location,status,curator_id")
        .eq("status", "listed")
        .order("listed_at", { ascending: false }),
      supabase
        .from("bazaar_events")
        .select("id,slug,title,starts_at,ends_at,venue,address,city,status,summary")
        .eq("status", "published")
        .order("starts_at", { ascending: true })
    ]);

    if (worksResult.error || bazaarsResult.error) return problem(502, "catalog_unavailable", "The live catalog could not be loaded.", headers);
    return json({ works: worksResult.data, bazaars: bazaarsResult.data }, { headers });
  } catch (error) {
    if (error instanceof ConfigurationError) return problem(503, "backend_not_configured", "The live catalog is not configured.");
    return problem(500, "unexpected_error", "The live catalog could not be loaded.");
  }
};
