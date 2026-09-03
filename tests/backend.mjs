import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GET as getConfig } from "../api/config.js";
import { configurationReport } from "../lib/server/config.js";
import { GET as getHealth } from "../api/health.js";
import { GET as startAuth } from "../api/auth/start.js";
import { POST as createAcquisition } from "../api/acquisitions.js";
import { effectiveDisputeEventType, effectivePaymentIntentEventType, POST as receiveStripeWebhook } from "../api/stripe/webhook.js";
import { POST as recordEvent } from "../api/events.js";
import { GET as getMetrics } from "../api/metrics.js";
import { buildCheckoutSessionParameters } from "../lib/server/commerce.js";
import {
  buildAuctionSetupSessionParameters,
  buildWinnerPaymentIntentParameters,
  buildWinnerPaymentIntentConfirmationParameters,
  requireAuctionConfig
} from "../lib/server/auction.js";
import { buildBidTypedData } from "../lib/shared/bid-intent.js";
import { POST as placeAuctionBid } from "../api/auctions/[id]/bids.js";
import { POST as setupAuctionPayment } from "../api/auctions/[id]/payment-setup.js";
import { POST as createWalletChallenge } from "../api/wallet/challenge.js";
import { POST as linkWallet } from "../api/wallet/link.js";
import { buildWalletLinkTypedData } from "../lib/shared/wallet-link.js";
import { GET as closeAuctions } from "../api/cron/auction-close.js";
import { requireWalletConfig } from "../lib/server/wallet.js";

const envNames = [
  "VERCEL_ENV",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "GROVE_INSTAGRAM_OAUTH_ENABLED",
  "GROVE_X_OAUTH_ENABLED",
  "GROVE_ACQUISITION_ENABLED",
  "GROVE_SELLER_TERMS_VERSION",
  "GROVE_BUYER_TERMS_URL",
  "GROVE_BUYER_TERMS_VERSION",
  "GROVE_MAX_ITEM_PRICE_MINOR",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GROVE_STRIPE_AUTOMATIC_TAX",
  "GROVE_METRICS_ENABLED",
  "GROVE_METRICS_READ_TOKEN",
  "CRON_SECRET"
  ,"GROVE_WALLET_ENABLED"
  ,"GROVE_AUCTIONS_ENABLED"
  ,"GROVE_ETHEREUM_CHAIN_ID"
  ,"GROVE_ETHEREUM_RPC_URL"
  ,"GROVE_ENTRY_POINT_ADDRESS"
  ,"GROVE_SAFE_FACTORY_ADDRESS"
  ,"GROVE_SAFE_SINGLETON_ADDRESS"
  ,"GROVE_SAFE_FALLBACK_HANDLER_ADDRESS"
  ,"GROVE_SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS"
  ,"GROVE_SAFE_4337_MODULE_ADDRESS"
  ,"GROVE_SAFE_PASSKEY_VERIFIER_ADDRESS"
  ,"GROVE_ENTRY_POINT_CODE_HASH"
  ,"GROVE_SAFE_FACTORY_CODE_HASH"
  ,"GROVE_SAFE_PROXY_CODE_HASH"
  ,"GROVE_SAFE_SINGLETON_CODE_HASH"
  ,"GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH"
  ,"GROVE_SAFE_WEBAUTHN_SHARED_SIGNER_CODE_HASH"
  ,"GROVE_SAFE_4337_MODULE_CODE_HASH"
  ,"GROVE_SAFE_PASSKEY_VERIFIER_CODE_HASH"
  ,"GROVE_BUNDLER_URL"
  ,"GROVE_PAYMASTER_URL"
  ,"GROVE_PAYMASTER_API_TOKEN"
  ,"GROVE_SPONSOR_POLICY_VERSION"
  ,"GROVE_STRIPE_NFT_APPROVAL_REF"
  ,"GROVE_AUCTION_TERMS_URL"
  ,"GROVE_AUCTION_TERMS_VERSION"
  ,"GROVE_AUCTION_TERMS_HASH"
  ,"GROVE_MAX_FIAT_HAMMER_MINOR"
];
const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
for (const name of envNames) delete process.env[name];

