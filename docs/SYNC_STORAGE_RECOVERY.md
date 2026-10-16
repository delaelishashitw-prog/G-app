# Browser storage and pending sync recovery

The previous Push Local Data action queued the complete database in a localStorage value before flushing it. Large inline member photos were duplicated in the page cache and pending queue. A quota exception could stop persistence, while the progress label counted queued records as synced. Record-version metadata was also written separately from queue cleanup, creating a failure point after a cloud commit.

## Current behavior

- Pending batches and their record versions commit together in IndexedDB (`gwcc-sync-v3`, `outboxes`, keyed by the verified account UUID). The app waits for the database transaction's completion before treating a save as durable or sending its request.
- Existing localStorage v2 batches migrate with their original request IDs, payloads, timestamps, attempts and versions. The old values are removed only after a committed copy exists and only if those exact values have not changed. Authentication, other accounts, page caches and unrelated browser data are not cleared by migration.
- An unavailable, unreadable or conflicting store blocks cloud writes and leaves known/new pending changes exportable. Competing tabs cannot overwrite a newer queue revision. A separate older queue is retained for review rather than silently merged or discarded.
- A cloud commit followed by a device cleanup failure retains the same operation ID. Retrying receives the server's idempotent acknowledgment instead of creating a new transaction. An incomplete acknowledgment retains the whole batch.
- Push Local Data streams up to 50 records or about 128 KB per chunk (an indivisible larger record travels alone), waits for cloud confirmation before counting each chunk, and stops at the first failure. Existing related mutations from normal app workflows keep their transaction boundaries. Changing accounts stops the bulk push.
- Record-version metadata is part of the same snapshot. A metadata cache failure does not turn a successful cloud read into an empty table. Stale version entries are pruned only when absent from a successful full-table read and not needed by pending changes.
- When IndexedDB is unavailable, a single localStorage v3 snapshot provides the fallback. A failed fallback write remains visible; it is never reported as successfully saved.

## Recovering an affected open tab

1. Before refreshing the old version, choose **Review pending changes → Export pending changes**. Keep that original backup.
2. Refresh after the fixed version is deployed. Migrated batches stay paused for review.
3. Before retrying, open **Settings → Supabase PostgreSQL Hub → Restore pending backup** and choose the exported JSON file to recover changes that existed only in the old tab's memory.
4. Review the recovered pending changes and choose **Retry sync**. Migrated and restored batches stay paused through reloads and automatic sync until this explicit action (or an explicit bulk push).

The backup must belong to the signed-in account. Existing request IDs are preserved and duplicate identical batches are skipped. A newer memory-only export can augment a migrated batch whose saved attempt count is zero; records absent from the backup are retained. A stale zero attempt count does not establish that the server never committed the original request. An augmented batch therefore receives a separate durable recovery ID and uses cloud reconciliation when explicitly retried. A conflicting payload under any attempted request ID is rejected. Importing a file does not itself send changes. The full exported payload retains embedded photos; the on-screen preview shortens large fields for readability. Discarding pending changes requires exporting the current copy and confirming the discard; a changed queue cannot be discarded using an older export.

## “Operation ID was reused with different data”

The database rejects a request ID whose payload differs from its saved hash. Earlier quota failures could leave a stale saved queue or let an old tab extend a request that the server had already committed. The original database hash guard remains enforced.

On **Retry sync**, the app persists a new recovery ID before calling `gwcc_reconcile_sync_operation`. Automatic sync pauses for review when it first encounters this mismatch. The guarded database function checks the verified staff identity and current write permissions, looks up only that user's original receipt, and locks records using the ordinary mutation lock. It supports batches containing member and settings upserts only.

- A record that matches either current cloud data or its original confirmed receipt is acknowledged without replaying a write. Comparisons use PostgreSQL column types and supplied persisted fields; server-owned update timestamps and member numbers do not count as user changes. The response reflects current cloud state, including later edits or deletion.
- Remaining saves require the current record version, or a genuinely absent record with no prior receipt/version. A stale, unversioned or deleted record conflict retains the entire batch. All outstanding writes pass through the normal validation/audit function in one transaction.
- Financial, mixed and other unsupported batches remain exportable for review. Recovery does not replace operation IDs to bypass financial protections or change balances.
- The full response and original request identity are recorded in a private, account-scoped recovery receipt in the same transaction. Network or local cleanup failure retries the same recovery ID and identical payload; altered retries are rejected. The client retires a batch only after every record is acknowledged and device cleanup commits.

To recover an existing mismatch, export the pending backup, refresh to the fixed app, and choose **Retry sync**. Keep the backup. If a specific sync conflict remains, export that queue for review rather than discarding it or clearing site storage.

Do not clear browser site data to resolve a quota message while unsynced work may remain. The browser can still reject IndexedDB writes if the device itself runs out of space or its storage is disabled; the app reports that failure and retains known pending changes for export.

## Verification

Tests cover legacy migration, failed migration, quota failures before sending and after cloud commit, immutable retries, atomic related mutations, version metadata failures, incomplete acknowledgments, stale-tab revisions, owner-specific backup restore, review pauses across reloads, confirmed bulk counts and identity changes during a bulk push. Database regressions exercise 20 confirmed records plus one outstanding record, unchanged versions/audit counts for acknowledged records, recovery hash guards, later edits/deletions, atomic stale-version conflicts, authorization and financial rejection.

The browser regressions fill real localStorage until it raises `QuotaExceededError`, migrate a photo-bearing legacy request to IndexedDB, preserve authentication and other-account data, export the complete payload, force an IndexedDB cleanup failure, confirm a retry commits only once, and restore/review a backup across reload. The operation recovery scenario keeps all 21 changes through a lost connection, reload and cleanup failure while saving only the one outstanding record. Browser checks use synthetic accounts and mocked cloud responses; database tests execute the committed migrations in PostgreSQL. The reconciliation migration adds only a private receipt table and guarded functions; it does not rewrite production church records, balances or authentication settings.
