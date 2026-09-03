const enabled = (value) => /^(1|true|yes|on)$/i.test(String(value || ""));

const value = (name) => String(process.env[name] || "").trim();

const integer = (name, fallback, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(value(name), 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

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

const httpsUrl = (input) => {
  try {
    const url = new URL(input);
    return url.protocol === "https:" ? url.href : "";
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
  const acquisitionEnabled = enabled(value("GROVE_ACQUISITION_ENABLED"));
  const stripeSecretKey = value("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = value("STRIPE_WEBHOOK_SECRET");
  const sellerTermsVersion = value("GROVE_SELLER_TERMS_VERSION");
  const buyerTermsUrl = httpsUrl(value("GROVE_BUYER_TERMS_URL"));
  const buyerTermsVersion = value("GROVE_BUYER_TERMS_VERSION");
  const maximumItemPriceMinor = integer("GROVE_MAX_ITEM_PRICE_MINOR", 0, { minimum: 50, maximum: 100_000_000 });
  const cronSecret = value("CRON_SECRET");
  const configuredSiteUrl = siteOrigin(value("GROVE_SITE_URL"));
  const automaticTax = enabled(value("GROVE_STRIPE_AUTOMATIC_TAX"));
  const stripeWebhookConfigured = Boolean(backendConfigured && supabaseSecretKey && stripeSecretKey && stripeWebhookSecret);
  const cardCheckoutConfigured = Boolean(
    stripeWebhookConfigured && configuredSiteUrl && acquisitionEnabled && automaticTax && sellerTermsVersion
      && buyerTermsUrl && buyerTermsVersion && maximumItemPriceMinor && cronSecret
  );

  return {
    supabaseUrl,
    supabaseKey,
    supabaseSecretKey,
    backendConfigured,
    siteUrl: configuredSiteUrl,
    providers: {
      instagram: {
        id: value("GROVE_INSTAGRAM_PROVIDER") || "custom:instagram",
        scopes: value("GROVE_INSTAGRAM_SCOPES") || "instagram_business_basic",
        enabled: enabled(value("GROVE_INSTAGRAM_OAUTH_ENABLED"))
      },
      x: {
        id: value("GROVE_X_PROVIDER") || "x",
        scopes: value("GROVE_X_SCOPES") || "users.read",
        enabled: enabled(value("GROVE_X_OAUTH_ENABLED"))
      }
    },
    acquisitionEnabled,
    commerce: {
      cardCheckoutConfigured,
      stripeWebhookConfigured,
      stripeSecretKey,
      stripeWebhookSecret,
      sellerTermsVersion,
      buyerTermsUrl,
      buyerTermsVersion,
      maximumItemPriceMinor,
      automaticTax,
      reservationMinutes: integer("GROVE_CHECKOUT_RESERVATION_MINUTES", 35, { minimum: 35, maximum: 60 })
    },
    metricsEnabled,
    metricsConfigured: backendConfigured && metricsEnabled && Boolean(supabaseSecretKey),
    metricsReadToken: value("GROVE_METRICS_READ_TOKEN"),
    cronSecret
  };
};

export const requireBackendConfig = () => {
  const config = getRuntimeConfig();
  if (config.backendConfigured) return config;

  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  throw new ConfigurationError("The marketplace backend is not configured.", missing);
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
    acquisition: {
      configured: config.commerce.cardCheckoutConfigured,
      card: { configured: config.commerce.cardCheckoutConfigured, checkout: "hosted" },
      applePay: { configured: config.commerce.cardCheckoutConfigured, via: "stripe-checkout" },
      crypto: { configured: false }
    },
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
  if (config.acquisitionEnabled) {
    if (!config.supabaseSecretKey) missing.push("SUPABASE_SECRET_KEY");
    if (!config.commerce.stripeSecretKey) missing.push("STRIPE_SECRET_KEY");
    if (!config.commerce.stripeWebhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
    if (!config.commerce.sellerTermsVersion) missing.push("GROVE_SELLER_TERMS_VERSION");
    if (!config.commerce.buyerTermsUrl) missing.push("GROVE_BUYER_TERMS_URL");
    if (!config.commerce.buyerTermsVersion) missing.push("GROVE_BUYER_TERMS_VERSION");
    if (!config.commerce.maximumItemPriceMinor) missing.push("GROVE_MAX_ITEM_PRICE_MINOR");
    if (!config.commerce.automaticTax) missing.push("GROVE_STRIPE_AUTOMATIC_TAX=true");
    if (!config.cronSecret) missing.push("CRON_SECRET");
  }

  return { ready: missing.length === 0, missing };
};
