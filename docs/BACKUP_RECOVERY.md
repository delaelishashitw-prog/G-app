# Church backup and recovery

The reviewed super administrator uses **Settings → Backup & Maintenance**. Other staff and members cannot list or export these records, including through direct RPC requests. Provider keys, login sessions and Auth credentials never enter recovery files.

## Daily record points

`gwcc-daily-record-recovery` runs in Postgres at **03:00 UTC/GMT**. It keeps seven daily points and two manual points in `gwcc_private.recovery_points`. Manual creation is limited to two points in ten minutes. Status shows the configured job, last run outcome, creation dates, record counts and rehearsal dates. Points older than 36 hours trigger a notice. There is no email/SMS notification or external sending.

The coverage manifest includes all 34 application tables: public record tables, `gwcc_documents` (assets, budgets, foundation school, pastoral visitations, counseling and intercessory watches), profiles and roster notifications, and private finance references, SMS dispatch claims and sync recovery receipts. Idempotency receipts remain with the records so an operator can prevent duplicate financial posting or SMS submission during recovery. New public/private application tables fail capture visibly until the manifest is reviewed and updated. The recovery tables themselves are excluded to avoid recursive growth.

Capture reads all covered tables in one PostgreSQL statement, using a consistent MVCC snapshot. Ordinary record writes continue during capture. It streams JSON by primary key instead of sorting full photo payloads or repeatedly rebuilding all previous modules. A failed capture leaves previous points intact. Creation/export have a 30-second administrator API allowance and record rehearsal has 45 seconds; ordinary role timeouts remain unchanged. Each payload has a SHA-256 checksum, schema migration revision, table counts and a 40 MB bound; retention only deletes older recovery copies. These points are inside the same project and do not protect against project deletion or complete database loss.

## Independent encrypted file

1. Create a fresh recovery point and select it.
2. Choose and confirm a separate passphrase of 12–256 characters.
3. Download the encrypted file and save it outside the app/project. Keep the passphrase separately; the app cannot recover it.
4. Choose the saved file, enter its passphrase and use **Check recovery file**.

The browser verifies the cloud checksum, exact table coverage and row counts, then preserves the actual bytes of every listed `gwcc-media` object. Missing files, unknown buckets, unsafe paths, changed storage metadata and excessive sizes stop the download instead of silently producing an incomplete archive. Storage metadata is checked before and after file reads; use a fresh point if objects changed. Embedded data-URL photos remain intact in records. External URLs are retained as references and their externally hosted content is not fetched or copied. Historical storage object versions are not available through these record points.

The file also preserves the current account’s complete pending-change export, including full embedded photos, operation IDs, original versions and recovery IDs. It contains this device’s allowlisted financial display preferences and service times; it excludes browser authentication tokens and provider/Supabase keys. Other devices’ unsynced changes must be exported on those devices.

Encryption uses Web Crypto AES-256-GCM with a fresh 12-byte IV, a fresh 16-byte salt, and PBKDF2-SHA256 with 310,000 iterations. A fixed authenticated format label prevents interpreting another ciphertext format as a recovery file. The passphrase is kept only in component memory and cleared after successful download/check; it is never sent to the server or saved in browser storage. The archive is bounded to 64 MB plaintext / 96 MB file size; individual storage objects are limited to 20 MB, total downloaded storage to 30 MB, and pending device data to 20 MB. Larger datasets require the administrator database/storage procedure.

File checks decrypt locally, validate all data checksums/coverage and reject another project or database identity when connected status is available. They do not submit changes or restore cloud rows. Old version-1 partial JSON exports remain readable as ordinary JSON but are not falsely labelled complete recovery files.

**Restore this device’s pending changes** is available only to the backup’s original signed-in account. It reuses the durable owner-scoped outbox restore and preserves operation IDs. Restored work is held for review; the operator uses the existing pending-change controls before explicitly retrying sync. File checking and pending restoration never send SMS or process payments.

## Rehearsal and cloud restoration

**Rehearse selected point** reconstructs every table independently in isolated temporary tables with current columns, constraints and indexes, and compares all round-tripped values. Live tables, financial triggers and SMS handlers are not invoked. Only a successful rehearsal timestamp is saved. A checksum, schema or constraint failure remains visible; no live records are replaced. This is a record reconstruction test, not proof that all historical business relationships are valid.

Cloud restoration is an administrator operation, separate from file verification. Restore into an isolated project/database first, using the checked-out schema revision and the original Auth identities when available. Reconcile record links, account balances, historical orphaned rows, immutable delivery claims and applied-operation receipts before promotion. Do not replay recovered money records through the ordinary posting triggers, resend recovered SMS claims, import old access policies, or restore profiles as new privileged login accounts. Re-verify account links and authorisations. Keep the current live database and each device’s pending changes before any reviewed cutover.

Use Supabase’s project backup/restore tools for full database/Auth recovery, and independently preserve Storage object binaries, Edge Function sources/configuration and securely managed secrets. App record files do not contain SQL schema, Auth accounts/passwords, sessions, provider keys or a complete server configuration. This release does not purchase a backup plan or claim an independent unattended off-site destination has been configured.

## Deployment and verification

Apply the additive migration, verify `pg_cron` is installed, and check `cron.job` has the exact named active daily job. Create the initial daily point with `SELECT gwcc_private.backup_capture('daily')` from a privileged database session; do not export real payloads into logs. Deploy the frontend after the migration. Check metadata, checksum consistency, role denial, retention, and a record rehearsal without changing live records. The public RPC wrappers are security invokers; guarded implementations and payload tables remain in the unexposed private schema with RLS and revoked direct access.

Automated tests use synthetic data and cover encryption round trips, full photos and ledger preservation, wrong passphrases, changed ciphertext, incomplete modules, storage failures, foreign project/database rejection, staff/anonymous/disabled/unreviewed account denial, daily/manual retention, future-module coverage failures, isolated reconstruction, mobile/desktop downloads and owner-scoped pending restoration. No real SMS, payment, invitation or live record restoration is exercised.

References:

- https://supabase.com/docs/guides/cron/quickstart
- https://supabase.com/docs/guides/platform/backups
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