const configResponse = await getConfig();
assert.equal(configResponse.status, 200);
const config = await configResponse.json();
assert.deepEqual(config.profile.imported, ["display name", "profile photo", "handle"]);
assert.equal(config.providers.instagram.configured, false);
assert.equal(config.providers.x.configured, false);
assert.equal(config.metrics.configured, false);
assert.equal(config.acquisition.applePay.configured, false);
assert.equal(config.wallet.configured, false);
assert.equal(config.auctions.configured, false);

const unavailableBid = await placeAuctionBid(new Request("https://marketplace.example/api/auctions/60000000-0000-4000-8000-000000000001/bids", {
  method: "POST", body: "{}"
}));
assert.equal(unavailableBid.status, 503, "bidding fails closed without the complete wallet/payment boundary");
const unavailableSetup = await setupAuctionPayment(new Request("https://marketplace.example/api/auctions/60000000-0000-4000-8000-000000000001/payment-setup", {
  method: "POST", body: "{}"
}));
assert.equal(unavailableSetup.status, 503, "Apple Pay setup fails closed without written/provider configuration");
assert.equal((await createWalletChallenge(new Request("https://marketplace.example/api/wallet/challenge", { method: "POST", body: "{}" }))).status, 503);
assert.equal((await linkWallet(new Request("https://marketplace.example/api/wallet/link", { method: "POST", body: "{}" }))).status, 503);
assert.equal((await closeAuctions(new Request("https://marketplace.example/api/cron/auction-close"))).status, 401);

const invalidProvider = await startAuth(new Request("https://marketplace.example/api/auth/start?provider=email"));
assert.equal(invalidProvider.status, 400, "email is not accepted as a join path");

const unavailableProvider = await startAuth(new Request("https://marketplace.example/api/auth/start?provider=instagram"));
assert.equal(unavailableProvider.status, 503, "unconfigured OAuth cannot claim success");

const unavailableHealth = await getHealth(new Request("https://marketplace.example/api/health"));
assert.equal(unavailableHealth.status, 503, "health cannot claim a configured backend without credentials");

const acquisition = await createAcquisition();
assert.equal(acquisition.status, 503, "checkout stays disabled without a provider");
assert.match(JSON.stringify(await acquisition.json()), /No order was created/);

const checkoutParameters = buildCheckoutSessionParameters({
  acquisition_id: "00000000-0000-4000-8000-000000000001",
  work_id: "00000000-0000-4000-8000-000000000002",
  slug: "blue-hour-nassau",
  title: "Blue Hour, Nassau",
  artist_name: "A. Artist",
  format: "physical",
  amount_minor: 480000,
  currency: "USD",
  requires_shipping: true,
  stripe_tax_code: "txcd_99999999",
  stripe_shipping_rate_id: "shr_test_domestic",
  buyer_terms_version: "work-terms-v1",
  reservation_expires_at: new Date(Date.now() + 35 * 60_000).toISOString()
}, {
  siteUrl: "https://marketplace.example",
  commerce: { automaticTax: true }
});
assert.equal(checkoutParameters.mode, "payment");
assert.deepEqual(checkoutParameters.payment_method_types, ["card"]);
assert.equal(checkoutParameters.consent_collection.terms_of_service, "required");
assert.equal(checkoutParameters.automatic_tax.enabled, true);
assert.deepEqual(checkoutParameters.shipping_address_collection.allowed_countries, ["US"]);
assert.deepEqual(checkoutParameters.shipping_options, [{ shipping_rate: "shr_test_domestic" }]);
assert.match(checkoutParameters.success_url, /\{CHECKOUT_SESSION_ID\}/);
assert.equal(checkoutParameters.line_items[0].price_data.unit_amount, 480000);
assert.equal(checkoutParameters.line_items[0].price_data.product_data.tax_code, "txcd_99999999");

