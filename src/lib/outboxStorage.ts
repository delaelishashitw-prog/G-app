import type { SyncBatch } from './syncOutbox';

export interface OutboxSnapshot {
  format: 3;
  revision: number;
  batches: SyncBatch[];
  versions: Record<string, string>;
  legacyFingerprint?: string;
}
export interface OutboxPersistence {
  load(): Promise<OutboxSnapshot | null>;
  save(snapshot: Omit<OutboxSnapshot, 'revision'>, expectedRevision: number): Promise<number>;
}
export const OUTBOX_DATABASE = 'gwcc-sync-v3';
export const OUTBOX_STORE = 'outboxes';
const changedElsewhere = () => new Error('Another tab changed this account’s pending queue. Keep this tab open and export its pending changes before reloading.');

/** One atomic snapshot per verified account; success means the transaction committed. */
export class IndexedDbOutboxPersistence implements OutboxPersistence {
  private database?: Promise<IDBDatabase>;
  constructor(private owner: string, private factory: IDBFactory) {}
  private open() {
    if (!this.database) this.database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(OUTBOX_DATABASE, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(OUTBOX_STORE)) request.result.createObjectStore(OUTBOX_STORE); };
      request.onerror = () => reject(request.error || new Error('The pending changes database could not be opened.'));
      request.onblocked = () => reject(new Error('Another tab is blocking the pending changes database. Keep your work open and export a backup.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); this.database = undefined; };
        resolve(db);
      };
    });
    return this.database;
  }
  async load(): Promise<OutboxSnapshot | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readonly');
      const request = tx.objectStore(OUTBOX_STORE).get(this.owner);
      tx.oncomplete = () => resolve(request.result || null);
      tx.onabort = () => reject(tx.error || new Error('Pending changes could not be read.'));
      tx.onerror = () => {};
    });
  }
  async save(snapshot: Omit<OutboxSnapshot, 'revision'>, expectedRevision: number): Promise<number> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readwrite', { durability: 'strict' });
      let failure: Error | undefined;
      const store = tx.objectStore(OUTBOX_STORE), request = store.get(this.owner);
      request.onsuccess = () => {
        if ((request.result?.revision || 0) !== expectedRevision) { failure = changedElsewhere(); tx.abort(); return; }
        try { store.put({ ...snapshot, revision: expectedRevision + 1 }, this.owner); }
        catch (error) { failure = error as Error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(expectedRevision + 1);
      tx.onabort = () => reject(failure || tx.error || new Error('Pending changes could not be saved on this device.'));
      tx.onerror = () => {};
    });
  }
}

/** Used when IndexedDB is unavailable; queue and versions still commit as one value. */
export class LocalOutboxPersistence implements OutboxPersistence {
  private key: string;
  constructor(owner: string, private storage: Storage) { this.key = `gwcc_outbox_v3_${owner}`; }
  async load() { const raw = this.storage.getItem(this.key); return raw ? JSON.parse(raw) as OutboxSnapshot : null; }
  async save(snapshot: Omit<OutboxSnapshot, 'revision'>, expectedRevision: number) {
    const existing = await this.load();
    if ((existing?.revision || 0) !== expectedRevision) throw changedElsewhere();
    this.storage.setItem(this.key, JSON.stringify({ ...snapshot, revision: expectedRevision + 1 }));
    return expectedRevision + 1;
  }
}

export function createOutboxPersistence(owner: string, storage: Storage): OutboxPersistence {
  return typeof indexedDB === 'undefined' ? new LocalOutboxPersistence(owner, storage) : new IndexedDbOutboxPersistence(owner, indexedDB);
}
