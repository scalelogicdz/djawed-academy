# Security hardening

Deploy order: apply `security_capabilities`, deploy the matching app, then apply
`private_profile_policy` (also provided as `supabase/private-profile-policy.sql`).
The public community directory returns only explicitly public profile fields.
Raw profiles are restricted to the owner or an MFA-qualified administrator.

Login and lead-form throttles use shared atomic database counters, keyed by HMAC
rather than raw IP addresses, email addresses or phone numbers. Unavailable
security checks fail closed. Expired counters are removed daily.

New or changed passwords submitted through the admin student API require 10–128
characters and are checked against Pwned Passwords using the range protocol.
Only the first five characters of a SHA-1 hash leave the server. This is app-level
screening; Supabase's paid native leaked-password feature remains disabled on
the free plan and direct provider password changes do not use this app check.

The administrator must open `/admin-security`, scan the QR code in an
authenticator app and confirm its six-digit code. Until enrollment is verified,
the current administrator retains access to avoid lockout. Once enrolled,
admin API checks and database policies require an `aal2` session. No factor,
secret or recovery code is created or retained by deployment scripts.
Keep the authenticator available; recovery requires the Supabase account owner.

Validation: unit tests, TypeScript, isolated PostgreSQL policy/concurrency tests,
production build and live role-scoped access checks. Video-provider settings
and DRM are outside these changes; this is not a guarantee of complete security.
