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

const ethereumAddress = (input) => /^0x[0-9a-f]{40}$/.test(input) ? input : "";
const ethereumHash = (input) => /^0x[0-9a-f]{64}$/.test(input) ? input : "";

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
  const auctionsEnabled = enabled(value("GROVE_AUCTIONS_ENABLED"));
  const walletEnabled = enabled(value("GROVE_WALLET_ENABLED"));
  const ethereumChainId = integer("GROVE_ETHEREUM_CHAIN_ID", 0, { minimum: 1, maximum: 11155111 });
  const ethereumRpcUrl = httpsUrl(value("GROVE_ETHEREUM_RPC_URL"));
  const stripeNftApprovalRef = value("GROVE_STRIPE_NFT_APPROVAL_REF");
  const auctionTermsUrl = httpsUrl(value("GROVE_AUCTION_TERMS_URL"));
  const auctionTermsVersion = value("GROVE_AUCTION_TERMS_VERSION");
  const auctionTermsHash = /^0x[0-9a-f]{64}$/.test(value("GROVE_AUCTION_TERMS_HASH"))
    ? value("GROVE_AUCTION_TERMS_HASH")
    : "";
  const maximumFiatHammerMinor = integer("GROVE_MAX_FIAT_HAMMER_MINOR", 0, { minimum: 50, maximum: 100_000_000 });
  const entryPointAddress = ethereumAddress(value("GROVE_ENTRY_POINT_ADDRESS"));
  const safeFactoryAddress = ethereumAddress(value("GROVE_SAFE_FACTORY_ADDRESS"));
  const safeSingletonAddress = ethereumAddress(value("GROVE_SAFE_SINGLETON_ADDRESS"));
  const safeFallbackHandlerAddress = ethereumAddress(value("GROVE_SAFE_FALLBACK_HANDLER_ADDRESS"));
  const safeWebAuthnSharedSignerAddress = ethereumAddress(value("GROVE_SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS"));
  const safe4337ModuleAddress = ethereumAddress(value("GROVE_SAFE_4337_MODULE_ADDRESS"));
  const safePasskeyVerifierAddress = ethereumAddress(value("GROVE_SAFE_PASSKEY_VERIFIER_ADDRESS"));
  const entryPointCodeHash = ethereumHash(value("GROVE_ENTRY_POINT_CODE_HASH"));
  const safeFactoryCodeHash = ethereumHash(value("GROVE_SAFE_FACTORY_CODE_HASH"));
  const safeProxyCodeHash = ethereumHash(value("GROVE_SAFE_PROXY_CODE_HASH"));
  const safeSingletonCodeHash = ethereumHash(value("GROVE_SAFE_SINGLETON_CODE_HASH"));
  const safeFallbackHandlerCodeHash = ethereumHash(value("GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH"));
  const safeWebAuthnSharedSignerCodeHash = ethereumHash(value("GROVE_SAFE_WEBAUTHN_SHARED_SIGNER_CODE_HASH"));
  const safe4337ModuleCodeHash = ethereumHash(value("GROVE_SAFE_4337_MODULE_CODE_HASH"));
  const safePasskeyVerifierCodeHash = ethereumHash(value("GROVE_SAFE_PASSKEY_VERIFIER_CODE_HASH"));
  const safe4337TupleCoherent = Boolean(
    safeFallbackHandlerAddress && safe4337ModuleAddress
      && safeFallbackHandlerAddress === safe4337ModuleAddress
      && safeFallbackHandlerCodeHash && safe4337ModuleCodeHash
      && safeFallbackHandlerCodeHash === safe4337ModuleCodeHash
  );
  const bundlerUrl = httpsUrl(value("GROVE_BUNDLER_URL"));
  const paymasterUrl = httpsUrl(value("GROVE_PAYMASTER_URL"));
  const paymasterApiToken = value("GROVE_PAYMASTER_API_TOKEN");
  const sponsorPolicyVersion = value("GROVE_SPONSOR_POLICY_VERSION");
  const stripeWebhookConfigured = Boolean(backendConfigured && supabaseSecretKey && stripeSecretKey && stripeWebhookSecret);
  const cardCheckoutConfigured = Boolean(
    stripeWebhookConfigured && configuredSiteUrl && acquisitionEnabled && automaticTax && sellerTermsVersion
      && buyerTermsUrl && buyerTermsVersion && maximumItemPriceMinor && cronSecret
  );
  const nonProductionChainAllowed = process.env.VERCEL_ENV !== "production" && ethereumChainId === 11155111;
  const walletStagingConfigured = Boolean(
    backendConfigured && supabaseSecretKey && walletEnabled && (ethereumChainId === 1 || nonProductionChainAllowed) && ethereumRpcUrl
      && entryPointAddress && safeFactoryAddress && safeSingletonAddress && safeFallbackHandlerAddress && safeWebAuthnSharedSignerAddress
      && safe4337ModuleAddress && safePasskeyVerifierAddress
      && entryPointCodeHash && safeFactoryCodeHash && safeProxyCodeHash && safeSingletonCodeHash
      && safeFallbackHandlerCodeHash && safeWebAuthnSharedSignerCodeHash && safe4337ModuleCodeHash && safePasskeyVerifierCodeHash
      && safe4337TupleCoherent
      && bundlerUrl && paymasterUrl && paymasterApiToken && sponsorPolicyVersion
  );
  const auctionStagingConfigured = Boolean(
    stripeWebhookConfigured && auctionsEnabled && walletStagingConfigured && configuredSiteUrl && automaticTax
      && stripeNftApprovalRef && auctionTermsUrl && auctionTermsVersion && auctionTermsHash
      && maximumFiatHammerMinor && cronSecret
  );
  // Preview is the only environment where a fully configured Sepolia stack may
  // advertise the rehearsal UI. Production remains gated by the deliberately
  // false, separately reviewed liveReady attestations below.
  const walletRehearsalReady = Boolean(
    process.env.VERCEL_ENV === "preview" && ethereumChainId === 11155111 && walletStagingConfigured
  );
  const auctionRehearsalReady = Boolean(walletRehearsalReady && auctionStagingConfigured);

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
    wallet: {
      stagingConfigured: walletStagingConfigured,
      rehearsalReady: walletRehearsalReady,
      liveReady: false,
      enabled: walletEnabled,
      chainId: ethereumChainId,
      rpcUrl: ethereumRpcUrl,
      entryPointAddress,
      safeFactoryAddress,
      safeSingletonAddress,
      safeFallbackHandlerAddress,
      safeWebAuthnSharedSignerAddress,
      safe4337ModuleAddress,
      safePasskeyVerifierAddress,
      entryPointCodeHash,
      safeFactoryCodeHash,
      safeProxyCodeHash,
      safeSingletonCodeHash,
      safeFallbackHandlerCodeHash,
      safeWebAuthnSharedSignerCodeHash,
      safe4337ModuleCodeHash,
      safePasskeyVerifierCodeHash,
      bundlerUrl,
      paymasterUrl,
      paymasterApiToken,
      sponsorPolicyVersion,
      safeVersion: "1.4.1",
      moduleVersion: "0.3.0",
      passkeyVersion: "0.2.1-1",
      entryPointVersion: "0.7"
    },
    auctions: {
      stagingConfigured: auctionStagingConfigured,
      rehearsalReady: auctionRehearsalReady,
      liveReady: false,
      enabled: auctionsEnabled,
      stripeNftApprovalRef,
      termsUrl: auctionTermsUrl,
      termsVersion: auctionTermsVersion,
      termsHash: auctionTermsHash,
      maximumFiatHammerMinor,
      mandateHours: integer("GROVE_AUCTION_MANDATE_HOURS", 168, { minimum: 1, maximum: 720 }),
      riskHoldHours: integer("GROVE_AUCTION_RISK_HOLD_HOURS", 168, { minimum: 0, maximum: 720 })
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
  const walletConfigured = config.wallet.liveReady || config.wallet.rehearsalReady;
  const auctionsConfigured = config.auctions.liveReady || config.auctions.rehearsalReady;
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
    wallet: {
      configured: walletConfigured,
      chainId: walletConfigured ? config.wallet.chainId : null,
      gas: config.wallet.liveReady ? "sponsored-supported-actions"
        : config.wallet.rehearsalReady ? "not-used-for-offchain-bids" : "disabled",
      environment: config.wallet.rehearsalReady ? "sepolia-rehearsal" : config.wallet.liveReady ? "mainnet" : "disabled"
    },
    auctions: {
      configured: auctionsConfigured,
      rails: auctionsConfigured ? ["card"] : [],
      environment: config.auctions.rehearsalReady ? "sepolia-rehearsal" : config.auctions.liveReady ? "mainnet" : "disabled"
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
  if (config.wallet.enabled || config.auctions.enabled) {
    const configuredChainAllowed = process.env.VERCEL_ENV === "production"
      ? config.wallet.chainId === 1
      : [1, 11155111].includes(config.wallet.chainId);
    if (!configuredChainAllowed) missing.push(process.env.VERCEL_ENV === "production"
      ? "GROVE_ETHEREUM_CHAIN_ID=1"
      : "GROVE_ETHEREUM_CHAIN_ID=1|11155111");
    if (!config.wallet.rpcUrl) missing.push("GROVE_ETHEREUM_RPC_URL");
    if (!config.wallet.entryPointAddress) missing.push("GROVE_ENTRY_POINT_ADDRESS");
    if (!config.wallet.safeFactoryAddress) missing.push("GROVE_SAFE_FACTORY_ADDRESS");
    if (!config.wallet.safeSingletonAddress) missing.push("GROVE_SAFE_SINGLETON_ADDRESS");
    if (!config.wallet.safeFallbackHandlerAddress) missing.push("GROVE_SAFE_FALLBACK_HANDLER_ADDRESS");
    if (!config.wallet.safeWebAuthnSharedSignerAddress) missing.push("GROVE_SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS");
    if (!config.wallet.safe4337ModuleAddress) missing.push("GROVE_SAFE_4337_MODULE_ADDRESS");
    if (!config.wallet.safePasskeyVerifierAddress) missing.push("GROVE_SAFE_PASSKEY_VERIFIER_ADDRESS");
    if (!config.wallet.entryPointCodeHash) missing.push("GROVE_ENTRY_POINT_CODE_HASH");
    if (!config.wallet.safeFactoryCodeHash) missing.push("GROVE_SAFE_FACTORY_CODE_HASH");
    if (!config.wallet.safeProxyCodeHash) missing.push("GROVE_SAFE_PROXY_CODE_HASH");
    if (!config.wallet.safeSingletonCodeHash) missing.push("GROVE_SAFE_SINGLETON_CODE_HASH");
    if (!config.wallet.safeFallbackHandlerCodeHash) missing.push("GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH");
    if (!config.wallet.safeWebAuthnSharedSignerCodeHash) missing.push("GROVE_SAFE_WEBAUTHN_SHARED_SIGNER_CODE_HASH");
    if (!config.wallet.safe4337ModuleCodeHash) missing.push("GROVE_SAFE_4337_MODULE_CODE_HASH");
    if (!config.wallet.safePasskeyVerifierCodeHash) missing.push("GROVE_SAFE_PASSKEY_VERIFIER_CODE_HASH");
    if (config.wallet.safeFallbackHandlerAddress && config.wallet.safe4337ModuleAddress
      && config.wallet.safeFallbackHandlerAddress !== config.wallet.safe4337ModuleAddress) {
      missing.push("GROVE_SAFE_FALLBACK_HANDLER_ADDRESS=GROVE_SAFE_4337_MODULE_ADDRESS");
    }
    if (config.wallet.safeFallbackHandlerCodeHash && config.wallet.safe4337ModuleCodeHash
      && config.wallet.safeFallbackHandlerCodeHash !== config.wallet.safe4337ModuleCodeHash) {
      missing.push("GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH=GROVE_SAFE_4337_MODULE_CODE_HASH");
    }
    if (!config.wallet.bundlerUrl) missing.push("GROVE_BUNDLER_URL");
    if (!config.wallet.paymasterUrl) missing.push("GROVE_PAYMASTER_URL");
    if (!config.wallet.paymasterApiToken) missing.push("GROVE_PAYMASTER_API_TOKEN");
    if (!config.wallet.sponsorPolicyVersion) missing.push("GROVE_SPONSOR_POLICY_VERSION");
  }
  if (config.auctions.enabled) {
    if (!config.auctions.stripeNftApprovalRef) missing.push("GROVE_STRIPE_NFT_APPROVAL_REF");
    if (!config.auctions.termsUrl) missing.push("GROVE_AUCTION_TERMS_URL");
    if (!config.auctions.termsVersion) missing.push("GROVE_AUCTION_TERMS_VERSION");
    if (!config.auctions.termsHash) missing.push("GROVE_AUCTION_TERMS_HASH");
    if (!config.auctions.maximumFiatHammerMinor) missing.push("GROVE_MAX_FIAT_HAMMER_MINOR");
    if (!config.commerce.stripeSecretKey) missing.push("STRIPE_SECRET_KEY");
    if (!config.commerce.stripeWebhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
    if (!config.commerce.automaticTax) missing.push("GROVE_STRIPE_AUTOMATIC_TAX=true");
    if (!config.cronSecret) missing.push("CRON_SECRET");
  }

  return { ready: missing.length === 0, missing };
};
