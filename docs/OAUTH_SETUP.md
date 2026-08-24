# Social access setup

Grove Marketplace — New York accepts curator access only through Instagram or X. The site never accepts an email/password form, social password, or scraped account data.

## Shared Supabase setup

1. Apply the Grove migration and set the Supabase Site URL to the production Grove origin.
2. Allow the exact app callback for production and each reviewed preview: `https://<grove-origin>/api/auth/callback`.
3. Each provider app sends its callback to Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Use PKCE, HTTPS, least-privilege scopes, and provider consent. The Vercel app needs only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; provider secrets stay in Supabase.
5. Keep `GROVE_*_OAUTH_ENABLED=false` until staging proves consent, cancellation, callback, refresh, sign-out, revocation, and deletion.

## Instagram

- Create a Meta app using the current official **Instagram API with Instagram Login** flow.
- Confirm which account types are eligible during Meta review; the current professional-account API may not cover every personal account.
- Request only `instagram_business_basic` unless a reviewed product feature genuinely requires more.
- Configure a Supabase custom OAuth provider named `custom:instagram`, enable PKCE and optional email, and map the permitted provider ID, name, username, and profile-picture URL into user metadata.
- Add app website, privacy-policy, terms, and data-deletion URLs required by Meta. Do not request messages, contacts, publishing, or unrelated media permissions for joining.

## X

- Create an X OAuth 2.0 app with Authorization Code + PKCE and the Supabase callback above.
- Configure Supabase’s `twitter` social provider with the X client ID and secret.
- Request `users.read` for the authorized profile. If X or Supabase requires any additional scope, show it in consent and review it before enabling the flag.
- Add the production website, privacy-policy, terms, and callback URLs to the X app.

## Profile and privacy boundary

`auth.users` and provider identities remain inside Supabase Auth. The database trigger accepts only Instagram or X identities and copies only:

- display name;
- profile photo URL;
- handle;
- provider and provider subject ID.

It does not copy email, phone, credentials, social graph, messages, tokens, or media into the public curator record. No scraping or ambient chat monitoring is present.

Before either flag is enabled, publish a privacy policy and deletion route, choose a documented retention period for private discoveries, and implement an authenticated deletion process that removes the Supabase Auth user and cascaded Grove records. Recommended launch default: purge archived discovery drafts after 90 days; retain published sale/provenance records only for the legally required period and describe that exception clearly. Verify Vercel/Supabase log retention separately.

## Verification

- Consent names only approved scopes.
- Cancel returns to `#join` without a profile.
- Success initializes the granted name/photo/handle and no unsupported field.
- Direct email/password and anonymous signup are disabled in Supabase.
- Sign-out clears the session; provider revocation is handled.
- Account deletion and retention behavior match the published policy.

Official references: [Supabase custom OAuth providers](https://supabase.com/docs/guides/auth/custom-oauth-providers), [Supabase Twitter login](https://supabase.com/docs/guides/auth/social-login/auth-twitter), [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/), [X OAuth 2.0 + PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), and [X authenticated profile lookup](https://docs.x.com/x-api/users/lookup/quickstart/authenticated-lookup).
