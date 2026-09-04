import { randomBytes } from "node:crypto";
import { OpenSeaAPI, Chain } from "@opensea/sdk";
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isHex,
  keccak256
} from "viem";
import { mainnet, sepolia } from "viem/chains";
import { ConfigurationError, requireSecondaryConfig } from "./config.js";
import {
  ZERO_ADDRESS,
  ZERO_HASH,
  normalizeResaleOrderComponents,
  resaleOrderDigest,
  resaleOrderHash,
  resaleProtocolData,
  resaleOrderTypedData
} from "../shared/resale-order.js";

const ERC1271_MAGIC_VALUE = "0x1626ba7e";
const ERC721_ABI = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "owner", type: "address" }] },
  { type: "function", name: "getApproved", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "operator", type: "address" }] },
  { type: "function", name: "isApprovedForAll", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "approved", type: "bool" }] },
  { type: "function", name: "royaltyInfo", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }, { name: "salePrice", type: "uint256" }], outputs: [{ name: "receiver", type: "address" }, { name: "royaltyAmount", type: "uint256" }] }
];
const ERC721_APPROVE_ABI = [{
  type: "function", name: "approve", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: []
}];
const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] }
];
const ERC20_APPROVE_ABI = [{
  type: "function", name: "approve", stateMutability: "nonpayable",
  inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }]
}];
const ERC1271_ABI = [{
  type: "function", name: "isValidSignature", stateMutability: "view",
  inputs: [{ name: "hash", type: "bytes32" }, { name: "signature", type: "bytes" }], outputs: [{ name: "", type: "bytes4" }]
}];
const SEAPORT_ABI = [
  { type: "function", name: "information", stateMutability: "view", inputs: [], outputs: [{ name: "version", type: "string" }, { name: "domainSeparator", type: "bytes32" }, { name: "conduitController", type: "address" }] },
  { type: "function", name: "getCounter", stateMutability: "view", inputs: [{ name: "offerer", type: "address" }], outputs: [{ name: "counter", type: "uint256" }] },
  {
    type: "function", name: "getOrderStatus", stateMutability: "view", inputs: [{ name: "orderHash", type: "bytes32" }],
    outputs: [{ name: "isValidated", type: "bool" }, { name: "isCancelled", type: "bool" }, { name: "totalFilled", type: "uint256" }, { name: "totalSize", type: "uint256" }]
  }
];
const FULFILL_ORDER_ABI = [{
  type: "function", name: "fulfillOrder", stateMutability: "payable",
  inputs: [
    {
      name: "order", type: "tuple", components: [
        {
          name: "parameters", type: "tuple", components: [
            { name: "offerer", type: "address" }, { name: "zone", type: "address" },
            { name: "offer", type: "tuple[]", components: [{ name: "itemType", type: "uint8" }, { name: "token", type: "address" }, { name: "identifierOrCriteria", type: "uint256" }, { name: "startAmount", type: "uint256" }, { name: "endAmount", type: "uint256" }] },
            { name: "consideration", type: "tuple[]", components: [{ name: "itemType", type: "uint8" }, { name: "token", type: "address" }, { name: "identifierOrCriteria", type: "uint256" }, { name: "startAmount", type: "uint256" }, { name: "endAmount", type: "uint256" }, { name: "recipient", type: "address" }] },
            { name: "orderType", type: "uint8" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" },
            { name: "zoneHash", type: "bytes32" }, { name: "salt", type: "uint256" }, { name: "conduitKey", type: "bytes32" },
            { name: "totalOriginalConsiderationItems", type: "uint256" }
          ]
        },
        { name: "signature", type: "bytes" }
      ]
    },
    { name: "fulfillerConduitKey", type: "bytes32" }
  ],
  outputs: [{ name: "fulfilled", type: "bool" }]
}];

const clientFor = (config) => createPublicClient({
  chain: config.wallet.chainId === 1 ? mainnet : sepolia,
  transport: http(config.wallet.rpcUrl)
});

const assertRuntimeHash = async (client, address, expectedHash, blockNumber, code) => {
  const bytecode = await client.getBytecode({ address, blockNumber });
  if (!bytecode || keccak256(bytecode).toLowerCase() !== expectedHash.toLowerCase()) throw new Error(code);
};

const recipientAmounts = (consideration) => {
  const amounts = new Map();
  for (const entry of consideration) {
    const recipient = getAddress(entry.recipient);
    amounts.set(recipient, (amounts.get(recipient) || 0n) + BigInt(entry.startAmount));
  }
  return amounts;
};

const addAmount = (amounts, recipient, amount) => {
  if (amount <= 0n) return;
  const normalized = getAddress(recipient);
  amounts.set(normalized, (amounts.get(normalized) || 0n) + amount);
};

const price = (input) => {
  const output = String(input ?? "");
  if (!/^[1-9][0-9]{0,77}$/.test(output)) throw new Error("INVALID_RESALE_PRICE");
  return BigInt(output);
};

export const verifySecondaryInfrastructure = async ({ config = requireSecondaryConfig() } = {}) => {
  const client = clientFor(config);
  const finalized = await client.getBlock({ blockTag: "finalized" });
  await Promise.all([
    assertRuntimeHash(client, config.secondary.protocolAddress, config.secondary.protocolCodeHash, finalized.number, "SEAPORT_CODE_HASH_MISMATCH"),
    assertRuntimeHash(client, config.secondary.usdcAddress, config.secondary.usdcCodeHash, finalized.number, "USDC_CODE_HASH_MISMATCH")
  ]);
  const [information, decimals] = await Promise.all([
    client.readContract({ address: config.secondary.protocolAddress, abi: SEAPORT_ABI, functionName: "information", blockNumber: finalized.number }),
    client.readContract({ address: config.secondary.usdcAddress, abi: ERC20_ABI, functionName: "decimals", blockNumber: finalized.number })
  ]);
  if (information[0] !== "1.6" || decimals !== 6) throw new Error("SECONDARY_TRUST_ROOT_MISMATCH");
  return { blockNumber: finalized.number, blockHash: finalized.hash };
};

export const openSeaAssetUrl = ({ chainId, contractAddress, tokenId }) => {
  if (Number(chainId) !== 1 || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress || "")
    || !/^(0|[1-9][0-9]{0,77})$/.test(String(tokenId ?? ""))) return null;
  return `https://opensea.io/assets/ethereum/${getAddress(contractAddress)}/${tokenId}`;
};

