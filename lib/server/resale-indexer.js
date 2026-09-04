import { createPublicClient, getAddress, http, keccak256 } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { requireSecondaryIndexerConfig } from "./config.js";
import { verifySecondaryInfrastructure } from "./resale.js";

const OWNER_OF_ABI = [{
  type: "function", name: "ownerOf", stateMutability: "view",
  inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "owner", type: "address" }]
}];

const clientFor = (config) => createPublicClient({
  chain: config.wallet.chainId === 1 ? mainnet : sepolia,
  transport: http(config.wallet.rpcUrl)
});

export const indexFinalizedOwnership = async ({ service, config = requireSecondaryIndexerConfig(), limit = 100 }) => {
  const finalized = await verifySecondaryInfrastructure({ config });
  const client = clientFor(config);
  const { data: works, error: worksError } = await service.from("works")
    .select("id,nft_collection_id,nft_token_id,format,contract_status")
    .not("nft_collection_id", "is", null).not("nft_token_id", "is", null)
    .eq("format", "digital").eq("contract_status", "minted").limit(limit);
  if (worksError) throw worksError;
  const collectionIds = [...new Set(works.map((work) => work.nft_collection_id))];
  const { data: collections, error: collectionsError } = collectionIds.length
    ? await service.from("nft_collections").select("id,standard,chain_id,contract_address,deployed_code_hash,state")
      .in("id", collectionIds).eq("chain_id", config.wallet.chainId).eq("standard", "ERC721")
    : { data: [], error: null };
  if (collectionsError) throw collectionsError;
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));
  const [{ data: checkpoint, error: checkpointError }, { data: accounts, error: accountsError }] = await Promise.all([
    service.from("chain_indexer_checkpoints").insert({
      worker_name: "resale-ownership-v1",
      chain_id: config.wallet.chainId,
      from_block_number: finalized.blockNumber.toString(),
      from_block_hash: finalized.blockHash,
      through_block_number: finalized.blockNumber.toString(),
      through_block_hash: finalized.blockHash,
      finalized_block_number: finalized.blockNumber.toString(),
      finalized_block_hash: finalized.blockHash,
      provider: "configured-rpc"
    }).select("id").single(),
    service.from("smart_accounts").select("id,chain_id,account_address").eq("chain_id", config.wallet.chainId)
  ]);
  if (checkpointError || accountsError || !checkpoint) throw checkpointError || accountsError || new Error("INDEXER_CHECKPOINT_FAILED");
  const accountByAddress = new Map(accounts.map((account) => [account.account_address, account.id]));
  let indexed = 0;
  let skipped = 0;
  for (const work of works) {
    const collection = collectionById.get(work.nft_collection_id);
    if (!collection || !["rehearsal", "active"].includes(collection.state)) {
      skipped += 1;
      continue;
    }
    const bytecode = await client.getBytecode({ address: collection.contract_address, blockNumber: finalized.blockNumber });
    if (!bytecode || keccak256(bytecode).toLowerCase() !== collection.deployed_code_hash) throw new Error("COLLECTION_CODE_HASH_MISMATCH");
    const owner = (await client.readContract({
      address: collection.contract_address,
      abi: OWNER_OF_ABI,
      functionName: "ownerOf",
      args: [BigInt(work.nft_token_id)],
      blockNumber: finalized.blockNumber
    })).toLowerCase();
    const record = {
      chain_id: config.wallet.chainId,
      collection_id: collection.id,
      collection_address: collection.contract_address,
      token_id: String(work.nft_token_id),
      work_id: work.id,
      owner_address: owner,
      owner_smart_account_id: accountByAddress.get(owner) || null,
      ownership_state: owner === getAddress("0x0000000000000000000000000000000000000000").toLowerCase() ? "burned" : "owned",
      finality: "finalized",
      source_kind: "snapshot",
      source_event_id: null,
      source_checkpoint_id: checkpoint.id,
      observed_block_number: finalized.blockNumber.toString(),
      observed_block_hash: finalized.blockHash,
      projected_at: new Date().toISOString()
    };
    const { error } = await service.from("token_ownership_projection").upsert(record, { onConflict: "chain_id,collection_address,token_id" });
    if (error) throw error;
    indexed += 1;
  }
  return { indexed, skipped, finalized_block_number: finalized.blockNumber.toString(), finalized_block_hash: finalized.blockHash };
};
