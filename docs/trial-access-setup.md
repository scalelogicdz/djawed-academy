# First-module trials

The Students form has Full access and 7-day trial choices beneath course selection.
Trials require exactly one course. The server saves the first non-hidden module
with lessons (position, then ID) at creation; changing module order cannot expand
an existing trial. Existing sequential lesson order still applies within it.

Apply `supabase/trial-access.sql` in the existing Supabase project's SQL Editor.
It is transactional and re-runnable. It creates the database rules, service-only
creation/upgrade functions, and a pg_cron job every five minutes. Until this
migration succeeds, the trial choice is disabled and the API refuses to create
trials. Existing full access continues working before and after migration.

Expiry starts at account creation, lasts exactly seven days and uses the database
clock. Access ends immediately at expiry, including the next viewing heartbeat.
Permanent account deletion follows on the next successful cron run, normally
within five minutes. Profiles and dependent data cascade with Auth deletion.
Students see the deletion date in Algeria time before using the preview.

In the Students table, use **فعّل الوصول الكامل** to upgrade a trial. This is a
transactional database operation and keeps the same account/progress. It cancels
expiry and sets an irreversible `ever_full_access` protection flag. Cleanup and
upgrade lock the same profile row. Existing accounts, admins and any account ever
granted full access are excluded from automatic deletion. A deleted trial cannot
be resurrected by a late upgrade. Existing full accounts cannot be downgraded
into deletable trials.

Trial restrictions apply in the request proxy, server pages, viewing API (start
and heartbeat), feature endpoints and restrictive PostgreSQL RLS. Direct REST
reads of lessons are disabled for trials: server-side allowlisted projections
deliver only first-module video metadata and course-outline metadata. Other
modules have blurred, unlinked lessons; community, support, profiles, services,
quizzes, downloads and notifications are restricted. Authentication, logout,
language display, browser tracking and first-module learning progress remain.
Public marketing pages remain public. Provider-side video/domain/token settings
are not changed by this migration; platform access control is not DRM.

Monitor:
```sql
select jobname, schedule, active from cron.job where jobname='delete-expired-djawed-trials';
select jobid, status, return_message, start_time from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='delete-expired-djawed-trials')
order by start_time desc limit 10;
```

To pause permanent cleanup (expiry restrictions remain enforced):
```sql
select cron.unschedule('delete-expired-djawed-trials');
```
Re-run the migration to restore scheduling. Do not rerun earlier notification or
security-policy migrations after this one without reapplying this migration.

Validation: TypeScript, production build, regression tests and isolated PostgreSQL
RLS tests. No real students are created/deleted by the tests.
