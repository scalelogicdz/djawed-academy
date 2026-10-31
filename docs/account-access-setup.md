# Browser and viewing limits

This change implements two registered browsers per account and one active lesson player per account. It does not implement COD orders, QR cards, activation codes or delivery tracking.

## Rollout

1. Run `supabase/account-access.sql` in the existing Supabase project's SQL Editor. It is idempotent and initially leaves enforcement disabled. Re-running it never changes the enabled setting.
2. Deploy the matching application code. Existing credentials remain `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `PLATFORM_URL`. No new required secrets. Never expose the service-role key to the browser.
3. After deployment, enable with:

```sql
update public.account_access_settings set enabled=true where singleton;
```

4. Use a test student to log in with two browsers. A third must see `/devices` instead of course content. Test the email replacement on the account's real mailbox, and start a lesson in both allowed browsers to verify that the old player disappears.

Do not enable before the new code is deployed: existing Auth sessions need the application to bind them to browsers. Both student and administrator accounts follow the same limit. To roll back enforcement without deleting registrations:

```sql
update public.account_access_settings set enabled=false where singleton;
```

## Behavior

- The first two browsers that log in (or revisit with an existing Auth session) register automatically. Signing out does not free a browser slot. It signs out only the current Auth session.
- A one-year HttpOnly Secure SameSite=Lax cookie identifies the browser with a random secret. Only its SHA-256 hash is stored. No IP address or fingerprint is used. Labels use only coarse browser/OS names.
- Clearing cookies, private browsing, another browser profile, or another browser can count as a new browser. Device cookies must not be shared or copied.
- A third browser remains authenticated only for recovery. App pages/API routes block access; restrictive RLS policies also deny direct authenticated content queries from unbound/revoked Auth sessions.
- `/devices` is available from the student's own profile, including on a blocked browser. The student chooses an old browser, receives a six-digit code at the Auth account email, and enters it in that same new browser/login session. The old browser stays active until successful verification.
- Email codes expire after ten minutes, allow five guesses, are hashed with an HMAC, and can be consumed once. Requests are limited in the database to one per minute and three per hour. Failed email delivery does not allow replacement. A successful replacement starts a seven-day account-wide cooldown. A newly issued code invalidates older codes.
- Registration/replacement/viewing changes serialize on the account's profile row. A replacement revokes old Auth-session bindings and any viewing lease atomically. The retired browser cannot silently register again. Another replacement requires email verification and a completed cooldown.
- A lesson's explicit Start action obtains a new viewing lease. Starting elsewhere replaces it; old heartbeats and cleanup cannot reclaim or delete a newer lease. Old players check every five seconds and unmount on conflict, device revocation, network failure or stale verification. Hidden pages stop their player to avoid background timer throttling. The database lease expires after thirty seconds without a heartbeat.
- Enrollment, hidden modules and sequential lesson locks are checked before issuing a player URL. A blocked or stopped viewer can explicitly restart, taking over the account's viewing session again.

## Scope and limits

Player shutdown is detected on the next heartbeat, normally within five seconds. There can be a brief overlap while an already playing client receives that result. These are browser/account access controls, not DRM: a deliberately modified client, copied Auth session/cookie, screen recording, or a publicly accessible provider URL cannot be made impossible by this feature.

The current library remains Bunny Stream `744754`; Vimeo lessons are supported too. Optional `BUNNY_STREAM_EMBED_TOKEN_KEY` signs new Bunny iframe URLs if Embed View Token Authentication is enabled for that same library. Do not set the key to a different Bunny API key. Token expiry restricts loading the iframe, not continuous stream revocation. Provider-side token authentication and allowed-domain restrictions need configuration in Bunny; this change does not alter provider settings or pretend to provide media-level DRM.

Public lead submissions stay public. The existing lesson/community email workers retain their explicit scheduler-secret authentication; other application APIs require a registered browser. Private device tables/RPCs are service-role-only, with authenticated users allowed only the read-only RLS predicate.

## Validation

```sh
npx tsc --noEmit --incremental false
node --test tests/*.test.cjs
npm install --no-save --no-package-lock --ignore-scripts @electric-sql/pglite@0.3.14
node --test tests/account-access-db.mjs
```

The database tests use an isolated PostgreSQL-compatible engine and mock Auth schema; they never connect to production or send emails. They exercise SQL grants/RLS, two-browser admission, replacement/OTP limits, revocation and playback takeover. Client-hook tests cover removal of a superseded/offline player, cleanup races and background-page shutdown. Production delivery and native Bunny/Vimeo playback still require the smoke test above.
