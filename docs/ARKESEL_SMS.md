# Arkesel SMS connection

The Communication page can submit reviewed SMS drafts to Arkesel and query provider delivery reports. Saving a draft still never sends it. WhatsApp remains manual, and SMS scheduling is not enabled.

## Activate the connection

Create and verify an Arkesel account, obtain approval for a sender name and generate an app-specific SMS API key. Set these in **Supabase → Edge Functions → Secrets** for the project that hosts `gwcc-sms`:

| Secret | Value |
| --- | --- |
| `ARKESEL_API_KEY` | The app-specific Arkesel API key |
| `ARKESEL_SENDER_ID` | The exact approved sender name, for example `GWCC` |
| `ARKESEL_SMS_ENABLED` | `true`, after approval and credit setup |

Never put provider or Supabase server credentials in `VITE_*`, source code, local storage, message drafts or chat. The deployed function reads secrets at runtime; the Vercel frontend needs no provider key. Set `ARKESEL_SMS_ENABLED=false` to stop new submissions while retaining history and delivery checks.

Open Communication, reload SMS status and use **Check connection — no SMS sent**. This checks the account balance API; it does not verify carrier approval of the configured sender. An administrator can then explicitly authorize one charged test SMS to their own Ghana mobile number. All automated regression checks use synthetic requests and never send messages.

## Sending and permissions

Reviewed, active super administrators, senior pastors and administrators can approve sends. Pastors and ministry leaders can prepare drafts and read delivery history. Other staff and members cannot access SMS history or send endpoints. Supabase Auth `getUser`, protected profiles and database role checks enforce access independently of the interface. Credentials remain in the backend.

Save the SMS draft and wait for cloud confirmation. **Review SMS send** resolves the current directory audience on the server, shows the exact message, recipients, exclusions and estimated segments, and requires a separate acknowledgement of permission and provider charges. Sender IDs must match the configured approved name. Directory changes require saving/reviewing again; changed phone numbers invalidate the review. Ghana mobile numbers only are supported by this connection; international and landline contacts appear as SMS exclusions. The directory is never rewritten.

Opening or reopening **Review SMS send** focuses the review panel and brings it below the fixed header on mobile and desktop. Reopening checks the audience again and requires fresh consent. **Reload history** refreshes delivery records without clearing a successful connection check, the current review or its consent; a failed history reload preserves those controls too. A full page reload or an explicit SMS status reload still requires a new provider connection check.

Limits are 200 recipients, 10 segments per recipient, 500 estimated segments per submission, 1,000 estimated segments per rolling 24 hours across the app, five submissions per minute and three connection tests per destination in 24 hours. Estimates account for GSM-7 extension characters and UTF-16 Unicode units; the provider determines final billing. Failed and ambiguous attempts count conservatively toward limits.

## Delivery, retries and records

A private database claim is committed before the provider request. Repeating an operation ID never makes another provider request; changing its data is rejected. The same draft/message/sender/phone snapshot also has a unique fingerprint across operation IDs. To deliberately send the same announcement again, copy it to a new draft and review it explicitly.

Provider acceptance is recorded separately from handset delivery. Partial rejection and unknown outcomes remain visible per recipient. **Check delivery reports** calls Arkesel's authenticated batch report API using only stored provider IDs and verifies the recipient before updating a status. Delivered/failed/rejected terminal records are not downgraded. No unauthenticated callback endpoint or automatic background sending is exposed.

Timeouts, malformed responses, function interruption or an unavailable result write never cause automatic resending. An unresolved claim remains visibly unconfirmed; check the provider dashboard before creating another draft/send. This intentionally favors avoiding duplicate charged messages over automatic recovery of uncertain submissions.

Message snapshots, exact recipients, actor and timestamps remain in the private dispatch ledger. Original drafts retain their separate lifecycle; historical imports are not relabeled as delivered. No finances, existing drafts or directory contacts are modified by activation.

## Deployment

Deploy the additive migration, then the `gwcc-sms` Edge Function with `verify_jwt=false` and its pinned import map. Authentication is performed in the handler; disabling the gateway's legacy JWT check does not make the handler anonymous. Deploy the frontend/API proxy after the backend. The function shares the reviewed server handlers in `server/sms.js`, `server/smsWeb.js`, `server/smsProvider.js` and the SMS segment estimator. Include those files and `server/security.js` in the function bundle.

Official references:

- https://developers.arkesel.com/
- https://arkesel.com/bulk-sms-api-developers-ghana/
- https://arkesel.com/sms-length-and-unicode/
- https://supabase.com/docs/guides/functions/secrets
