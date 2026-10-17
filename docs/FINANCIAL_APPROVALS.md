# Expense and payment approvals

New expenses, disbursements and internal transfers in Church Finance are payment requests. The signed-in account and server time identify the requester. Typing a name does not approve a payment.

## Staff access

A reviewed, active super administrator, senior pastor or finance officer can request a payment, review another person's request and record an approved payment as paid. These accounts require verified email and two-factor authentication. A requester cannot approve or reject their own request. The person recording payment may be the requester or approver; the authorization always requires two different people.

Set up a second trusted staff login in Users & Roles, review the appropriate finance role, and have that person complete two-factor setup. Do not share passwords or authenticator codes. Directory contacts without login accounts cannot approve requests.

## Process

1. Use **Request Expenditure** or **Internal Transfer**. Select the holding account, amount, payee/destination, date and purpose. The request can await cloud sync on its original device.
2. Open **Approvals & Payments**. After cloud confirmation, another authorized staff member reviews the exact details and chooses **Approve request** or rejects it with a reason.
3. Make the approved payment outside the app. The app does not send bank or MoMo payments.
4. Choose **Record payment as paid**, enter the bank, MoMo or signed cash payment reference and confirm the actual payment. The cloud records the actor and time, posts the ledger movement once and enables the payment voucher.

Requests and approvals do not debit an account, spend a budget or reserve funds. The account must have sufficient funds when payment is recorded. An internal transfer updates both accounts in the same transaction. Approval/payment/rejection/cancellation actions require an internet connection and a cloud-confirmed request.

Saved request terms are fixed. To correct them, cancel the unpaid request with a reason and submit a replacement. A rejected request also needs a replacement. Every decision uses the latest saved version: another person's action makes an older review stale. Interrupted confirmations can retry the same immutable operation; retries and stale actions cannot post a second payment. A payment reference is supporting evidence; operators must still check whether the same real-world payment has already been recorded under a different request.

Only a super administrator or senior pastor can void a paid request with a reason. A void reverses its balance effect and preserves the original requester, approver, payment recorder and history. A paid request linked to a welfare claim requires a coordinated claim correction and cannot be voided by this generic action.

## Historical records and welfare links

The rollout does not change old receipts or balances. Previously entered approval names are labelled historical information, without claiming an authenticated approval. Historical outbound receipts may be voided with a reason; their payment terms cannot be rewritten. The old unlinked expense book is read-only; new expenses use the treasury workflow.

A new welfare payout submits a linked payment request. Its claim disbursement total changes only when the approved request is recorded as paid. The claim, receipt and account update together, and the remaining approved claim amount is checked again at payment time. Existing welfare eligibility, dues and historical payouts are unchanged.

The protected request history lives in the finance row and is included automatically in the existing encrypted export and recovery-point table coverage. It cannot be replaced through the browser's general sync API. The public action is a security-invoker wrapper around a private implementation; it verifies the current protected role/MFA session before touching data.

## Verification

Database regression tests cover independent review, self-review denial, MFA/role revocation, forged identity/history, direct-write denial, rejection/cancellation, stale decisions, exact retry receipts, insufficient funds, transfer reversal, historical preservation, backup coverage and competing welfare requests. Browser tests use synthetic accounts and provider-free fixtures on desktop and phone layouts, including interrupted payment confirmation and immutable retries. No real payments, staff invitations or production account impersonation are used for testing.
