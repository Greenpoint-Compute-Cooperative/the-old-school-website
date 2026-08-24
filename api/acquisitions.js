import { ConfigurationError, getRuntimeConfig } from "../lib/server/config.js";
import { json, problem } from "../lib/server/http.js";
import { createSupabaseRequestClient, getAuthenticatedCurator } from "../lib/server/supabase.js";

export const GET = async (request) => {
  try {
    const { supabase, headers } = createSupabaseRequestClient(request);
    const { user } = await getAuthenticatedCurator(supabase);
    if (!user) return problem(401, "not_authenticated", "No member session is active.", headers);

    const { data, error } = await supabase
      .from("acquisitions")
      .select("id,work_id,method,state,amount_minor,currency,crypto_amount,crypto_asset,chain,created_at,updated_at")
      .eq("buyer_user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return problem(502, "acquisitions_unavailable", "Acquisition status could not be loaded.", headers);
    return json({ acquisitions: data }, { headers });
  } catch (error) {
    if (error instanceof ConfigurationError) return problem(503, "backend_not_configured", "Acquisition state is not configured.");
    return problem(500, "unexpected_error", "Acquisition status could not be loaded.");
  }
};

export const POST = async () => {
  const configured = getRuntimeConfig().acquisitionEnabled;
  return problem(
    configured ? 501 : 503,
    configured ? "acquisition_not_implemented" : "acquisition_not_configured",
    "Checkout requires a reviewed payment or wallet integration. No order was created."
  );
};
