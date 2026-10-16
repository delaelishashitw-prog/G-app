# Church Finance controls

The Church Finance page displays recorded treasury balances. Actual bank and MoMo statements and a physical cash count are required to reconcile those balances. The Reconciliation tab compares opening balances plus all posted ledger movement with the current recorded balances, and flags missing account links and historical repeated references. It does not change balances or establish that money is missing.

## Recording and confirmation

- Income, expenses, transfers, corrections and voids remain visibly pending until cloud confirmation. Pending receipts cannot be printed or copied as confirmed receipts.
- New blank references receive a collision-safe number from the database. Custom references must be unique, ignoring case and surrounding spaces. Historical repeated references remain available for review and are not silently renumbered.
- Failed, cancelled, pending and voided transactions do not contribute to posted income or expense totals. Transfers move balances between accounts without counting as income or expenditure. Monetary summaries retain cents.
- Voiding retains the receipt and reverses its posted balance effect. Verify the original transaction and supporting evidence before voiding, particularly on accounts awaiting reconciliation. Existing historical money is not reset by this release.

## Cash counts

Choose an active GHS cash account, an active service and a count date up to today. Enter whole, non-negative quantities for the listed denominations, two different counter names and a supervisor name. A bank or MoMo account cannot receive a denomination sheet.

Only one active cash-count sheet can be posted per service and date, including across different cash accounts. The database validates the denomination total and records the signed-in user. To correct the amount, date, account or denomination details, void the original count and post a replacement. Descriptive corrections remain available.

## Department budgets

Budget usage comes from posted expenses and disbursements within the allocation's period and currency, including expenses recorded before the allocation was created. An explicit budget assignment takes precedence over department matching. Supported periods are `2026 Annual`, `2026`, `Q1-2026` and `2026-10`. A department cannot have overlapping allocations in the same currency. Old unsupported periods require review before usage can be calculated.

## Exports

CSV and PDF exports use the current date, account, category, department, search and ledger-type filters and include all matching pages. CSV handles quotes, newlines and reference hashes and neutralizes formula-like text. Reports include receipt status and pending confirmation information. Reconciliation has a separate all-history account export.

## Verification

Database regression tests exercise unchanged historical receipts and balances, number collisions, retry idempotency, cash-account and denomination validation, duplicate service/date counts, void/replacement behavior, authorization and budget overlap guards. Native browser checks cover real downloads, form errors, cloud confirmation, historical budget usage, reconciliation and mobile width. All browser data is synthetic.
