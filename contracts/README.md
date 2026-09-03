# Grove collection contracts

These are **Sepolia candidates**, not audited production deployments.

- `Grove721`: immutable work identity and one-of-one issuance to a dedicated inventory Safe.
- `Grove1155`: immutable work identity, hard edition cap, and full-cap issuance to the inventory Safe.

Both use OpenZeppelin 5.6.1 and deliberately exclude checkout, auctions, buyer-fund escrow, upgradeable proxies, forced
transfers, transfer pausing, and royalty-enforcement claims. Each complete `ipfs://` token URI is stored exactly as
configured. `workId` is a PII-free canonical binding and `issuanceId` is domain-bound and replay protected. Auctions open
only after the mint is finalized and the inventory owner/balance is reconciled.

## Verify locally

```sh
git submodule update --init --recursive
npm ci
npm run contracts:test
```

## Testnet deployment candidate

Use a fresh low-balance deployer. `GROVE_ADMIN_SAFE` and `GROVE_INVENTORY_SAFE` must be separate reviewed 2-of-3 Safes.
The script pins their Safe proxy and singleton by manifest address, runtime code hash, and version. Registrar, minter, and
pause guardian must be distinct from both Safes and each other; the deployer receives no role.

```sh
export ETHEREUM_SEPOLIA_RPC_URL='...'
export DEPLOYER_PRIVATE_KEY='...'
export GROVE_ADMIN_SAFE='0x...'
export GROVE_REGISTRAR='0x...'
export GROVE_MINTER='0x...'
export GROVE_PAUSE_GUARDIAN='0x...'
export GROVE_INVENTORY_SAFE='0x...'
export GROVE_EXPECTED_CHAIN_ID='11155111'
export GROVE_SAFE_SINGLETON='0x...'
export GROVE_SAFE_PROXY_CODE_HASH='0x...'
export GROVE_SAFE_SINGLETON_CODE_HASH='0x...'
export GROVE_SAFE_VERSION='1.4.1'
export GROVE_SAFE_FALLBACK_HANDLER='0x...'
export GROVE_SAFE_FALLBACK_HANDLER_CODE_HASH='0x...'

forge script contracts/script/Deploy.s.sol:Deploy \
  --root contracts \
  --rpc-url "$ETHEREUM_SEPOLIA_RPC_URL" \
  --broadcast \
  --verify
```

Never put the private key, Safe addresses, transaction artifacts, or RPC credentials in Git. Mainnet deployment requires
the exact release commit to pass fuzz/invariant/static analysis, Sepolia rehearsal, independent audit, reproducible
bytecode verification, and documented role handoff.
