# Security upgrade and release validation

This release fixes the reviewed code paths. Production readiness also requires applying the database upgrade, reviewing existing staff access, configuring hosting secrets, and reconciling historical records. Those live operations have not been performed by the code changes.

## Before deployment

1. Back up the Supabase database and storage. Export data from every browser used for offline work, while the previous app version is still available. The new app deliberately does not trust or automatically import unscoped legacy browser caches, local staff passwords, or local identity flags. Preserve exports privately; do not commit personal records to Git.
2. Test this release in a separate Supabase project or database branch and a Vercel preview. Do not point a preview with test data at the production project.
3. Identify existing staff Auth UUIDs and intended roles. Previous profile roles may have been editable by clients. This upgrade requires a database-owner review before a legacy staff role can authorize access. New Auth signups always start as members.
4. Reconcile opening account balances, prior transfers and reversals, welfare receipts and payouts, and member numbers against source records. Code fixes do not repair money already misstated or recover people overwritten by earlier ID collisions. Compare questionable sample-looking rows with backups; never delete real records using name or ID heuristics.

## Database upgrade

For a fresh project, apply all files in `supabase/migrations` in filename order. The generated `SQL_MIGRATION_SCHEMA` in the app contains that same sequence inside one transaction; the final security migration closes the earlier historical access policies. No demo congregation or financial seed data is inserted.

For an existing project with the core church tables already installed, take the private logical snapshot and apply the security upgrade inside the same database-owner transaction. The mitigation and administrator preparation can already be present:

```
supabase/release-snapshot.sql
supabase/migrations/20261015194232_secure_operations_release.sql
```

Run it as the project database owner inside a transaction (or through the Supabase migration runner). Check the migration history before running older files. The in-app repair buttons all use the same secure upgrade; old permissive repair instructions must not be reused. The upgrade is repeatable and tests verify that applying repair SQL again neither reopens anonymous access nor changes balances.

The snapshot script locks application writes through cutover and stores the original public table rows, checksums, schema/security definitions and storage metadata in `gwcc_release_backup_20261015`. Browser roles and the service role cannot access this private schema. Repeating the script preserves its first snapshot. This same-database logical recovery copy does not replace a physical backup or point-in-time recovery, and it contains no browser-only pending entries or storage object binaries. Do not automatically restore its old access policies; retain the security restrictions when reconciling individual records.

The standalone mitigation can run first on a legacy project while the complete release is being prepared. It removes unsigned table/routine access and anonymous media policies, fixes existing helper search paths and view execution, and revokes direct profile mutations. Signed-in table grants and account balances are preserved. Legacy code that relies on unsigned database access or writes profiles directly will receive permission errors. This mitigation does not replace the full role/ownership and checked-mutation upgrade.

The upgrade also handles the inspected SQL Editor installation with no migration history: it creates missing welfare appeal tables without replaying older permissive policies. Legacy directory records keep their IDs, names, contact emails and history, but records without an exact Auth UUID become directory-only. A separate safe member profile is created for each Auth account. Matching email addresses never copy staff authority. Email uniqueness applies to login profiles, so a historical directory contact cannot block the real account's profile. Review the exact Auth profile before authorizing staff. A directory record cannot be converted into a login by toggling a checkbox.

The migration adds checked mutation RPCs, idempotency records, persistent API limits, account-owned records, missing finance/welfare columns and persistent roster notifications. Direct browser writes to public tables are denied. Finance triggers adjust both sides of a transfer in a transaction and reject overdrafts. Existing account balances are preserved as migration baselines. Existing paid welfare claims retain their paid amount as a legacy baseline so they cannot silently become payable again.

Run `supabase/bootstrap-super-admin.sql` after replacing its `chosen_user` placeholder with the intended **verified Auth UUID**. The script refuses to run with an empty or unverified account. Then sign in as that administrator and review each staff profile through Users & Roles. Authorization requires `authorization_reviewed_at` for staff; it does not accept an old name, email, local role or signup metadata claim.

When administrator activation must precede the coordinated upgrade, apply `supabase/migrations/20261015182900_prepare_reviewed_administrator.sql` first, then run that same bootstrap script for the confirmed verified Auth UUID. This adds the protected review fields and audit attribution without changing another account's role. The full security upgrade preserves the reviewed administrator and must still be deployed with the new application.

Link each member to their verified Auth UUID using `members.auth_user_id`. A super administrator's account invitation can link the selected member. Do not link by a partial name or phone number. Review old staff rows whose IDs differ from Auth UUIDs; preserve directory/history records, but do not authorize those rows as login identities.

The `gwcc-media` storage bucket becomes private. Review any previously distributed public media links and existing storage policies. The upgrade replaces policies with the `gwcc_` prefix; remove any unrelated custom policy that grants broader access to this bucket. External access to old copies cannot be revoked by changing application code.

## Hosting and Auth

Configure these variables on the intended deployment:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Public browser configuration, set before building |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Server authentication against that same Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only staff invitations and password resets; optional on Vercel when the protected Edge Function is deployed |
| `APP_ORIGIN` | Canonical HTTPS app origin, used for invitation redirects |
| `ALLOWED_ORIGINS` | Optional additional trusted origins for API requests |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional AI provider credentials and enabled model |