export const buildFixedPriceResaleOrder = ({
  config, offerer, collectionAddress, tokenId, grossAmount, durationSeconds,
  counter, royaltyReceiver, royaltyAmount, nowSeconds = Math.floor(Date.now() / 1_000), salt
}) => {
  const gross = price(grossAmount);
  const minimum = price(config.secondary.minimumPrice);
  const maximum = price(config.secondary.maximumPrice);
  const duration = Number(durationSeconds);
  const royalty = BigInt(royaltyAmount);
  const platformFee = gross * BigInt(config.secondary.feeBps) / 10_000n;
  const sellerProceeds = gross - royalty - platformFee;
  if (gross < minimum || gross > maximum || !Number.isSafeInteger(duration) || duration < 3_600
    || duration > config.secondary.maximumDurationSeconds || royalty < 0n || sellerProceeds <= 0n) {
    throw new Error("RESALE_POLICY_REJECTED");
  }
  const amounts = new Map();
  addAmount(amounts, offerer, sellerProceeds);
  addAmount(amounts, royaltyReceiver, royalty);
  if (platformFee) addAmount(amounts, config.secondary.feeRecipient, platformFee);
  const consideration = [...amounts].map(([recipient, amount]) => ({
    itemType: 1,
    token: getAddress(config.secondary.usdcAddress),
    identifierOrCriteria: "0",
    startAmount: amount.toString(),
    endAmount: amount.toString(),
    recipient
  }));
  return normalizeResaleOrderComponents({
    offerer: getAddress(offerer),
    zone: ZERO_ADDRESS,
    offer: [{
      itemType: 2,
      token: getAddress(collectionAddress),
      identifierOrCriteria: String(tokenId),
      startAmount: "1",
      endAmount: "1"
    }],
    consideration,
    orderType: 0,
    startTime: String(nowSeconds - 60),
    endTime: String(nowSeconds + duration),
    zoneHash: ZERO_HASH,
    salt: salt || BigInt(`0x${randomBytes(32).toString("hex")}`).toString(),
    conduitKey: ZERO_HASH,
    counter: String(counter)
  });
};

