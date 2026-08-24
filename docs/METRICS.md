# Product metrics

The marketplace measures whether curators discover and sponsor strong work, collectors understand and approach acquisition, and the monthly bazaar creates real participation. It does not optimize for empty page-view volume.

## Instrumentation boundary

- One random UUID lives in `sessionStorage` and disappears with the browser session.
- No persistent visitor ID, cross-site cookie, fingerprint, full referrer, raw IP, social handle, wallet address, artwork link, artist name, submitted note, or form copy is stored.
- Global Privacy Control and `Do Not Track: 1` disable client events.
- The browser posts an allowlisted event and coarse properties to the same origin. The server validates origin, size, names, values, timestamp, and rate; resolves a curator ID only from a valid Supabase session; then writes through a server-only RPC.
- Raw events have RLS and no public grants. Operator summaries require `GROVE_METRICS_READ_TOKEN`.
- Production retention is 180 days through a daily authenticated Vercel Cron job.

This is product telemetry, not a substitute for a published privacy policy or data-request process.

## Event dictionary

| Event | Meaning | Entity / coarse properties |
|---|---|---|
| `page_view` | A hash route rendered | Route only |
| `work_viewed` | A real work detail route rendered | Work slug |
| `curator_viewed` | A curator profile rendered | Curator ID |
| `exhibition_viewed` | An exhibition rendered | Exhibition ID |
| `bazaar_viewed` | Bazaar route rendered | Bazaar ID |
| `discovery_saved` / `discovery_unsaved` | Prototype or live discovery state action | Discovery ID, state |
| `discovery_sponsored` | Curator starts sponsorship from a discovery | Discovery ID |
| `discovery_filter_changed` | Curator changes inbox state | Filter |
| `work_filter_changed` | Visitor changes format filter | Filter |
| `draft_started` / `draft_reviewed` | Curator enters and reviews a local draft | Source, format; never form content |
| `join_started` | Configured provider consent is opened | Provider |
| `join_unavailable` | A provider is visibly unavailable | Provider/state |
| `join_completed` / `join_cancelled` | OAuth returns an authoritative result | Provider/state |
| `acquisition_preview_opened` | Visitor opens the honest purchase preview | Work slug, method |
| `acquisition_method_changed` | Visitor switches crypto/card preview | Work slug, method |
| `calendar_saved` | Bazaar calendar file downloaded | Bazaar ID |
| `client_error` | A browser error occurred | Error kind only; no message or stack |

## Decision metrics

### Curator activation

- Sessions reaching Discoveries.
- Discovery save rate: saved discoveries ÷ discovery-route sessions.
- Sponsor intent rate: sponsored discoveries ÷ discovery-route sessions.
- Draft review rate: reviewed drafts ÷ started drafts.
- Once OAuth is live: new curators with a first discovery, first sponsor, and first published work within 1/7/30 days; weekly active curators; cohort retention; median time from discovery to sponsorship.

### Marketplace and collection

- Work-detail rate: sessions with a work view ÷ marketplace sessions.
- Acquisition-preview rate: acquisition previews ÷ work views, split by physical/digital/paired and crypto/card.
- Top works by distinct sessions and acquisition intent.
- Format-filter demand.
- Once checkout and contracts are authoritative: checkout start/completion, wallet rejection, wrong-network failure, card failure, reconciled GMV, editions minted, fulfillment time, refunds, and zero supply/inventory incidents.

Button clicks are never counted as sales, mints, ownership, or revenue.

### Bazaar

- Bazaar views and calendar-save rate.
- Later: RSVP completion, checked-in attendance, exhibitor participation, QR-to-work engagement, sales/mints attributed to the event, and repeat attendance.

### Reliability and trust

- Health-check availability, function error rate, database failures, and client-error sessions.
- Rights-review backlog, incomplete provenance, pending contracts, unavailable media, and support resolution time.
- OAuth cancellation/error rate and deletion/revocation completion once providers are enabled.

## Read the dashboard feed

Pull production environment variables into the ignored `.env.local`, then run the report. The founding operator’s non-exportable Vercel token is mirrored in macOS Keychain under `Marketplace & Auction House / metrics-read-token`; the script also accepts the legacy service name during migration. Other authorized operators should receive their token through the team password manager, never GitHub or chat.

```sh
npm run metrics -- --days=30
```

The protected `/api/metrics?days=30` response contains exact distinct sessions, signed-in curators, engagement depth, curator/member/collection/bazaar funnels, daily activity, top routes/works, coarse format/provider/method/error breakdowns, and operational status counts for 1–90 days. It exposes aggregates only and is never called by the public interface.

The terminal report prints the dashboard in this order:

1. Traffic quality: sessions, engaged sessions, high-intent sessions, error sessions, and events per session.
2. Funnels: discover/save/sponsor/draft/review; join/start/complete; market/work/preview; bazaar/calendar.
3. Content: event totals, top works, top routes, and daily trend.
4. Mix: work format, acquisition method, OAuth provider, draft format, and client-error kind.
5. Operations: curator, discovery, sponsorship, work, acquisition, and bazaar records by lifecycle state.

## Interpretation limits

- A session is not a unique person; one person can create several sessions.
- Privacy signals, blockers, network loss, and disabled JavaScript reduce counts.
- Prototype discovery/save/sponsor actions currently measure interaction intent, not persisted curator operations.
- Small cohorts should be reviewed qualitatively rather than ranked aggressively.