const bidTypedData = buildBidTypedData({
  auctionId: "60000000-0000-4000-8000-000000000001",
  workId: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  bidderSafe: "0x3333333333333333333333333333333333333333",
  amount: "480000",
  currency: "USD",
  nonce: "7",
  validAfter: 1_788_000_000,
  validUntil: 1_788_003_600,
  termsHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  settlementRail: "card",
  origin: "https://marketplace.example",
  chainId: 1
});
assert.equal(bidTypedData.domain.chainId, 1);
assert.equal(bidTypedData.primaryType, "BidIntent");
assert.equal(bidTypedData.message.amount, 480000n);
assert.equal(bidTypedData.message.settlementRail, 0);

const walletLinkTypedData = buildWalletLinkTypedData({
  challenge: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  safe: "0x3333333333333333333333333333333333333333",
  origin: "https://marketplace.example",
  expiresAt: 1_788_003_600,
  chainId: 1
});
assert.equal(walletLinkTypedData.domain.chainId, 1);
assert.equal(walletLinkTypedData.primaryType, "WalletLink");
assert.equal(walletLinkTypedData.message.expiresAt, 1788003600n);

const auctionSetupParameters = buildAuctionSetupSessionParameters({
  auction: { id: "60000000-0000-4000-8000-000000000001", title: "Auction Work" },
  mandate: { id: "70000000-0000-4000-8000-000000000001", maximum_hammer_minor: 500000, mandate_terms_version: "auction-v1" },
  customerId: "cus_test",
  config: { siteUrl: "https://marketplace.example" }
});
assert.equal(auctionSetupParameters.mode, "setup");
assert.deepEqual(auctionSetupParameters.payment_method_types, ["card"]);
assert.equal(auctionSetupParameters.billing_address_collection, "required");
assert.deepEqual(auctionSetupParameters.shipping_address_collection.allowed_countries, ["US"]);
assert.equal(auctionSetupParameters.customer_update.shipping, "auto");
assert.equal(auctionSetupParameters.metadata.grove_flow, "auction-payment-setup");
assert.match(auctionSetupParameters.custom_text.submit.message, /up to \$5,000\.00/);

const winnerPayment = buildWinnerPaymentIntentParameters({
  settlement: {
    id: "80000000-0000-4000-8000-000000000001",
    auction_id: "60000000-0000-4000-8000-000000000001",
    winning_bid_id: "90000000-0000-4000-8000-000000000001",
    total_amount: 512300
  },
  mandate: { provider_customer_ref: "cus_test", payment_method_ref: "pm_test" }
});
assert.equal(winnerPayment.off_session, undefined);
assert.equal(winnerPayment.confirm, false);
assert.equal(winnerPayment.amount, 512300);
assert.deepEqual(buildWinnerPaymentIntentConfirmationParameters(), { off_session: true, error_on_requires_action: false });
assert.equal(effectiveDisputeEventType("warning_needs_response"), "charge.dispute.created");
assert.equal(effectiveDisputeEventType("warning_closed"), "charge.dispute.warning_closed");
assert.equal(effectiveDisputeEventType("prevented"), "charge.dispute.prevented");
assert.equal(effectiveDisputeEventType("won"), "charge.dispute.won");
assert.equal(effectiveDisputeEventType("lost"), "charge.dispute.lost");
assert.equal(effectivePaymentIntentEventType("succeeded"), "payment_intent.succeeded");
assert.equal(effectivePaymentIntentEventType("requires_action"), "payment_intent.requires_action");
assert.equal(effectivePaymentIntentEventType("requires_payment_method"), "payment_intent.payment_failed");

const unavailableEvent = await recordEvent(new Request("https://marketplace.example/api/events", { method: "POST", body: "{}" }));
assert.equal(unavailableEvent.status, 503, "events fail closed without the server-only metrics boundary");

