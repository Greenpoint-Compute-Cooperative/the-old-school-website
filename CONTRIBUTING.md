# Contributing

Marketplace & Auction House of Brooklyn is curator-led, art-first, and intentionally small. Contributions should make the real product clearer, safer, faster, or easier to operate—not simulate an integration that does not exist.

## Golden path

```sh
npm ci
npm run dev
npm run ci
```

`npm run dev` serves the interface at `http://localhost:8013`. Use `vercel dev --listen 8013` after `vercel env pull .env.local --environment=development --yes` when testing API routes. Social OAuth and acquisition remain unavailable unless their documented flags and credentials are genuinely configured.

Development and pull-request deployments use the synthetic preview Supabase project. Follow [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md); never repoint Preview or Development variables at production.

## Make a change

1. Start from `main` and use a focused branch such as `feature/curator-inbox` or `fix/work-card-focus`.
2. Keep the interface image-led and the copy concrete. Do not add slogans or generic marketplace filler.
3. Preserve the curator gate, physical/digital parity, crypto-first direction, and honest pending states.
4. Add or update tests. Database changes require a new timestamped migration; never edit a migration already applied to production.
5. Run `npm run ci`, then check both a desktop and phone layout.
6. Open a pull request with proof and a rollback path.

## Data and integrations

- Never commit `.env.local`, provider keys, Supabase secrets, wallet material, or private artist records.
- Never collect a social password, scrape an account, or bypass provider consent.
- Product events use one browser-session UUID, not a persistent visitor ID. Do not add fingerprinting, advertising IDs, raw IP storage, full referrers, social handles, wallet addresses, or submitted artwork copy to analytics.
- Any OAuth, payment, mint, media import, notification, or delivery integration must fail closed until real credentials and authoritative status exist.
- New public tables need row-level security, explicit grants, indexes for expected queries, and retention/deletion behavior.

## Product definitions

- **Discovery:** a curator’s private candidate link or introduction.
- **Sponsorship:** the named curator recommendation required before a work can be published.
- **Work:** physical, born-digital, or paired physical + digital art.
- **Acquisition:** an authoritative payment or on-chain state—not a button click.
- **Bazaar:** the monthly in-person program at 29 Nassau Avenue.

Architecture, metrics, and operations live in `docs/`. Security reports follow `SECURITY.md`.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
