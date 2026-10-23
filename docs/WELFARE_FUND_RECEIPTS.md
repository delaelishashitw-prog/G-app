# Adding welfare funds without a member name

In **Welfare → Add to Fund**, enter the amount, receipt date, source, reference and a short source note. Sources include carried-forward funds, dues without a member breakdown, anonymous donations and other welfare funds. Record only money that is not already in the ledger.

A super administrator, senior pastor or finance officer can record these receipts. Administrators and pastors can view their history. Ordinary members cannot access the fund receipt register.

**Welfare Fund Balance = member dues + confirmed additional fund receipts − recorded relief payouts.** Event appeal funds stay separate. Individual member dues, joining dates, arrears and benefit eligibility are unchanged by fund receipts. Bank and MoMo accounts must be reconciled separately; a fund receipt does not move money or post another treasury transaction.

Receipts are admitted to the account-scoped durable sync queue before the form closes. New receipts enter the balance only after cloud confirmation. If the connection or confirmation fails, use **Retry sync**; the same operation and receipt IDs are retained across reloads. If device storage fails, keep the form open and use **Retry same receipt**. Check existing receipts and pending changes before entering a replacement.

**Fund Receipts** and **Audit Report** show the source, date, amount, reference, note, confirmation state and the server-verified recorder. Saved amounts cannot be edited or deleted. A super administrator or senior pastor can void a confirmed receipt with a reason, then record a replacement. A pending void retains the confirmed amount until accepted. The original receipt and void details remain in history.

## Implementation and verification

`welfare_fund_receipts` is a namespace in the existing RLS-protected `gwcc_documents` store, already covered by recovery backups. Writes go through `gwcc_apply_mutations`, with existing role, live-session/MFA, transaction, operation checksum and retry controls. The preparation function accepts a fixed field list, validates positive amounts to two decimals and dates up to today in Ghana, derives identity/timestamps, enforces unique references and requires a current version for changes. No member or treasury account fields are accepted. The migration adds no actual financial entries.

Validation includes unit tests, the full migration suite in PGlite, and browser checks for desktop/mobile, role controls, member standing, audit totals, reload, duplicate submission, lost confirmation, preserved void history, pending balance semantics and device storage failure.