export const prepareResaleOrderContext = async ({ config = requireSecondaryConfig(), account, collection, work, grossAmount, durationSeconds }) => {
  if (collection.standard !== "ERC721" || Number(collection.chain_id) !== config.wallet.chainId
    || ![config.secondary.rehearsalReady ? "rehearsal" : "active", "active"].includes(collection.state)
    || Number(account.chain_id) !== config.wallet.chainId || !account.finalized_at
    || !["deployed", "recovery-ready"].includes(account.state)) throw new Error("RESALE_ACCOUNT_OR_TOKEN_UNAVAILABLE");
  const client = clientFor(config);
  const finalized = await client.getBlock({ blockTag: "finalized" });
  const [owner, approved, operatorApproved, counter, royaltyResult] = await Promise.all([
    client.readContract({ address: collection.contract_address, abi: ERC721_ABI, functionName: "ownerOf", args: [BigInt(work.nft_token_id)], blockNumber: finalized.number }),
    client.readContract({ address: collection.contract_address, abi: ERC721_ABI, functionName: "getApproved", args: [BigInt(work.nft_token_id)], blockNumber: finalized.number }),
    client.readContract({ address: collection.contract_address, abi: ERC721_ABI, functionName: "isApprovedForAll", args: [account.account_address, config.secondary.protocolAddress], blockNumber: finalized.number }),
    client.readContract({ address: config.secondary.protocolAddress, abi: SEAPORT_ABI, functionName: "getCounter", args: [account.account_address], blockNumber: finalized.number }),
    client.readContract({ address: collection.contract_address, abi: ERC721_ABI, functionName: "royaltyInfo", args: [BigInt(work.nft_token_id), price(grossAmount)], blockNumber: finalized.number })
  ]);
  if (getAddress(owner) !== getAddress(account.account_address)) throw new Error("RESALE_SELLER_NOT_OWNER");
  const order = buildFixedPriceResaleOrder({
    config,
    offerer: account.account_address,
    collectionAddress: collection.contract_address,
    tokenId: work.nft_token_id,
    grossAmount,
    durationSeconds,
    counter,
    royaltyReceiver: royaltyResult[0],
    royaltyAmount: royaltyResult[1]
  });
  const approvedForExactToken = getAddress(approved) === getAddress(config.secondary.protocolAddress);
  return {
    order,
    typedData: resaleOrderTypedData({ chainId: config.wallet.chainId, protocolAddress: config.secondary.protocolAddress, order }),
    orderHash: resaleOrderHash(order),
    approval: {
      required: !approvedForExactToken,
      exactTokenApproved: approvedForExactToken,
      operatorApprovalIgnored: Boolean(operatorApproved),
      transaction: !approvedForExactToken ? {
        to: getAddress(collection.contract_address),
        data: encodeFunctionData({ abi: ERC721_APPROVE_ABI, functionName: "approve", args: [config.secondary.protocolAddress, BigInt(work.nft_token_id)] }),
        value: "0"
      } : null
    },
    evidence: { blockNumber: finalized.number.toString(), blockHash: finalized.hash }
  };
};

