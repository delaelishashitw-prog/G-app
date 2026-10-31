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

## Shared service timetable

The member portal now derives its next gathering from the shared active `services` records. It uses the same next/live occurrence calculation as the Services page, displays dates and times in Africa/Accra, includes the following day's date for overnight meetings, and updates the current occurrence every 30 seconds. Refresh, window focus and reconnection reload the shared records. Failed or offline refreshes label retained times as a saved timetable; loading, unavailable and confirmed empty schedules have distinct messages.

Settings now lists those same service records and links to the existing Services editor. Cell fellowship times remain managed for each group in Small Groups. The old free-text localStorage timetable fields no longer determine advertised times and are not automatically imported into church records. No database migration or service-record rewrite is required for this correction.

Browser regression checks edit a synthetic service as an administrator and verify the shared result in a new member session. They cover Ghana time on devices in other time zones, live/end boundaries, inactive and archived services, overnight dates, loading and failed reads, offline/reconnect behavior, legacy device values, member permissions and 390/1440px layouts.

## Member attendance passes

The staff pass and member portal now generate the same QR code locally. The versioned payload contains a stable member record reference, without names, phone numbers or email addresses. Existing passes containing the exact public Member ID still resolve. Ambiguous, malformed, unrelated, archived, deceased, transferred and unconfirmed member references are rejected. A pass is an attendance lookup reference; it grants no login, staff permission or child pickup authority.

Attendance's staff check-in screen supports a camera, a local PNG/JPEG/WebP image, or scanner/keyboard input. Camera permission is requested only after selecting Scan with camera. A match displays the directory member for staff confirmation, then uses the current service/date and records the `qr_code` method through the existing authorized attendance flow. Duplicate confirmations and repeated passes cannot add another entry for the same session. Failed new reads clear the earlier selection. Closing, canceling, a successful read or a changed session stops the scanner and its camera tracks, including a late permission response.

Printed passes contain the pass alone, with a black-and-white QR code and no fabricated verification badge. The member portal no longer sends Member IDs to an external QR-image service. No database migration or live attendance rewrite is required. New dependencies are pinned with the lockfile.

Tests decode screenshots of the actual portal and printed QR codes with the independently implemented scanner, decode synthetic camera video, require confirmation, check duplicate clicks and separate services, test legacy and invalid codes, denied/pending camera permission and cleanup, isolate printing, and verify staff permissions and mobile/desktop layout. These tests create no live attendance records and use no physical camera.

## Staff access review

The broken Test Access/Simulate controls in staff cards, table rows and dossiers now open a read-only Review Access dialog. It shows the selected profile's role grants, plus suspended, directory-only or administrator-review requirements. Active member profiles do not falsely claim staff approval. The reviewer keeps their own authenticated identity; reviewing a profile performs no sign-in, identity switch, permission change, staff update, message send or audit mutation. Actual sign-in still requires the account owner's verified email and security checks. The intentionally disabled authentication simulation compatibility APIs remain disabled.

The review, permissions matrix and dossier use one complete module-label catalog and the existing `ROLE_PERMISSIONS` grants used by navigation. Missing areas such as Welfare, Giving, Services, AI Assistant, Tasks and Member Portal now appear. Module inclusion is described separately from permission to read individual records or perform actions. Dossiers no longer claim that an active, unreviewed profile is fully authorized to sign in.

Tests cover catalog coverage against all live client role grants, profile requirements, all three launch points, current and protected profiles, root identity/token preservation, zero mutation or authentication requests, non-root restrictions, keyboard focus and mobile/desktop layout. No account, role, database schema or live record changes are needed for this correction.

## Settings page loading

The Settings page no longer embeds the complete SQL migration and repeated repair scripts in its JavaScript. The generator also emits a separate JSON data asset containing one migration string and one repair string. The database tools fetch this asset only after the Supabase PostgreSQL Hub opens. Identity, Appearance, Services and the other ordinary tabs do not request it. The Settings-specific JavaScript falls from about 3.20 MB to 99 KB uncompressed (about 97%); shared application dependencies are separate from this comparison.

While scripts load, connection settings remain usable and SQL copy, preview and download actions stay disabled. Failed requests show a retry action that preserves unsaved connection details. Switching away cancels an unfinished request; successfully loaded scripts are reused while Settings remains open. Copy success appears only after the clipboard write succeeds, and a failed clipboard write offers retry or a full-script download. The SQL tool buttons wrap on narrow screens. Generated script contents, SQL permissions and database records are unchanged.

Regression checks enforce a 150 KB Settings entry budget, no script requests on ordinary tabs, delayed loading, failed-request recovery with preserved drafts, identical copied/previewed/downloaded bytes, clipboard denial, loaded-data reuse and 390/1440px layouts. A separate hash-based test compares both generated data strings with every canonical SQL export. CI checks both generated files for drift.

## Leaked-password protection status

Read-only production checks on 31 October 2026 found that native Supabase leaked-password protection remains disabled and the organization uses the Free plan. [Supabase requires Pro or above for this feature](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This audit item remains blocked by the plan; no paid upgrade or Auth setting was changed. Enabling it requires a separately authorized paid-plan decision and a subsequent Auth configuration check.


## Giving deposits, department limits and receipt copying

Church Finance has a Giving Deposits tab. Finance staff select confirmed, active GHS Giving receipts and either link existing treasury income (including a matching service cash count), or explicitly create a new deposit. Linking existing income preserves its account credit; new deposits post once. Historical receipts are not automatically assigned. Each operation verifies the current finance role, reviewed account, live MFA, receipt versions, available income capacity and date. A shared money lock and immutable operation receipt protect concurrent or interrupted requests. Active links prevent changing a Giving receipt until its treasury income is voided. Links remain in the protected documents namespace and existing recovery backups, including voided allocation history.

Linked income carries the amount already represented by Member Giving. Reports subtract that portion from institutional income so the same receipt and deposit cannot inflate combined revenue. The treasury ledger still shows the complete account movement and exports its linked amount. Partial allocations and deposit dates in another reporting period are handled separately from the original giving date.

Each department budget has an optional payment limit. Existing budgets remain monitoring-only. When enabled and confirmed by the database, the limit blocks posting expenditure or disbursements above the allocation for its department, period and currency, including an explicit budget-ID reassignment. Requests and approvals can still be recorded; they do not reserve the allocation. A documented reversal releases the posted amount. Enabling a limit below already posted spending is rejected. Budget settings now enter durable device storage before the form closes, with a stable ID for retry.

Receipt and voucher copy controls await clipboard completion, prevent duplicate clicks, and report permission failures without claiming success. A late response after a receipt closes does not publish a toast for another receipt. Browser checks cover both receipt screens, preserved budget input after storage failure, Giving allocation read failures, existing/new deposits, lost response retries, reload, allocation history and 390/1440px layouts. Database checks cover balance effects, idempotency, stale/duplicate/unavailable receipts, unauthorized sessions, linked receipt protection, backup coverage and atomic payment-limit enforcement. All fixtures are synthetic.

Rollout requires the matching database migration before the frontend. Verify staging and production metadata and financial digests before and after the migration, then release only the exact CI-tested source. No existing balances, receipts, allocations or budget policies are rewritten by the migration.