Set the Supabase Auth site URL to the app origin. Allow `<APP_ORIGIN>/auth/password` as a redirect URL for invitations and password resets. Configure working Auth email delivery and a minimum password length of at least 12. Test an actual invitation and recovery email with a staging account. Email delivery and external AI calls cannot be established by local mocks.

Deploy `supabase/functions/gwcc-staff` with its `deno.json` and the shared `server/staff.js`, `server/staffWeb.js`, and `server/security.js` dependencies. Its public app origin must match `APP_ORIGIN`. Supabase supplies the server-only credential to the function; Vercel forwards the caller's bearer token to the fixed endpoint for the configured project after checking the reviewed root profile and request origin. The destination verifies Auth and the protected profile again and consumes the persistent quota once. Gateway `verify_jwt` is false to support current user JWT signing keys; the shared `getUser` authentication and reviewed-root checks remain mandatory. No privileged key is sent to Vercel or the browser.

Keep signup either disabled or restricted according to the church's account policy. Public signup, when enabled in Supabase, creates only member access. Staff promotion requires the checked administrator operation.

Deploy frontend and server functions from the same release. On Vercel, keep the Vite build output as `dist`; the checked-in `/api` functions serve AI and staff operations. Roster notifications use Supabase and require no WebSocket service. The optional `supabase_realtime` publication improves latency; polling provides a fallback.

SMS delivery and scheduling remain unavailable until a real provider adapter, credentials, provider message IDs and delivery callbacks are configured and tested. Current communication actions save drafts and do not mark messages delivered or deduct fictional credits. No SMS was sent as part of the fixes. Member giving forms likewise do not process payments or issue verified receipts.

## Staging acceptance

- An unsigned browser cannot read member, giving, welfare, audit or roster records. Wrong passwords, forged browser flags, unverified email and suspended/unreviewed staff accounts cannot authorize access.
- A member sees only their linked records, can update allowed contact fields and respond to their own duty assignments, and cannot manage staff or write verified financial receipts.
- A reviewed administrator can invite a staff account and update its role/status; suspending it revokes access on the database immediately. Existing UIs revalidate profiles periodically and on focus. Confirm sign-out clears private cached records.
- Record and void an income, expense and transfer in staging. Verify both account balances, ledger history, and reports. Attempt an overdraft, duplicate operation ID and stale update; each must fail without a partial balance change.
- Create, correct and void a linked welfare contribution. Disburse an approved claim against a real holding account. Confirm receipts, payouts and account balances agree.
- Take a signed-in device offline, make an ordinary permitted entry, reload and reconnect. Confirm the pending record remains and retries once. A rejected batch must stay visible; export it before using the explicit discard-and-reload option. It must never be silently replaced by a pull.
- Check more than 1,000 records and a completely empty table. Verify missing records do not reappear from old local arrays or sample data.
- Create a duty assignment, reopen the member portal and verify ownership and read state. Create a child check-in and confirm that duplicate active tags, unlisted collectors and repeated checkout fail. Release only after a confirmed save.
- Test invitation, recovery, account suspension and AI against the actual staging services, then use a production backup and a defined maintenance window for rollout.

## Review findings addressed

| Finding | Change |
| --- | --- |
| F01, F18 | Deny anonymous table access; replace permissive repair scripts; ownership helpers avoid private `auth.users` joins under the caller |
| F02–F04 | Verified Auth sessions, protected roles, reviewed staff activation and immediate database checks for suspended access |
| F05 | Shared authenticated AI handler and persistent per-account rate limits in both deployments |
| F06 | Matching treasury, giving, welfare and operational schema; generated SQL from migrations |
| F07, F12, F13 | Durable owner-scoped outbox, idempotent batches, conflict/export UI, complete paginated reads and empty-result replacement |
| F08, F09 | Pure ledger planning before React setters; atomic database balance effects, two-sided reversals and reliable pledge receipt creation |
| F10 | Linked welfare receipt corrections/voids and treasury-validated disbursements saved together |
| F11 | Active-only financial summaries and treasury expenses included alongside legacy expense history |
| F14 | Empty production state; no automatic sample merge, heuristic purge, financial wipe or seed reset |
| F15 | Honest persistent drafts; no simulated SMS delivery, scheduling or credit balances |
| F16 | Persistent Supabase roster notifications and verified own-account response/read operations |
| F17 | Cryptographic pickup tokens, active uniqueness, guardian matching and server-confirmed checkout |
| F19 | UUID record keys, centrally allocated member/tithe numbers, collision checks and atomic rollback |

The final pass also escapes user-supplied asset tag fields in printed HTML and provides a working invitation/recovery password setup route.

## Verification limits

`npm run verify` runs TypeScript checks, unit/regression tests, real PostgreSQL semantics via PGlite, production builds, and Chromium smoke checks on mobile and desktop. Browser tests use synthetic Supabase responses; PostgreSQL tests use isolated local databases. They do not prove the live Supabase Auth configuration, live email delivery, hosting secrets, Realtime deployment, provider billing or the accuracy of historical church records.

Technical references: [Supabase database function security](https://supabase.com/docs/guides/database/functions) and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