export const verifyPublishableResaleOrder = async ({ config = requireSecondaryConfig(), account, collection, work, order: input, signature }) => {
  if (!isHex(signature) || signature.length < 4 || signature.length > 8_194) throw new Error("INVALID_RESALE_SIGNATURE");
  const order = normalizeResaleOrderComponents(input);
  if (collection.standard !== "ERC721" || Number(collection.chain_id) !== config.wallet.chainId
    || Number(account.chain_id) !== config.wallet.chainId || !account.finalized_at
    || !["deployed", "recovery-ready"].includes(account.state)
    || getAddress(order.offerer) !== getAddress(account.account_address)
    || order.offer[0].itemType !== 2 || getAddress(order.offer[0].token) !== getAddress(collection.contract_address)
    || order.offer[0].identifierOrCriteria !== String(work.nft_token_id)
    || order.offer[0].startAmount !== "1" || order.offer[0].endAmount !== "1") throw new Error("RESALE_POLICY_REJECTED");
  for (const entry of order.consideration) {
    if (entry.itemType !== 1 || getAddress(entry.token) !== getAddress(config.secondary.usdcAddress)
      || entry.identifierOrCriteria !== "0" || entry.startAmount !== entry.endAmount) throw new Error("RESALE_POLICY_REJECTED");
  }
  const gross = order.consideration.reduce((sum, entry) => sum + BigInt(entry.startAmount), 0n);
  const minimum = price(config.secondary.minimumPrice);
  const maximum = price(config.secondary.maximumPrice);
  const now = BigInt(Math.floor(Date.now() / 1_000));
  if (gross < minimum || gross > maximum || BigInt(order.startTime) > now + 300n || BigInt(order.startTime) < now - 900n
    || BigInt(order.endTime) <= now || BigInt(order.endTime) - BigInt(order.startTime) > BigInt(config.secondary.maximumDurationSeconds)) {
    throw new Error("RESALE_POLICY_REJECTED");
  }

  const client = clientFor(config);
  const finalized = await client.getBlock({ blockTag: "finalized" });
  await Promise.all([
    assertRuntimeHash(client, config.secondary.protocolAddress, config.secondary.protocolCodeHash, finalized.number, "SEAPORT_CODE_HASH_MISMATCH"),
    assertRuntimeHash(client, config.secondary.usdcAddress, config.secondary.usdcCodeHash, finalized.number, "USDC_CODE_HASH_MISMATCH"),
    assertRuntimeHash(client, collection.contract_address, collection.deployed_code_hash, finalized.number, "COLLECTION_CODE_HASH_MISMATCH")
  ]);
  const orderHash = resaleOrderHash(order);
  const digest = resaleOrderDigest({ chainId: config.wallet.chainId, protocolAddress: config.secondary.protocolAddress, order });
  const [information, decimals, owner, approved, counter, royaltyResult, signatureResult, status] = await Promise.all([
    client.readContract({ address: config.secondary.protocolAddress, abi: SEAPORT_ABI, functionName: "information", blockNumber: finalized.number }),
    client.readContract({ address: config.secondary.usdcAddress, abi: ERC20_ABI, functionName: "decimals", blockNumber: finalized.number }),
    client.readContract({ address: collection.contract_address, abi: ERC721_ABI, functionName: "ownerOf", args: [BigInt(work.nft_token_id)], blockNumber: finalized.number }),
    client.readContract({ address: collection.contract_address, abi: ERC721_ABI, functionName: "getApproved", args: [BigInt(work.nft_token_id)], blockNumber: finalized.number }),
    client.readContract({ address: config.secondary.protocolAddress, abi: SEAPORT_ABI, functionName: "getCounter", args: [account.account_address], blockNumber: finalized.number }),
    client.readContract({ address: collection.contract_address, abi: ERC721_ABI, functionName: "royaltyInfo", args: [BigInt(work.nft_token_id), gross], blockNumber: finalized.number }),
    client.readContract({ address: account.account_address, abi: ERC1271_ABI, functionName: "isValidSignature", args: [digest, signature], blockNumber: finalized.number }),
    client.readContract({ address: config.secondary.protocolAddress, abi: SEAPORT_ABI, functionName: "getOrderStatus", args: [orderHash], blockNumber: finalized.number })
  ]);
  if (information[0] !== "1.6" || decimals !== 6 || getAddress(owner) !== getAddress(account.account_address)
    || getAddress(approved) !== getAddress(config.secondary.protocolAddress) || BigInt(counter) !== BigInt(order.counter)
    || signatureResult.toLowerCase() !== ERC1271_MAGIC_VALUE || status[1] || BigInt(status[2]) !== 0n) {
    throw new Error("RESALE_CHAIN_PREFLIGHT_FAILED");
  }
  const expected = new Map();
  const royaltyAmount = BigInt(royaltyResult[1]);
  const platformFee = gross * BigInt(config.secondary.feeBps) / 10_000n;
  addAmount(expected, account.account_address, gross - royaltyAmount - platformFee);
  addAmount(expected, royaltyResult[0], royaltyAmount);
  if (platformFee) addAmount(expected, config.secondary.feeRecipient, platformFee);
  const actual = recipientAmounts(order.consideration);
  if (expected.size !== actual.size || [...expected].some(([recipient, amount]) => actual.get(recipient) !== amount)) {
    throw new Error("RESALE_CONSIDERATION_MISMATCH");
  }
  return {
    order,
    orderHash,
    digest,
    grossAmount: gross.toString(),
    sellerProceeds: (gross - royaltyAmount - platformFee).toString(),
    royaltyRecipient: getAddress(royaltyResult[0]).toLowerCase(),
    royaltyAmount: royaltyAmount.toString(),
    marketplaceAmount: platformFee.toString(),
    blockNumber: finalized.number.toString(),
    blockHash: finalized.hash
  };
};

