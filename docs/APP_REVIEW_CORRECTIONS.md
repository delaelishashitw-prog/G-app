# App review corrections

The member portal and pledge reminders use shared, finance-approved giving instructions. Device-only MoMo/bank settings and embedded example account numbers are no longer used.

## Approve official payment instructions

1. A verified Super Admin, Senior Pastor or Finance Officer opens **Church Finance → Holding Accounts & Treasury → Official member giving channels**. Super Admin and Senior Pastor can also open the financial tab in Settings.
2. Select an existing bank or MoMo account. Confirm its receiving number and registered account holder name with the church.
3. Enter the registered holder name, check the confirmation and select **Approve giving channel**. Publication requires a confirmed online save.
4. Check the member portal's **Tithes & Giving** tab and a pledge reminder. Until a channel is approved, both direct people to the church office.

Inactive accounts are not published. Changes to the approved account's number, provider, type or currency hide its instructions until finance staff approve the current details again. Disabling a channel also removes it from the portal. The member projection contains payment instructions only; balances, ledger descriptions and approval actor information remain private. Lost confirmations retry the same operation ID.

## Cell reports

Small Groups starts with actual saved reports and zero figures when none exist. New attendance and offering inputs start at zero. Report totals and the recorded staff identity are validated by the server. Reports are retained in `gwcc_documents` under `cell_meeting_reports`, with the existing durable, account-scoped outbox and complete recovery backups.

A report closes only after the device preserves it. Its pending state remains visible until cloud acknowledgement, including after reload. Failed device saves keep the form open. Reported offerings are observations, not confirmed treasury receipts; finance staff record and reconcile receipts separately. The monthly offering summary uses the meeting date. Saved report history cannot be deleted or overwritten through sync.

## Counseling and membership

New counseling writes use `counseling_sessions`. The checked mutation RPC also accepts the old `pastoral_counseling` operation name and returns an explicit canonical-table acknowledgement. This recovers existing queued operations without changing their payloads, IDs or retry receipts. The client propagates the confirmed version to later unattempted canonical writes. Permissions are still checked against the canonical counseling dataset.

Counseling dialogs mount for the selected new/edit record and require an explicit counselee choice. Removing a ministry or cell assignment sends explicit null values for both its ID and name, so a refresh does not restore the old assignment.

## Connection failures and access

A transient transport failure keeps an already verified identity in memory only while its signed access token is unexpired. It does not establish access from cached local flags or permit an offline cold start. The background check leaves an open form mounted. Reconnection checks the account again; rejection, revocation, MFA requirements and token expiry clear access. Pending outbox records remain owned by their original account.

Super Admin now receives the same event scheduling controls as the other authorized event managers.

## Verification and rollout

Run `npm run verify` and the production dependency audit. Database tests cover approval roles and privacy, stale requests and identical retries, account-change invalidation, canonical cell report totals, preserved financial balances, legacy counseling recovery after a lost response, and null assignment persistence. Browser checks include mobile member payment instructions, pending report reload/retry, counseling submission, event scheduling, interrupted channel approval, and form preservation across connection loss and reconnection. All fixtures are synthetic.

Apply the app review corrections migration before publishing the new frontend. This migration adds guarded functions and document support without rewriting application records or publishing any existing account automatically. Confirm row counts and digests around rollout and run the Supabase security advisor.

Leaked-password protection remains a separate Supabase Auth dashboard setting. The connected database tools cannot change Auth provider configuration. Supabase documents this feature as available on Pro plans and above; no plan upgrade is part of this release.
