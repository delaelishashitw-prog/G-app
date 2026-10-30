# Priority audit corrections

This release addresses confidential member notes, child check-in retries, financial device-save failures, and premature Giving receipts.

## Confidential notes

`members.notes` stays in place. Its direct SELECT privilege is removed from browser roles. Directory reads explicitly select the remaining columns; RLS still restricts rows. Super Admin, Senior Pastor and Pastor retrieve notes through `gwcc_member_notes`, an invoker wrapper around a private function that verifies the current reviewed role and account security. Other roles cannot read or overwrite the field. Older directory updates with empty notes preserve existing private content.

Normal mutation replies, old idempotency receipts, legacy recovery replies and member self-profile replies redact notes for other roles. Device caches and pending member views also remove notes from those roles. This does not revoke copies downloaded before the correction. The migration does not rewrite members, financial records, balances, authentication accounts or pending operation hashes.

## Child check-in and pickup

Each form keeps a stable request ID. A failed or reopened check-in resumes a matching retained request with its original record ID, tag, timestamp and payload. An entry confirmed by background sync opens its existing pass. Different details under the same pending request require review rather than generating another tag. Both device admission and cloud acknowledgment must succeed before issuing a pass or confirming pickup. Checkout retries preserve the original collector and use Africa/Accra time. Account changes stop publication into the new account.

## Financial saves and receipts

Ordinary Giving, church income, payment requests, account creation, transfers, corrections and reversals are planned against isolated arrays. The app publishes pending records and predicted balances only after durable device admission. Failed admissions retain the form and exact pending intent. Batch Giving uses one admission and database transaction. New forms use stable UUIDs; retries retain their payload and operation identity.

Financial dialogs await admission before resetting or closing. A newly saved Giving entry remains provisional until its cloud response is received. The official receipt follows the current saved record, disables print/copy while pending or voided, and displays no official receipt paper until confirmed. Existing financial approval and independent payment controls remain in force.

## Validation and rollout

Tests cover real PostgreSQL column permissions, authorized note access, own-profile and historical retry redaction, preservation of existing notes, repeated migration execution, lost child responses, reopened forms, account changes, Ghana checkout time, and failed financial admissions. Browser checks exercise lost child replies at 390/1440px and real IndexedDB write failures, preserved financial input, and receipt enablement after cloud confirmation.

Apply the permission migration to staging, verify access controls and unchanged data digests, and repeat on production with the matching frontend. Older cached clients using `SELECT *` must refresh after deployment. Confirm the exact GitHub head passes the full verify workflow and the production dependency audit before merging. Verify the live deployment's commit, routes, health endpoint and published bundles.

Other audit items (shared service schedules, real staff QR passes, the disabled Test Access control, Settings bundle size and Supabase leaked-password protection) remain separate work.
