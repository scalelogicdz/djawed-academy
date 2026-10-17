# Support request email notification

New successful support requests schedule a branded email using existing RESEND_API_KEY, RESEND_FROM and PLATFORM_URL configuration. The email shows the submitted student name and subject, the existing logo, and the platform homepage. The full private message stays in the admin support page.

By default the server resolves the email of the sole profile with is_admin=true through the auth directory. It refuses to guess if there are zero or multiple admins. Set SUPPORT_NOTIFICATION_EMAIL to one explicit owner address to override this lookup. This variable is server-only.

Deploy after checks pass; no SQL migration is needed. Submit a genuine support request and check the owner's inbox and admin support page. Tests mock delivery and send no real emails.

Background delivery retries transient/network errors up to three times with the same provider idempotency key. Permanent failures or exhausted retries are logged using only the request ID; the saved support request remains available and the student still sees success. This is bounded delivery, not a durable email queue: prolonged outages require operator follow-up from saved support requests.

## Community alerts to the owner

New student-created community posts and replies also email the same resolved owner address. Admin-authored activity does not self-notify; existing admin-to-student notifications are preserved. Edits and deletions do not send new email alerts. Community emails include only the event notice, existing logo, and platform homepage link.

Both types reuse the same server-only recipient configuration and bounded delivery retries described above. If more than one admin exists, configure SUPPORT_NOTIFICATION_EMAIL explicitly; do not add students as recipients. No database migration is needed. Verify live delivery after deployment with a genuine student post/reply and a support request; tests mock email delivery.
