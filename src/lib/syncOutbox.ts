import { createOutboxPersistence, type OutboxPersistence, type OutboxSnapshot } from './outboxStorage';

export interface Mutation {
  table: string;
  operation: 'upsert' | 'delete';
  id: string;
  record?: Record<string, any>;
  expected_updated_at?: string | null;
}
export interface SyncBatch { id: string; changes: Mutation[]; createdAt: string; error?: string; attempts: number; requiresReview?: boolean; migratedFromLegacy?: boolean }
export interface SyncResult { success: boolean; pending: number; error?: string }
export interface SyncTransport { rpc: (name: string, params: any) => PromiseLike<{ data: any; error: any }> }
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
function validateBatches(value: unknown): asserts value is SyncBatch[] {
  if (!Array.isArray(value) || value.some(batch => !batch || typeof batch.id !== 'string' || !batch.id ||
    typeof batch.createdAt !== 'string' || !Number.isInteger(batch.attempts) || batch.attempts < 0 ||
    !Array.isArray(batch.changes) || batch.changes.length > 500 || batch.changes.some((change: Mutation) =>
      !change || typeof change.table !== 'string' || !change.table || typeof change.id !== 'string' || !change.id ||
      !['upsert','delete'].includes(change.operation) || (change.operation === 'upsert' && (!change.record || change.record.id !== change.id))))) {
    throw new Error('Saved pending changes are unreadable. Export them before resetting the queue.');
  }
  if (new Set(value.map(batch => batch.id)).size !== value.length) throw new Error('The saved queue contains duplicate request IDs. Export it for review.');
}
function validateVersions(value: unknown): asserts value is Record<string,string> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(v => typeof v !== 'string')) throw new Error('Saved record versions are unreadable. Export pending changes for review.');
}
async function fingerprint(raw: string | null, versions: string | null) {
  const bytes = new TextEncoder().encode(JSON.stringify([raw, versions]));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}

