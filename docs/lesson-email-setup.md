# New lesson emails

The admin's Add Lesson form has a Notify students checkbox. Only new lessons trigger emails; edits never do. Recipients are students enrolled in that lesson's course at save time. Each receives a private email with the lesson title in the subject. The body shows the Arabic new-lesson heading, the introduction, and the lesson title, with the golden Djawed Logic logo below the title and a plain platform homepage link below the logo. The link opens sign-in or the dashboard. The logo is embedded as a Content-ID attachment using an immutable copy of the original PNG, so it does not depend on fetching an image from the platform. There is no direct lesson button or lesson link. Previously attempted messages retain their original template on retry to preserve provider idempotency.

## Activation

1. In Resend, verify a sending domain (for example `notifications.djawedkhalfaoui.com`) and add the DNS records Resend provides. Create a sending API key.
2. Run `supabase/lesson-emails.sql` in the project's Supabase SQL editor. The migration is safe to rerun. It creates a private delivery ledger and service-role-only functions. Do not grant these functions to students.
3. Add server environment variables in Vercel production, then redeploy:
   - `RESEND_API_KEY`: the sending key.
   - `RESEND_FROM`: a verified sender, e.g. `Djawed Logic <lessons@notifications.djawedkhalfaoui.com>`.
   - `PLATFORM_URL`: `https://academy.djawedkhalfaoui.com` (not the landing-page domain).
4. Confirm the email option is enabled in Admin → Lessons. Test with a temporary course containing only an administrator-controlled student account. Add a lesson with notification checked; confirm receipt and the link after sign-in. Editing the lesson must not create another email. Do not test against the live student roster.

## Delivery and recovery

Lesson creation and the recipient snapshot are atomic. If queue creation fails, the lesson is not saved. A worker runs immediately after save for up to 35 seconds. Admin delivery counters refresh every five seconds. “Accepted” means Resend accepted the email, not guaranteed inbox delivery. Resend's dashboard shows delivery/bounce details.

For larger cohorts or automatic failure recovery, configure a scheduler to POST `/api/admin/lesson-emails` once per minute with `Authorization: Bearer <LESSON_EMAIL_WORKER_SECRET>`; add that same high-entropy secret to Vercel. Without a scheduler, use the admin “Process remaining notifications” button when pending/failed messages remain. Do not place the secret in client code or URLs.

A database lease excludes concurrent workers; each delivery has a permanent unique lesson/student record and stable Resend idempotency key. Successful deliveries are never resent. Uncertain sends are retried within the provider's 24-hour deduplication window. After 23 hours they are held for manual review, to avoid accidental duplicate emails. Check Resend logs before resolving held records. Course access removed after publication also holds the notification. Deleted lessons remove their queued emails.

No emails are sent for existing lessons, and configuration is checked before the checkbox is enabled. No email API secrets are exposed to the browser. The platform design and theme are unchanged.
