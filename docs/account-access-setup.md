# One viewer and admin browser counts

Scope: one active lesson-viewing session per account, plus observational browser counts for the owner. There are no browser limits, replacement workflows, verification emails, cooldowns, automatic warnings, watermarks, COD features or order tracking.

## Deploy

Run the latest `supabase/account-access.sql` in the existing Supabase SQL Editor before deploying. If you ran an earlier version, rerun this updated script: it removes the rejected browser-blocking policies and turns off the old device-limit setting. Old private records are left inert rather than deleted.

Deploy the application, then enable the viewing restriction:

```sql
update public.viewing_access_settings set enabled=true where singleton;
```

The script starts with viewing enforcement disabled and preserves that setting on reruns. Emergency rollback is the same statement with `enabled=false`; browser counts continue regardless. Existing Supabase credentials suffice. No email configuration or new mandatory secrets are needed.

## Student experience

Students may log in on any number of browsers and use the rest of the platform freely. Starting a video obtains one account-wide lease, across all lessons. If another player is active, an Arabic confirmation asks whether to continue here and stop the other session. Cancel leaves the current viewer untouched. Confirm replaces the lease. Previous players stop on their next heartbeat, normally within five seconds. Renewals and releases from an old player cannot reclaim or delete the new lease.

Server checks retain enrollment, module visibility and sequential lesson locking. Auth sessions are validated against Auth before lease changes. Network failure, stale verification or a hidden tab stops its player. Leases expire after thirty seconds without renewal. There is no waiting period for switching back.

## Admin experience

The Students table has an Arabic “Active browsers / last 90 seconds” column for every student. Expand a nonzero count to see coarse browser/OS names, last activity and page paths. Multiple active browsers are highlighted for manual review. The existing live-students panel shows the same badge. The owner decides whether to contact the student; the platform sends no warning automatically.

Presence updates every twenty seconds on visible platform pages; admin counts refresh every ten seconds. “Connected” means a browser sent a heartbeat within ninety seconds, not all permanently logged-in devices. Closed/background/offline browsers disappear after that window. Multiple tabs share an opaque, one-year HttpOnly cookie and one database record per account/browser. Clearing cookies, another browser profile, or another browser can look like a new browser, even on the same physical device. A multi-browser count is an observation, not proof of sharing.

Cookie hashes and active browser rows are private to server code. Only authenticated admins can fetch the summarized details. No IP addresses, precise hardware fingerprints, passwords, full user-agent strings or URL query parameters are stored. Old records are pruned on the account's next heartbeat after thirty days. Failed/missing presence data is displayed as unavailable, never as a false zero.

These controls reduce casual sharing; they are not DRM or a guarantee against copied provider URLs or deliberate client modifications. Bunny/Vimeo provider security settings are unchanged. Optional `BUNNY_STREAM_EMBED_TOKEN_KEY` remains supported for the existing Bunny library `744754` if its embed-token authentication is configured separately.

## Checks

```sh
npx tsc --noEmit --incremental false
node --test tests/*.test.cjs
npm install --no-save --no-package-lock --ignore-scripts @electric-sql/pglite@0.3.14
node --test tests/account-access-db.mjs
```

Tests use isolated mocked Auth and PostgreSQL-compatible data, without production connections or sending emails. After enabling, smoke-test with a test student in two browsers: verify both are counted, a second lesson asks before takeover, and the old player stops. Check two tabs of the same browser count once, and closed browsers disappear after ninety seconds.