/** Account-scoped, atomic durable snapshots. Request IDs remain unchanged across migration and retry. */
export class SyncOutbox {
  private batches: SyncBatch[] = [];
  private active: string | null = null;
  private activeChanges = 0;
  private versions: Record<string, string> = {};
  private storageError?: string;
  private readFailure?: string;
  private corruptRaw?: string;
  private legacyConflict?: string;
  private legacyRaw: string | null = null;
  private legacyVersions: string | null = null;
  private legacyFingerprint?: string;
  private revision = 0;
  private loading = true;
  private writing: Promise<void> = Promise.resolve();
  private flushing: Promise<SyncResult> | null = null;
  readonly ready: Promise<void>;
  constructor(readonly owner: string, private storage: Storage, private notify: (detail: any) => void = () => {}, private persistence: OutboxPersistence = createOutboxPersistence(owner, storage)) {
    try {
      this.legacyRaw = storage.getItem(this.key); this.legacyVersions = storage.getItem(this.versionKey);
      try {
        const batches = JSON.parse(this.legacyRaw || '[]'), versions = JSON.parse(this.legacyVersions || '{}');
        validateBatches(batches); validateVersions(versions); this.batches = batches; this.versions = versions;
      } catch (error) { this.corruptRaw = JSON.stringify({ queue: this.legacyRaw, versions: this.legacyVersions }); this.storageError = message(error); }
    } catch (error) { this.readFailure = `Device storage could not be read: ${message(error)}`; }
    this.ready = this.initialize().catch(error => { this.readFailure = `Device storage could not load pending changes: ${message(error)}`; }).finally(() => { this.loading = false; this.notify(this.status); });
  }
  private get key() { return `gwcc_outbox_v2_${this.owner}`; }
  private get versionKey() { return `gwcc_versions_v2_${this.owner}`; }
  private async initialize() {
    const saved = await this.persistence.load();
    if (saved) {
      try{
        if (saved.format !== 3 || !Number.isInteger(saved.revision) || saved.revision < 1) throw new Error('The saved queue format needs review.');
        validateBatches(saved.batches); validateVersions(saved.versions);
      }catch(error){this.corruptRaw=JSON.stringify(saved);throw error;}
      this.batches = saved.batches; this.versions = saved.versions; this.revision = saved.revision; this.legacyFingerprint = saved.legacyFingerprint;
    }
    if (this.legacyRaw !== null || this.legacyVersions !== null) {
      const hash = await fingerprint(this.legacyRaw, this.legacyVersions);
      if (saved && saved.legacyFingerprint !== hash) {
        this.legacyConflict = 'An older tab saved a different pending queue. Keep both tabs open, export their pending changes, then review the backups before continuing.';
        return;
      }
      this.legacyFingerprint = hash;
      if (!saved && !this.corruptRaw && !this.readFailure) {
        // The old tab may have an additional memory-only edit. Let its export be restored before sending.
        this.batches=this.batches.map(batch=>({...batch,requiresReview:true,migratedFromLegacy:true}));
        await this.persist();
      }
      if (!this.corruptRaw && !this.readFailure) this.removeMigratedLegacy();
    }
  }
  private removeMigratedLegacy() {
    // Never remove an older tab's newly changed value, another account, authentication or cached records.
    try {
      if (this.storage.getItem(this.key) === this.legacyRaw && this.storage.getItem(this.versionKey) === this.legacyVersions) {
        this.storage.removeItem?.(this.key); this.storage.removeItem?.(this.versionKey);
      }
    } catch { /* The committed IndexedDB copy remains authoritative; retain legacy data if removal is blocked. */ }
  }
  private assertWritable() {
    if (this.readFailure || this.corruptRaw || this.legacyConflict) throw new Error(this.readFailure || this.legacyConflict || this.storageError);
  }
  private persist() {
    const snapshot: Omit<OutboxSnapshot,'revision'> = structuredClone({ format: 3, batches: this.batches, versions: this.versions, ...(this.legacyFingerprint ? { legacyFingerprint: this.legacyFingerprint } : {}) });
    const write = this.writing.catch(() => {}).then(async () => {
      this.revision = await this.persistence.save(snapshot, this.revision); this.storageError = undefined;
    });
    this.writing = write;
    return write.then(() => { this.notify(this.status); }, error => {
      this.storageError = `Device storage failed: ${message(error)}`; this.notify(this.status); throw error;
    });
  }
  get status(): SyncResult {
    const error = this.readFailure || this.legacyConflict || this.storageError || (this.batches.some(batch=>batch.requiresReview)?'Recovered changes are waiting for review. Use Retry sync when ready.':this.batches.find(batch => batch.error)?.error);
    const retiring=this.active && !this.batches.some(batch=>batch.id===this.active)?this.activeChanges:0;
    return { success: !this.loading && !this.active && this.batches.length === 0 && !error, pending: this.batches.reduce((n,b) => n + b.changes.length, 0)+retiring, ...(error ? { error } : {}) };
  }
  get pendingChanges() { return this.batches.flatMap(batch => batch.changes); }
  async observe(table: string, rows: any[]) {
    await this.ready;
    if (this.readFailure || this.corruptRaw || this.legacyConflict) return;
    const seen = new Set(rows.filter(row => row.id && row.updated_at).map(row => `${table}:${row.id}`));
    const pending = new Set(this.pendingChanges.map(row => `${row.table}:${row.id}`));
    let changed=false;
    for (const key of Object.keys(this.versions)) if (key.startsWith(table + ':') && !seen.has(key) && !pending.has(key)) {delete this.versions[key];changed=true;}
    for (const row of rows) if (row.id && row.updated_at && this.versions[`${table}:${row.id}`]!==row.updated_at) {this.versions[`${table}:${row.id}`] = row.updated_at;changed=true;}
    if(!changed && !this.storageError)return;
    // A cache failure must not turn a successful cloud read into an empty table.
    try { await this.persist(); } catch { /* The status banner reports the failure; subsequent writes still require a durable commit. */ }
  }
  enqueue(change: Mutation) { return this.enqueueMany([change]); }
  async enqueueMany(changes: Mutation[]) {
    await this.ready;
    const blocked=this.readFailure || this.corruptRaw || this.legacyConflict;
    if (!changes.length) return this.status;
    if (changes.length > 500) throw new Error('Save at most 500 changes in one transaction.');
    let tail = this.batches.at(-1);
    if (blocked || !tail || tail.requiresReview || tail.attempts > 0 || tail.id === this.active || tail.changes.length + changes.length > 500) {
      tail = { id: crypto.randomUUID(), changes: [], createdAt: new Date().toISOString(), attempts: 0 }; this.batches.push(tail);
    }
    for (const change of changes) {
      const existing = tail.changes.findIndex(row => row.table === change.table && row.id === change.id);
      const expected = existing >= 0 ? tail.changes[existing].expected_updated_at : change.expected_updated_at ?? this.versions[`${change.table}:${change.id}`] ?? null;
      const next = structuredClone({ ...change, expected_updated_at: expected });
      if (existing >= 0) tail.changes[existing] = next; else tail.changes.push(next);
    }
    // Even an unreadable store must not make a newly entered change disappear from the export.
    if(blocked){this.notify(this.status);this.assertWritable();}
    await this.persist(); return this.status;
  }
  exportPending() {
    return JSON.stringify({ owner: this.owner, batches: this.batches, versions: this.versions,
      ...(this.corruptRaw ? { unreadable: this.corruptRaw } : {}), ...(this.legacyConflict ? { legacyQueue: this.legacyRaw, legacyVersions: this.legacyVersions } : {}) }, null, 2);
  }
  previewPending() {
    return JSON.stringify({ owner: this.owner, batches: this.batches }, (_key, value) =>
      typeof value === 'string' && value.length > 1200 ? (value.startsWith('data:') ? `[Embedded file: ${value.length.toLocaleString()} characters; preserved in export]` : value.slice(0,1200) + '…') : value, 2).slice(0,50000);
  }
  async restorePending(raw: string) {
    await this.ready; this.assertWritable();
    if (this.flushing) throw new Error('Wait for synchronization to finish before restoring a backup.');
    const backup = JSON.parse(raw);
    if (backup?.owner !== this.owner) throw new Error('This backup belongs to a different account. Sign in as its original owner.');
    validateBatches(backup.batches);
    const additions: SyncBatch[] = [],replacements=new Map<string,SyncBatch>();let restored=0;
    for (const batch of backup.batches) {
      const existing = this.batches.find(row => row.id === batch.id);
      if (existing && JSON.stringify(existing.changes) !== JSON.stringify(batch.changes)) {
        if(!existing.migratedFromLegacy || existing.attempts!==0 || !existing.requiresReview)throw new Error('A request ID has different changes in this backup. Keep both copies for review.');
        // Only an untouched legacy batch that was never sent can accept the old tab's newer export.
        // Keep records absent from the backup; restoring must not erase newer local work.
        const merged=structuredClone(existing.changes);
        for(const incoming of batch.changes){
          const index=merged.findIndex(change=>change.table===incoming.table&&change.id===incoming.id);
          if(index<0){merged.push(structuredClone(incoming));restored++;}
          else if(JSON.stringify(merged[index])!==JSON.stringify(incoming)){merged[index]=structuredClone(incoming);restored++;}
        }
        if(merged.length>500)throw new Error('The recovered transaction exceeds 500 changes. Keep both backups for review.');
        replacements.set(existing.id,{...existing,changes:merged,attempts:Math.max(existing.attempts,batch.attempts),requiresReview:true});
      }
      if (!existing) {additions.push({...structuredClone(batch),requiresReview:true});restored+=batch.changes.length;}
    }
    this.batches=this.batches.map(batch=>replacements.get(batch.id)||batch);
    this.batches.push(...additions);
    await this.persist(); return restored;
  }
  async discardPending(expectedExport?:string) {
    await this.ready;
    if (this.flushing) throw new Error('Wait for synchronization to finish.');
    if (this.readFailure) throw new Error(this.readFailure);
    if(expectedExport !== undefined && expectedExport !== this.exportPending()) throw new Error('Pending changes changed after the backup was exported. Export the latest copy before discarding.');
    this.corruptRaw = undefined; this.legacyConflict = undefined; this.batches = [];
    await this.persist(); this.removeMigratedLegacy();
  }
  merge(table: string, remote: any[]) {
    const byId = new Map(remote.map(row => [row.id,row]));
    for (const change of this.pendingChanges.filter(row => row.table === table)) {
      if (change.operation === 'delete') byId.delete(change.id);
      else byId.set(change.id,{ ...byId.get(change.id), ...change.record, _sync_status: 'pending' });
    }
    return [...byId.values()];
  }
  flush(client: SyncTransport, onRecords: (records: any[]) => void = () => {}, approveRestored=false): Promise<SyncResult> {
    if (this.flushing) return approveRestored?this.flushing.then(result=>result.pending?this.flush(client,onRecords,true):result):this.flushing;
    this.flushing = this.runFlush(client,onRecords,approveRestored).finally(() => { this.flushing = null; });
    return this.flushing;
  }
  private async runFlush(client: SyncTransport, onRecords: (records: any[]) => void, approveRestored:boolean): Promise<SyncResult> {
    await this.ready;
    if (this.readFailure || this.corruptRaw || this.legacyConflict) return this.status;
    if(!this.batches.length && this.storageError){try{await this.persist();}catch{return this.status;}}
    while (this.batches.length) {
      if(this.batches[0].requiresReview && !approveRestored)return this.status;
      const batch = this.batches[0]; this.active = batch.id;this.activeChanges=batch.changes.length; batch.attempts++; delete batch.error;
      delete batch.requiresReview;
      try {
        await this.persist();
        const { data, error } = await client.rpc('gwcc_apply_mutations',{ p_operation_id: batch.id, p_changes: structuredClone(batch.changes) });
        if (error) throw new Error(error.message || 'The database did not accept the changes.');
        if (!Array.isArray(data) || batch.changes.some(change => change.table !== 'audit_logs' && !data.some(item => item.table === change.table && (item.id || item.record?.id) === change.id && (change.operation !== 'delete' || item.deleted)))) {
          throw new Error('The database did not confirm every record. Pending changes were retained for a safe retry.');
        }
        for (const item of data) if (item.record?.updated_at) {
          this.versions[`${item.table}:${item.record.id}`] = item.record.updated_at;
          for (const pending of this.batches.slice(1)) if (pending.attempts === 0) for (const next of pending.changes) {
            if (next.table === item.table && next.id === item.record.id) next.expected_updated_at = item.record.updated_at;
          }
        }
        this.batches.shift();
        await this.persist(); this.active = null;this.activeChanges=0;this.notify(this.status); onRecords(data);
      } catch (error) {
        // Cloud may have committed before local cleanup failed. Retain the SAME request ID.
        if (!this.batches.some(row => row.id === batch.id)) this.batches.unshift(batch);
        batch.error = this.storageError || message(error); this.active = null;this.activeChanges=0;
        try { await this.persist(); } catch { /* The in-memory copy remains exportable and the earlier durable request remains retryable. */ }
        return this.status;
      }
    }
    return this.status;
  }
}