const unavailableMetrics = await getMetrics(new Request("https://marketplace.example/api/metrics"));
assert.equal(unavailableMetrics.status, 503, "operator metrics fail closed without server secrets");

Object.assign(process.env, {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
  GROVE_SITE_URL: "https://marketplace.example",
  GROVE_ACQUISITION_ENABLED: "true",
  GROVE_SELLER_TERMS_VERSION: "2026-09",
  GROVE_BUYER_TERMS_URL: "https://marketplace.example/terms",
  GROVE_BUYER_TERMS_VERSION: "2026-09",
  GROVE_MAX_ITEM_PRICE_MINOR: "1000000",
  GROVE_STRIPE_AUTOMATIC_TAX: "true",
  STRIPE_SECRET_KEY: "sk_test_placeholder",
  STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
  CRON_SECRET: "test-cron-secret-0000000000000000"
});
const configuredCheckout = await getConfig();
assert.equal((await configuredCheckout.json()).acquisition.applePay.configured, true, "Apple Pay readiness requires every commerce gate");

Object.assign(process.env, {
  GROVE_WALLET_ENABLED: "true",
  GROVE_AUCTIONS_ENABLED: "true",
  GROVE_ETHEREUM_CHAIN_ID: "1",
  GROVE_ETHEREUM_RPC_URL: "https://rpc.example",
  GROVE_ENTRY_POINT_ADDRESS: "0x1111111111111111111111111111111111111111",
  GROVE_SAFE_FACTORY_ADDRESS: "0x2222222222222222222222222222222222222222",
  GROVE_SAFE_SINGLETON_ADDRESS: "0x5555555555555555555555555555555555555555",
  GROVE_SAFE_FALLBACK_HANDLER_ADDRESS: "0x3333333333333333333333333333333333333333",
  GROVE_SAFE_WEBAUTHN_SHARED_SIGNER_ADDRESS: "0x7777777777777777777777777777777777777777",
  GROVE_SAFE_4337_MODULE_ADDRESS: "0x3333333333333333333333333333333333333333",
  GROVE_SAFE_PASSKEY_VERIFIER_ADDRESS: "0x4444444444444444444444444444444444444444",
  GROVE_ENTRY_POINT_CODE_HASH: "0x1111111111111111111111111111111111111111111111111111111111111111",
  GROVE_SAFE_FACTORY_CODE_HASH: "0x2222222222222222222222222222222222222222222222222222222222222222",
  GROVE_SAFE_PROXY_CODE_HASH: "0x5555555555555555555555555555555555555555555555555555555555555555",
  GROVE_SAFE_SINGLETON_CODE_HASH: "0x6666666666666666666666666666666666666666666666666666666666666666",
  GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH: "0x3333333333333333333333333333333333333333333333333333333333333333",
  GROVE_SAFE_WEBAUTHN_SHARED_SIGNER_CODE_HASH: "0x8888888888888888888888888888888888888888888888888888888888888888",
  GROVE_SAFE_4337_MODULE_CODE_HASH: "0x3333333333333333333333333333333333333333333333333333333333333333",
  GROVE_SAFE_PASSKEY_VERIFIER_CODE_HASH: "0x4444444444444444444444444444444444444444444444444444444444444444",
  GROVE_BUNDLER_URL: "https://bundler.example",
  GROVE_PAYMASTER_URL: "https://paymaster.example",
  GROVE_PAYMASTER_API_TOKEN: "test-provider-token",
  GROVE_SPONSOR_POLICY_VERSION: "policy-v1",
  GROVE_STRIPE_NFT_APPROVAL_REF: "approval-case-123",
  GROVE_AUCTION_TERMS_URL: "https://marketplace.example/auction-terms",
  GROVE_AUCTION_TERMS_VERSION: "auction-v1",
  GROVE_AUCTION_TERMS_HASH: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  GROVE_MAX_FIAT_HAMMER_MINOR: "1000000"
});
const configuredAuction = await (await getConfig()).json();
assert.equal(configuredAuction.wallet.configured, false, "infrastructure values cannot advertise an unfinished production wallet");
assert.equal(configuredAuction.wallet.chainId, null);
assert.equal(configuredAuction.auctions.configured, false, "unfinished settlement/release cannot advertise a live auction");
assert.deepEqual(configuredAuction.auctions.rails, []);
process.env.GROVE_SAFE_FALLBACK_HANDLER_ADDRESS = "0x6666666666666666666666666666666666666666";
process.env.GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH = "0x7777777777777777777777777777777777777777777777777777777777777777";
const incoherentSafeReport = configurationReport();
assert.equal(incoherentSafeReport.ready, false, "a Safe 4337 fallback/module mismatch fails configuration");
assert.equal(incoherentSafeReport.missing.includes("GROVE_SAFE_FALLBACK_HANDLER_ADDRESS=GROVE_SAFE_4337_MODULE_ADDRESS"), true);
assert.equal(incoherentSafeReport.missing.includes("GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH=GROVE_SAFE_4337_MODULE_CODE_HASH"), true);
process.env.GROVE_SAFE_FALLBACK_HANDLER_ADDRESS = process.env.GROVE_SAFE_4337_MODULE_ADDRESS;
process.env.GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH = process.env.GROVE_SAFE_4337_MODULE_CODE_HASH;
process.env.GROVE_ETHEREUM_CHAIN_ID = "11155111";
process.env.VERCEL_ENV = "preview";
assert.equal(configurationReport().missing.some((item) => item.includes("GROVE_ETHEREUM_CHAIN_ID")), false, "Sepolia is accepted for preview rehearsal");
process.env.GROVE_ETHEREUM_CHAIN_ID = "1";
process.env.VERCEL_ENV = "production";
assert.throws(() => requireAuctionConfig(), /not configured/i, "production auction mutations remain hard-disabled");
assert.throws(() => requireWalletConfig(), /not configured/i, "production wallet mutations remain hard-disabled");
delete process.env.VERCEL_ENV;

