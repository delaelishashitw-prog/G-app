# Reports and crash recovery

Reports use one read-only snapshot for on-screen totals, charts, CSV files, quick PDFs and the configured PDF preview/download/print actions. Institutional income and grants appear alongside member giving, with their source identified. Expenses include posted treasury entries and legacy expenses once by record ID. Internal transfers, voided/cancelled records, unpaid requests and records awaiting cloud confirmation do not inflate the report.

Money is reported in GHS without inventing exchange rates. Records in other currencies are excluded with a visible notice. PDFs use the ISO label **GHS** because the standard PDF fonts do not contain the cedi glyph. Source records, account balances and historical money are never rewritten by report generation.

The reporting period, search, category, payment method and ministry filters apply to the relevant screen and exports. The PDF dialog opens with the current dates and applicable filters; selecting another template clears the previous template's text/category/ministry filters. Reopening the dialog uses the current selection, including blank dates for All Time. Year to Date ends on the current date in Africa/Accra. All Time has no arbitrary year limits. Invalid/reversed dates show an error and disable exports.

Financial summary CSV files include income, expenditure and matching summary totals. CSV downloads escape quotes and neutralize spreadsheet formulas. Pledge dates select commitments created in the period; paid amounts and balances remain current cumulative totals. Membership and cell directories describe current records rather than reconstructing a historical directory.

Attendance reports use distinct present check-ins. A physical headcount replaces check-ins only for its own service/date, and online viewers do not inflate auditorium attendance. Weekly totals use Ghana dates. Charts display up to 12 recent months and 10 recent weeks; their summary totals cover the complete selected period. The previous fixed growth claim is removed.

## Crash recovery

**Clear Page Cache & Reload** clears only the signed-in account's `gwcc_cache_<owner>_*` page cache. It preserves IndexedDB, both legacy and fallback pending queues, version metadata, authentication, connection settings, other accounts and unrelated browser data. It does not submit or discard pending changes.

If the active queue contains pending work or a storage/read error, either reload action requires exporting the current complete pending backup first. This includes changes retained only in memory after failed device storage, full embedded photos, operation IDs and original versions. A backup made before newer pending work cannot satisfy the reload check. The interface reports that a download started and asks the operator to keep the file; it does not claim that a file was saved or that pending changes reached the cloud. Restore the normal pending-backup file through the existing recovery controls under its original owner.

Validation includes snapshot/PDF tests, exact request preservation and failed-storage checks, real browser CSV/PDF downloads, Ghana date and filter boundaries, mobile layout, and the complete crash-recovery backup/reload flow. Browser records and accounts are synthetic; no live records, payments, messages or provider requests are created.
