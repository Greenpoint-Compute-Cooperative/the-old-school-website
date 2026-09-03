# Grove collection contracts

These are **testnet candidates**, not audited production deployments.

- `Grove721`: immutable work configuration and idempotent delivery for one-of-one tokens.
- `Grove1155`: immutable work configuration, hard edition caps, and idempotent delivery for editions.

Both use OpenZeppelin 5.6.1 and deliberately exclude checkout, auctions, buyer-fund escrow, upgradeable proxies, forced
transfers, transfer pausing, and royalty-enforcement claims. Each complete `ipfs://` token URI is stored exactly as
configured. `orderId` must be a PII-free hash domain-bound to chain ID, collection, acquisition line, token, recipient,
and quantity.

## Verify locally

```sh
git submodule update --init --recursive
npm ci
npm run contracts:test
```

## Testnet deployment candidate

Use a fresh low-balance deployer. `GROVE_ADMIN_SAFE` must be the reviewed 2-of-3 admin Safe. Admin, registrar, minter,
and pause guardian must be four distinct addresses; the deployer receives no role.

```sh
export BASE_SEPOLIA_RPC_URL='...'
export DEPLOYER_PRIVATE_KEY='...'
export GROVE_ADMIN_SAFE='0x...'
export GROVE_REGISTRAR='0x...'
export GROVE_MINTER='0x...'
export GROVE_PAUSE_GUARDIAN='0x...'
export GROVE_EXPECTED_CHAIN_ID='84532'

forge script contracts/script/Deploy.s.sol:Deploy \
  --root contracts \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast \
  --verify
```

Never put the private key, Safe addresses, transaction artifacts, or RPC credentials in Git. Mainnet deployment requires
the exact release commit to pass fuzz/invariant/static analysis, Base Sepolia rehearsal, independent audit, reproducible
bytecode verification, and documented role handoff.
