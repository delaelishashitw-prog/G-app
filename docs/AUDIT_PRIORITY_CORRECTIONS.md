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

Other audit items (the disabled Test Access control, Settings bundle size and Supabase leaked-password protection) remain separate work.
