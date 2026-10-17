# Member portal access

Members use a verified email address and their own password at `/portal`. Member IDs, phone numbers and legacy PINs are not authentication methods.

## Administrator workflow

1. Sign in as the reviewed super administrator.
2. Open **Members**, select the correct person, then choose **Portal Access**.
3. Enter the person's own email and choose **Check account status**. Checking never sends an email.
4. Review the person's name and email. Confirm ownership using the checkbox.
5. For a new account, choose **Send invitation and link account**. For an existing member account, review the account shown and choose **Link existing member account**; this sends no email.
6. The member opens the invitation, verifies the email, sets a password of at least 12 characters and continues to **Member Portal**.

The administrator can reopen the control to see whether an account is awaiting email verification or ready to sign in. A pending account can receive a new invitation after its recipient is reviewed again. A verified member can request a password reset from **Forgot password?** on the portal. The reset response does not disclose whether the email has an account.

Each member needs a separate login email. A staff account, a suspended account, an account assigned to another member, or an archived/deceased/transferred member record cannot be linked through this workflow. Existing staff access is never converted into member access. Review disabled accounts separately in **Users & Roles**.

The login email can differ from the directory contact email; this control does not silently edit contact details. Collect missing emails directly from members. No bulk invitations are sent automatically.

## Email delivery

Invitations and resets use Supabase Auth's email service, with `/auth/password` on the configured application origin as the redirect. The production origin is `https://g-app-pi.vercel.app`. Confirm that this URL is allowed in Supabase Auth redirect settings and that a production email sender is configured before inviting the congregation. Provider errors are shown; requesting an invitation does not prove delivery to the inbox. Live delivery requires an explicitly selected recipient and is not exercised by automated tests.

If sending succeeds but linking fails, the control says so. Check status again and review/link the existing account instead of creating another identity. No Auth account is deleted automatically during recovery. Invites are not queued for offline replay.

## Security and verification

`/api/staff` verifies the caller's active, reviewed super administrator profile and rate limit before account lookup, invitation or linking. Supabase's privileged Auth credential stays on the server/Edge Function. Neither user-editable Auth metadata nor name/email matching grants access to personal records.

The database links the exact Auth UUID in a transaction. It locks the member and profile, checks that the target is an enabled member account with the expected Auth email, prevents replacement or reuse of an assigned login, updates both link fields and writes an audit entry. The `SECURITY DEFINER` implementation is in an unexposed private schema; the public RPC uses `SECURITY INVOKER`. Existing ownership policies continue to restrict members to their own records, and unverified/disabled identities remain unable to read them.

Tests cover invitation preflight, literal email matching, existing-account linking, staff/disabled/banned/archived accounts, duplicate/changed identities, retries and partial failures, database authorization and ownership isolation, mobile controls, password reset, and the invitation password setup → member portal flow. Browser fixtures use synthetic identities and mock delivery; no real member email or password is used.

Family detail rows and the application footer wrap on narrow screens so opening a member's Portal Access does not leave an overflowing page behind the dialog.

## Member event registration and profile

Members receive public event details and only their own RSVP through `gwcc_member_events`. Full event rows, other attendees' contact information and event budgets remain available to authorized staff. Member registration uses `gwcc_member_rsvp`; the database derives identity from the verified account, locks the event, preserves existing attendees and returns the saved registration. Exact member IDs (or an existing exact member code) identify an RSVP. Matching names do not establish identity. Retrying an interrupted confirmation does not append another attendee. Cancelled, completed and past events reject new registrations.

The portal confirms registration only after this server response. It displays a retryable error when confirmation fails. Member requests require a connection. Older unsuccessful event changes remain preserved for review in the account's pending storage, but are neither replayed as staff writes nor displayed as confirmed registrations. Cached full event lists from an older client are ignored; refresh or reopen the portal after this release.

Profile fields initialize when the linked member record loads or the inspected member changes. Saving can clear optional addresses and emergency contacts. The contact email is read-only with guidance to contact the church office; it may differ from the Auth login email. Staff preview is read-only for profile editing and event registration. Account passwords continue to be managed through Supabase Auth.
