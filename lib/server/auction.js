import Stripe from "stripe";
import { hashTypedData } from "viem";
import { buildBidTypedData } from "../shared/bid-intent.js";
import { ConfigurationError, getRuntimeConfig } from "./config.js";
import { verifyErc1271Hash } from "./wallet.js";

export const requireAuctionConfig = () => {
  const config = getRuntimeConfig();
  if (!config.auctions.stagingConfigured || (process.env.VERCEL_ENV === "production" && !config.auctions.liveReady)) {
    throw new ConfigurationError("Auctions are not configured.", [
      "GROVE_AUCTIONS_ENABLED=true",
      "GROVE_WALLET_ENABLED=true",
      "GROVE_ETHEREUM_CHAIN_ID=1",
      "GROVE_ETHEREUM_RPC_URL",
      "GROVE_STRIPE_NFT_APPROVAL_REF",
      "GROVE_AUCTION_TERMS_URL",
      "GROVE_AUCTION_TERMS_VERSION",
      "GROVE_AUCTION_TERMS_HASH",
      "GROVE_MAX_FIAT_HAMMER_MINOR",
      "Stripe, Supabase, ERC-4337 provider, and cron secrets"
    ]);
  }
  return config;
};

export const createAuctionStripeClient = (config = requireAuctionConfig()) => new Stripe(config.commerce.stripeSecretKey, {
  maxNetworkRetries: 2,
  timeout: 20_000,
  appInfo: { name: "Grove Marketplace Auctions", version: "1.2.0" }
});

export const buildAuctionSetupSessionParameters = ({ auction, mandate, customerId, config }) => ({
  mode: "setup",
  customer: customerId,
  payment_method_types: ["card"],
  billing_address_collection: "required",
  shipping_address_collection: { allowed_countries: ["US"] },
  phone_number_collection: { enabled: true },
  customer_update: { address: "auto", name: "auto", shipping: "auto" },
  consent_collection: { terms_of_service: "required" },
  custom_text: {
    submit: {
      message: `Save this payment method for the ${auction.title} auction. If you win, Grove may charge up to ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(mandate.maximum_hammer_minor / 100)} plus disclosed tax and shipping under ${mandate.mandate_terms_version}. A declined off-session charge requires you to return to complete payment.`
    }
  },
  metadata: {
    grove_flow: "auction-payment-setup",
    grove_auction_id: auction.id,
    grove_mandate_id: mandate.id,
    grove_terms_version: mandate.mandate_terms_version
  },
  setup_intent_data: {
    metadata: {
      grove_flow: "auction-payment-setup",
      grove_auction_id: auction.id,
      grove_mandate_id: mandate.id
    }
  },
  success_url: `${config.siteUrl}/?auction_setup=success&auction_id=${encodeURIComponent(auction.id)}`,
  cancel_url: `${config.siteUrl}/?auction_setup=cancelled&auction_id=${encodeURIComponent(auction.id)}`
});

export const buildWinnerPaymentIntentParameters = ({ settlement, mandate }) => {
  if (!Number.isSafeInteger(settlement.total_amount) || settlement.total_amount < 50) {
    throw new Error("INVALID_SETTLEMENT_TOTAL");
  }
  return {
    amount: settlement.total_amount,
    currency: "usd",
    customer: mandate.provider_customer_ref,
    payment_method: mandate.payment_method_ref,
    payment_method_types: ["card"],
    confirm: false,
    metadata: {
      grove_flow: "auction-settlement",
      grove_auction_id: settlement.auction_id,
      grove_settlement_id: settlement.id,
      grove_winning_bid_id: settlement.winning_bid_id
    }
  };
};

export const buildWinnerPaymentIntentConfirmationParameters = () => ({
  off_session: true,
  error_on_requires_action: false
});

export const verifyBidIntent = async ({ config, intent, signature }) => {
  const typedData = buildBidTypedData(intent);
  const intentHash = hashTypedData(typedData);
  const verification = await verifyErc1271Hash({ config, address: intent.bidderSafe, hash: intentHash, signature });
  return { ...verification, intentHash, typedData };
};
