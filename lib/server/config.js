const enabled = (value) => /^(1|true|yes|on)$/i.test(String(value || ""));

const value = (name) => String(process.env[name] || "").trim();

const siteOrigin = (input) => {
  if (!input) return "";
  try {
    const url = new URL(input);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    return url.protocol === "https:" || localHttp ? url.origin : "";
  } catch {
    return "";
  }
};

export class ConfigurationError extends Error {
  constructor(message, missing = []) {
    super(message);
    this.name = "ConfigurationError";
    this.missing = missing;
  }
}

export const getRuntimeConfig = () => {
  const supabaseUrl = value("SUPABASE_URL");
  const supabaseKey = value("SUPABASE_PUBLISHABLE_KEY") || value("SUPABASE_ANON_KEY");
  const supabaseSecretKey = value("SUPABASE_SECRET_KEY");
  const backendConfigured = Boolean(supabaseUrl && supabaseKey);
  const metricsEnabled = enabled(value("GROVE_METRICS_ENABLED"));

  return {
    supabaseUrl,
    supabaseKey,
    supabaseSecretKey,
    backendConfigured,
    siteUrl: siteOrigin(value("GROVE_SITE_URL")),
    providers: {
      instagram: {
        id: value("GROVE_INSTAGRAM_PROVIDER") || "custom:instagram",
        scopes: value("GROVE_INSTAGRAM_SCOPES") || "instagram_business_basic",
        enabled: enabled(value("GROVE_INSTAGRAM_OAUTH_ENABLED"))
      },
      x: {
        id: value("GROVE_X_PROVIDER") || "twitter",
        scopes: value("GROVE_X_SCOPES") || "users.read",
        enabled: enabled(value("GROVE_X_OAUTH_ENABLED"))
      }
    },
    acquisitionEnabled: enabled(value("GROVE_ACQUISITION_ENABLED")),
    metricsEnabled,
    metricsConfigured: backendConfigured && metricsEnabled && Boolean(supabaseSecretKey),
    metricsReadToken: value("GROVE_METRICS_READ_TOKEN"),
    cronSecret: value("CRON_SECRET")
  };
};

export const requireBackendConfig = () => {
  const config = getRuntimeConfig();
  if (config.backendConfigured) return config;

  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  throw new ConfigurationError("The Grove backend is not configured.", missing);
};

export const getProvider = (requestedProvider) => {
  const key = requestedProvider === "twitter" ? "x" : requestedProvider;
  if (!["instagram", "x"].includes(key)) return null;
  const config = requireBackendConfig();
  const provider = config.providers[key];
  return { ...provider, key, configured: provider.enabled && config.backendConfigured };
};

export const publicConfiguration = () => {
  const config = getRuntimeConfig();
  return {
    backend: { configured: config.backendConfigured },
    providers: {
      instagram: { configured: config.backendConfigured && config.providers.instagram.enabled },
      x: { configured: config.backendConfigured && config.providers.x.enabled }
    },
    profile: { imported: ["display name", "profile photo", "handle"] },
    acquisition: { configured: config.backendConfigured && config.acquisitionEnabled },
    metrics: { configured: config.metricsConfigured }
  };
};

export const configurationReport = () => {
  const config = getRuntimeConfig();
  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (!config.siteUrl) missing.push("GROVE_SITE_URL");
  if (!config.providers.instagram.enabled) missing.push("GROVE_INSTAGRAM_OAUTH_ENABLED=true");
  if (!config.providers.x.enabled) missing.push("GROVE_X_OAUTH_ENABLED=true");

  return { ready: missing.length === 0, missing };
};