const crossOriginCheckout = await createAcquisition(new Request("https://marketplace.example/api/acquisitions", {
  method: "POST",
  headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
  body: JSON.stringify({ work_slug: "blue-hour-nassau", method: "card" })
}));
assert.equal(crossOriginCheckout.status, 403, "checkout creation rejects cross-origin reservation attempts");

delete process.env.GROVE_ACQUISITION_ENABLED;
assert.equal((await (await getConfig()).json()).acquisition.card.configured, false, "the kill switch stops new checkout");
const invalidWebhook = await receiveStripeWebhook(new Request("https://marketplace.example/api/stripe/webhook", {
  method: "POST",
  headers: { "Stripe-Signature": "invalid", "Content-Type": "application/json" },
  body: "{}"
}));
assert.equal(invalidWebhook.status, 400, "signed-event ingestion stays active behind the sales kill switch");

for (const name of [
  "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "GROVE_SITE_URL",
  "GROVE_ACQUISITION_ENABLED", "GROVE_SELLER_TERMS_VERSION", "GROVE_BUYER_TERMS_URL",
  "GROVE_BUYER_TERMS_VERSION", "GROVE_MAX_ITEM_PRICE_MINOR", "GROVE_STRIPE_AUTOMATIC_TAX",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"
]) delete process.env[name];

