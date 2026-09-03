import { hashTypedData } from "viem";
import { buildBidTypedData } from "../shared/bid-intent.js";
import { buildWalletLinkTypedData } from "../shared/wallet-link.js";

// Private WebAuthn key material remains inside the authenticator. This browser-only
// module prepares deterministic typed data; the configured Safe adapter performs signing.
export const prepareBidIntent = (input) => {
  const typedData = buildBidTypedData(input);
  return { typedData, intentHash: hashTypedData(typedData) };
};

export const prepareWalletLink = (input) => {
  const typedData = buildWalletLinkTypedData(input);
  return { typedData, intentHash: hashTypedData(typedData) };
};

export const passkeysSupported = () => Boolean(
  globalThis.PublicKeyCredential && globalThis.navigator?.credentials && globalThis.isSecureContext
);
