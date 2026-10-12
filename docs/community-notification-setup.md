# Community notification activation

## Release order
1. Run `supabase/community-notifications.sql` once in the academy Supabase SQL Editor. It is transactional and rerunnable; it does not notify students about historical posts.
2. Deploy this commit after the migration succeeds. Existing `RESEND_API_KEY`, `RESEND_FROM`, and `PLATFORM_URL` are reused. `PLATFORM_URL` must be the academy origin.
3. Validate with dedicated test accounts: an admin post creates one alert per non-admin profile; a direct reply alerts the post author; a targeted reply alerts only that reply's author. Do not publish a test post to the real community without intending to notify students.

## Behaviour
- Only admin-created posts/replies create the new alerts. Edits and self-replies do not.
- The target is derived on the server/database from a reply in the same discussion, never an arbitrary recipient supplied by the browser.
- In-app alerts use the existing bell, refresh at most every 30 seconds while visible, and open the relevant discussion/reply.
- Emails contain only the Arabic notification sentence, the existing inline gold logo, and the platform homepage URL. No content previews or discussion links.
- `community_notification_inbox()` preserves old notification history and student notifications while suppressing new duplicate admin events from legacy triggers. Legacy triggers are intentionally left untouched because their definitions are maintained outside this repository.
- Notification reads and read-state updates are restricted to `auth.uid()`. Email addresses and jobs are service-role only.

## Delivery and retries
Post requests start a background worker. Visible platform visits resume the queue at most once per minute per server instance. The database globally spaces claims; each delivery has a lease and stable Resend idempotency key. Failed jobs wait at least one minute. Ambiguous deliveries older than 23 hours are held rather than duplicated.

For unattended retries and queues larger than one request can drain, configure an external scheduler to POST `/api/admin/community-emails` once per minute with `Authorization: Bearer <LESSON_EMAIL_WORKER_SECRET>`. This is optional infrastructure, not configured by this commit. An authenticated admin may also call the endpoint to resume pending jobs. Do not put the secret in browser code or the repository.

## Verification
- `node --test tests/community-emails.test.cjs tests/lesson-emails.test.cjs`
- `PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node tests/community-notifications-db.mjs`
- `npx tsc --noEmit`
- `npm run build -- --webpack`

No production emails were sent during local testing. Live database trigger definitions and live delivery require verification after activation.