const migration = await readFile(new URL("../supabase/migrations/20260824000000_grove_marketplace_foundation.sql", import.meta.url), "utf8");
for (const table of ["curators", "discoveries", "sponsorships", "works", "bazaar_events", "acquisitions"]) {
  assert.match(migration, new RegExp(`create table public\\.${table}`), `${table} is represented in the schema`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS`);
}

const commerceMigration = await readFile(new URL("../supabase/migrations/20260903000000_live_commerce_foundation.sql", import.meta.url), "utf8");
for (const table of ["sellers", "rights_assertions", "provider_events", "payment_ledger_entries", "fulfillments", "commerce_outbox", "commerce_audit_log"]) {
  assert.match(commerceMigration, new RegExp(`create table public\\.${table}`), `${table} is represented in the commerce schema`);
  assert.match(commerceMigration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS`);
}
for (const boundary of ["reserve_card_checkout", "attach_card_checkout", "release_card_reservation", "apply_stripe_checkout_event", "apply_stripe_financial_event"]) {
  assert.match(commerceMigration, new RegExp(boundary), `${boundary} is defined transactionally`);
}
assert.match(commerceMigration, /auth\.users where id = buyer_uuid for update/, "buyer reservation limits are serialized");
assert.match(commerceMigration, /warning_closed/, "terminal dispute inquiries cannot remain stuck open");
assert.match(commerceMigration, /prevented/, "prevented disputes cannot remain stuck open");

const auctionMigration = await readFile(new URL("../supabase/migrations/20260904000000_hybrid_auction_foundation.sql", import.meta.url), "utf8");
for (const table of [
  "smart_accounts", "wallet_credentials", "wallet_links", "wallet_link_challenges", "sponsorship_decisions", "nft_collections",
  "auctions", "bidder_payment_mandates", "auction_bids", "auction_events", "auction_settlements",
  "auction_payment_ledger_entries", "payment_attempts", "chain_deliveries"
]) {
  assert.match(auctionMigration, new RegExp(`create table public\\.${table}`), `${table} is represented in the auction schema`);
  assert.match(auctionMigration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS`);
}
for (const boundary of ["place_verified_auction_bid", "close_auction", "finalize_wallet_link", "apply_stripe_auction_setup_event", "register_auction_payment_attempt", "replace_auction_payment_attempt", "apply_stripe_auction_payment_event"]) {
  assert.match(auctionMigration, new RegExp(boundary), `${boundary} is a server-only database boundary`);
}
assert.match(auctionMigration, /settlement_rail in \('card', 'crypto'\)/, "a lot has one declared settlement rail");
assert.match(auctionMigration, /nft_custody_state <> 'inventory-safe'/, "inventory custody requires finalized mint evidence");
assert.match(auctionMigration, /Social OAuth identifies the Grove member/, "social identity is explicitly separated from wallet authority");
assert.match(auctionMigration, /intent_origin_hash/, "bid verification persists its immutable typed-data origin");
assert.match(auctionMigration, /payment_intent_not_current/, "settlement events are bound to one current PaymentIntent");
assert.match(auctionMigration, /consent_terms_accepted_at/, "off-session consent evidence is required for a ready mandate");
assert.match(migration, /initialize_curator_profile/);
assert.match(migration, /Email, phone, tokens, and credentials are deliberately not copied/);
assert.match(migration, /source_provider in \('instagram', 'x', 'web', 'direct'\)/);

const metricsMigration = await readFile(new URL("../supabase/migrations/20260824010000_product_observability.sql", import.meta.url), "utf8");
assert.match(metricsMigration, /create table public\.product_events/);
assert.match(metricsMigration, /alter table public\.product_events enable row level security/);
assert.match(metricsMigration, /revoke all on public\.product_events from anon, authenticated/);
assert.match(metricsMigration, /record_product_event/);
assert.match(metricsMigration, /product_metrics_summary/);
assert.match(metricsMigration, /prune_product_events/);

const dashboardMigration = await readFile(new URL("../supabase/migrations/20260824020000_metrics_dashboard.sql", import.meta.url), "utf8");
assert.match(dashboardMigration, /'funnels'/);
assert.match(dashboardMigration, /'breakdowns'/);
assert.match(dashboardMigration, /'operations'/);
assert.match(dashboardMigration, /security definer/);

for (const [name, value] of Object.entries(previous)) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

console.log("Backend boundary checks passed.");
