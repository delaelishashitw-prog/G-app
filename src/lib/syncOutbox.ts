export interface Mutation {
  table: string;
  operation: 'upsert' | 'delete';
  id: string;
  record?: Record<string, any>;
  expected_updated_at?: string | null;
}
export interface SyncBatch { id: string; changes: Mutation[]; createdAt: string; error?: string; attempts: number }
export interface SyncResult { success: boolean; pending: number; error?: string }
export interface SyncTransport { rpc: (name: string, params: any) => PromiseLike<{ data: any; error: any }> }

/** Durable owner-scoped operations. A request ID is retained across retries for idempotency. */
export class SyncOutbox {
  private batches: SyncBatch[];
  private active: string | null = null;
  private versions: Record<string, string>;
  private storageError?:string;
  private corruptRaw?:string;
  constructor(readonly owner: string, private storage: Storage, private notify: (detail: any) => void = () => {}) {
    const raw=storage.getItem(this.key)||'[]';
    try {this.batches=JSON.parse(raw);if(!Array.isArray(this.batches)||this.batches.some(batch=>!batch.id||!Array.isArray(batch.changes)))throw new Error('Invalid queue');}
    catch {this.batches=[];this.corruptRaw=raw;this.storageError='Saved pending changes are unreadable. Export them before resetting the queue.';}
    try {this.versions=JSON.parse(storage.getItem(this.versionKey)||'{}');}catch{this.versions={};}
  }
  private get key() { return `gwcc_outbox_v2_${this.owner}`; }
  private get versionKey() { return `gwcc_versions_v2_${this.owner}`; }
  private persist() {
    try {this.storage.setItem(this.key,JSON.stringify(this.batches));this.storageError=undefined;}
    catch(error){this.storageError=`Device storage failed: ${(error as Error).message}`;this.notify(this.status);throw error;}
    this.notify(this.status);
  }
  get status(): SyncResult {
    const error = this.storageError || this.batches.find(batch => batch.error)?.error;
    return { success: this.batches.length === 0 && !error, pending: this.batches.reduce((n,b) => n+b.changes.length,0), ...(error ? { error } : {}) };
  }
  get pendingChanges() { return this.batches.flatMap(batch => batch.changes); }
  observe(table: string, rows: any[]) {
    for (const row of rows) if (row.id && row.updated_at) this.versions[`${table}:${row.id}`] = row.updated_at;
    this.storage.setItem(this.versionKey,JSON.stringify(this.versions));
  }
  enqueue(change: Mutation) { return this.enqueueMany([change]); }
  enqueueMany(changes:Mutation[]) {
    if(this.corruptRaw)throw new Error(this.storageError);
    if(changes.length>500)throw new Error('Save at most 500 changes in one transaction.');
    let tail=this.batches.at(-1);
    if(!tail||tail.attempts>0||tail.id===this.active||tail.changes.length+changes.length>500){
      tail={id:crypto.randomUUID(),changes:[],createdAt:new Date().toISOString(),attempts:0};this.batches.push(tail);
    }
    for(const change of changes){
      const existing=tail.changes.findIndex(row=>row.table===change.table&&row.id===change.id);
      const expected=existing>=0?tail.changes[existing].expected_updated_at:change.expected_updated_at??this.versions[`${change.table}:${change.id}`]??null;
      const next={...change,expected_updated_at:expected};
      if(existing>=0)tail.changes[existing]=next;else tail.changes.push(next);
    }
    this.persist();return this.status;
  }
  exportPending() {return JSON.stringify({owner:this.owner,batches:this.batches,...(this.corruptRaw?{unreadable:this.corruptRaw}:{})},null,2);}
  discardPending() {
    if(this.active)throw new Error('Wait for synchronization to finish.');
    this.corruptRaw=undefined;this.batches=[];this.persist();
  }
  merge(table: string, remote: any[]) {
    const byId = new Map(remote.map(row => [row.id,row]));
    for (const change of this.pendingChanges.filter(row => row.table === table)) {
      if (change.operation === 'delete') byId.delete(change.id);
      else byId.set(change.id,{ ...byId.get(change.id),...change.record,_sync_status:'pending' });
    }
    return [...byId.values()];
  }
  async flush(client: SyncTransport, onRecords: (records: any[]) => void = () => {}): Promise<SyncResult> {
    if (this.active || this.corruptRaw) return this.status;
    while (this.batches.length) {
      const batch = this.batches[0]; this.active = batch.id; batch.attempts++; delete batch.error;
      try {
        this.persist();
        const { data, error } = await client.rpc('gwcc_apply_mutations',{ p_operation_id: batch.id,p_changes: batch.changes });
        if (error) throw new Error(error.message || 'The database did not accept the changes.');
        if (!Array.isArray(data)) throw new Error('The database returned an invalid acknowledgment.');
        for (const item of data) if (item.record?.updated_at) {
          const key=`${item.table}:${item.record.id}`; this.versions[key]=item.record.updated_at;
          // Later local changes were made on top of this operation, not a remote overwrite.
          for (const pending of this.batches.slice(1)) if (pending.attempts===0) for(const next of pending.changes) {
            if (next.table===item.table && next.id===item.record.id) next.expected_updated_at=item.record.updated_at;
          }
        }
        this.storage.setItem(this.versionKey,JSON.stringify(this.versions));
        this.batches.shift(); this.active=null; this.persist(); onRecords(data);
      } catch (error) {
        batch.error = error instanceof Error ? error.message : 'Unable to synchronize changes.';
        this.active=null; try{this.persist();}catch{} return this.status;
      }
    }
    return this.status;
  }
}