export const buildResaleFulfillment = ({ config = requireSecondaryConfig(), order, signature, buyerAddress }) => {
  const protocolData = resaleProtocolData({ order, signature });
  const gross = protocolData.parameters.consideration.reduce((sum, entry) => sum + BigInt(entry.startAmount), 0n);
  return {
    buyer: getAddress(buyerAddress),
    approvals: [{
      to: getAddress(config.secondary.usdcAddress),
      data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [config.secondary.protocolAddress, gross] }),
      value: "0"
    }],
    fulfillment: {
      to: getAddress(config.secondary.protocolAddress),
      data: encodeFunctionData({ abi: FULFILL_ORDER_ABI, functionName: "fulfillOrder", args: [protocolData, ZERO_HASH] }),
      value: "0"
    },
    grossAmount: gross.toString()
  };
};

export const verifyBuyerFunds = async ({ config = requireSecondaryConfig(), buyerAddress, grossAmount }) => {
  const client = clientFor(config);
  const [balance, allowance] = await Promise.all([
    client.readContract({ address: config.secondary.usdcAddress, abi: ERC20_ABI, functionName: "balanceOf", args: [buyerAddress] }),
    client.readContract({ address: config.secondary.usdcAddress, abi: ERC20_ABI, functionName: "allowance", args: [buyerAddress, config.secondary.protocolAddress] })
  ]);
  return { balance: balance.toString(), allowance: allowance.toString(), sufficient: balance >= BigInt(grossAmount) };
};

export const publishOpenSeaListing = async ({ config, order, signature }) => {
  if (!config.openSea.liveReady || !config.openSea.apiKey || config.wallet.chainId !== 1) {
    throw new ConfigurationError("OpenSea publication is not configured for Production mainnet.", ["OPENSEA_API_KEY", "reviewed mainnet release attestation"]);
  }
  const api = new OpenSeaAPI({ apiKey: config.openSea.apiKey, chain: Chain.Mainnet });
  return api.postListing(resaleProtocolData({ order, signature }), config.secondary.protocolAddress);
};
