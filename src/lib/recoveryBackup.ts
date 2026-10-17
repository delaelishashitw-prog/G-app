export const BACKUP_TABLES = [
  'gwcc_private.finance_reference_reservations','gwcc_private.sms_dispatches','gwcc_private.sync_recoveries',
  'public.attendance','public.audit_logs','public.child_check_ins','public.church_accounts','public.church_finances',
  'public.communications','public.events','public.expenses','public.giving','public.gwcc_api_limits',
  'public.gwcc_applied_operations','public.gwcc_documents','public.headcounts','public.members','public.ministries',
  'public.pastoral_care','public.pledge_campaigns','public.pledges','public.prayer_requests','public.profiles',
  'public.roster_assignments','public.roster_managers','public.roster_notifications','public.services','public.settings',
  'public.small_groups','public.visitors','public.welfare_claims','public.welfare_contributions',
  'public.welfare_event_contributions','public.welfare_events',
] as const;

export const MAX_RECOVERY_FILE_BYTES = 96 * 1024 * 1024;
const MAX_PLAIN_BYTES = 64 * 1024 * 1024;
const ITERATIONS = 310000;
const AAD = new TextEncoder().encode('GWCC encrypted recovery v1');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex = /^[0-9a-f]{64}$/;
const utf8 = new TextEncoder();
const text = new TextDecoder('utf-8', {fatal: true});

export interface RecordSnapshot {
  format: 'gwcc-records-v1'; source_id: string; created_at: string; schema_revision?: string | null;
  tables: Record<string, Record<string, unknown>[]>; counts: Record<string, number>;
  storage_objects: {bucket: string; name: string; metadata?: unknown; updated_at?: string | null}[];
  exclusions: string[];
}
export interface CloudBackup {id: string; payload_text: string; digest: string}
export interface RecoveryBundle {
  format: 'gwcc-recovery-v1'; project_ref: string; exported_at: string;
  cloud: CloudBackup; files: {bucket: string; name: string; data: string; digest: string; mime: string}[];
  device: {owner: string; pending_text: string; preferences: Record<string, string>};
}
export interface RecoverySummary {
  snapshot: RecordSnapshot; tables: number; records: number; files: number; pending: number; project_ref: string; device_review_required: boolean;
}
export interface RecoveryPoint {
  id: string; kind: 'daily' | 'manual'; created_at: string; digest: string;
  counts: Record<string, number>; byte_count: number; media_count: number; rehearsed_at: string | null;
}
export interface RecoveryStatus {
  source_id: string; daily_enabled: boolean; daily_time_utc: string; retention_daily: number; retention_manual: number;
  points: RecoveryPoint[]; tables: string[]; last_run: {status: string; ended_at: string} | null;
}

const isObject = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
function requireObject(value: unknown, message: string): asserts value is Record<string, any> {
  if (!isObject(value)) throw new Error(message);
}
export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  return btoa(chunks.join(''));
}
function base64ToBytes(value: string, maxBytes = MAX_PLAIN_BYTES): Uint8Array {
  if (typeof value !== 'string' || value.length % 4 !== 0 || value.length > Math.ceil(maxBytes / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Recovery file contains invalid encoded data.');
  const decoded = atob(value);
  if (decoded.length > maxBytes) throw new Error('Recovery file is too large.');
  return Uint8Array.from(decoded, char => char.charCodeAt(0));
}
export async function recoveryDigest(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? utf8.encode(value) : value;
  const result = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function validateSnapshot(value: unknown): asserts value is RecordSnapshot {
  requireObject(value, 'Recovery records are unreadable.');
  if (value.format !== 'gwcc-records-v1' || !uuid.test(value.source_id) || !Number.isFinite(Date.parse(value.created_at))) throw new Error('Unsupported recovery records.');
  requireObject(value.tables, 'Recovery tables are missing.');
  requireObject(value.counts, 'Recovery counts are missing.');
  if (Object.keys(value.tables).sort().join('|') !== [...BACKUP_TABLES].sort().join('|') || Object.keys(value.counts).sort().join('|') !== [...BACKUP_TABLES].sort().join('|')) throw new Error('Recovery file does not cover every supported church table.');
  for (const table of BACKUP_TABLES) {
    const rows = value.tables[table];
    if (!Array.isArray(rows) || rows.some(row => !isObject(row)) || value.counts[table] !== rows.length) throw new Error(`Recovery count failed for ${table}.`);
  }
  if (!Array.isArray(value.storage_objects) || value.storage_objects.length > 2000 || value.storage_objects.some(file => !isObject(file) || file.bucket !== 'gwcc-media' || typeof file.name !== 'string' || !file.name || file.name.length > 1024 || file.name.split('/').some(part => !part || part === '.' || part === '..'))) throw new Error('Recovery storage coverage needs administrator review.');
  if (new Set(value.storage_objects.map(file => JSON.stringify([file.bucket, file.name]))).size !== value.storage_objects.length) throw new Error('Recovery file contains duplicate storage paths.');
}
export async function verifyCloudBackup(cloud: CloudBackup): Promise<RecordSnapshot> {
  requireObject(cloud, 'Recovery point is unreadable.');
  if (!uuid.test(cloud.id) || typeof cloud.payload_text !== 'string' || utf8.encode(cloud.payload_text).length > 40 * 1024 * 1024 || !hex.test(cloud.digest) || await recoveryDigest(cloud.payload_text) !== cloud.digest) throw new Error('Recovery point checksum failed.');
  const snapshot: unknown = JSON.parse(cloud.payload_text);
  validateSnapshot(snapshot);
  return snapshot;
}
export async function verifyRecoveryBundle(value: unknown, expectedProject?: string, expectedSource?: string): Promise<RecoverySummary> {
  requireObject(value, 'Recovery file is unreadable.');
  if (value.format !== 'gwcc-recovery-v1' || typeof value.project_ref !== 'string' || !/^[a-z0-9-]{1,80}$/.test(value.project_ref) || !Number.isFinite(Date.parse(value.exported_at))) throw new Error('Unsupported recovery file.');
  if (expectedProject && value.project_ref !== expectedProject) throw new Error('This recovery file belongs to a different Supabase project.');
  const snapshot = await verifyCloudBackup(value.cloud);
  if (expectedSource && snapshot.source_id !== expectedSource) throw new Error('This recovery file belongs to a different church database.');
  if (!Array.isArray(value.files) || value.files.length !== snapshot.storage_objects.length) throw new Error('Recovery file is missing storage files.');
  const expected = new Set(snapshot.storage_objects.map(file => JSON.stringify([file.bucket, file.name])));
  for (const file of value.files) {
    if (!isObject(file) || !expected.delete(JSON.stringify([file.bucket, file.name])) || typeof file.mime !== 'string' || !hex.test(file.digest) || await recoveryDigest(base64ToBytes(file.data, 20 * 1024 * 1024)) !== file.digest) throw new Error('A recovery storage file is missing, duplicated or damaged.');
  }
  requireObject(value.device, 'Device recovery data is missing.');
  if (!uuid.test(value.device.owner) || typeof value.device.pending_text !== 'string' || utf8.encode(value.device.pending_text).length > 20 * 1024 * 1024) throw new Error('Device recovery data is unreadable.');
  const pending = JSON.parse(value.device.pending_text);
  requireObject(pending, 'Pending changes are unreadable.');
  if (pending.owner !== value.device.owner || !Array.isArray(pending.batches)) throw new Error('Pending changes belong to a different account.');
  let pendingCount = 0;
  for (const batch of pending.batches) {
    if (!isObject(batch) || typeof batch.id !== 'string' || !batch.id || typeof batch.createdAt !== 'string' || !Number.isInteger(batch.attempts) || batch.attempts < 0 ||
      !Array.isArray(batch.changes) || batch.changes.length > 500 || batch.changes.some(change => !isObject(change) || typeof change.table !== 'string' || !change.table || typeof change.id !== 'string' || !change.id ||
        !['upsert','delete'].includes(change.operation) || (change.operation === 'upsert' && (!isObject(change.record) || change.record.id !== change.id)))) throw new Error('Pending changes are unreadable.');
    pendingCount += batch.changes.length;
  }
  if (new Set(pending.batches.map(batch => batch.id)).size !== pending.batches.length) throw new Error('Pending changes contain duplicate operation IDs.');
  requireObject(value.device.preferences, 'Device preferences are unreadable.');
  return {snapshot, tables: BACKUP_TABLES.length, records: Object.values(snapshot.counts).reduce((sum, count) => sum + count, 0), files: value.files.length, pending: pendingCount, project_ref: value.project_ref,
    device_review_required: 'unreadable' in pending || 'legacyQueue' in pending};
}
function validatePassword(password: string) {
  if (password.length < 12 || password.length > 256 || !password.trim()) throw new Error('Choose a backup passphrase of 12 to 256 characters.');
}
async function keyFor(password: string, salt: Uint8Array) {
  const seed = await crypto.subtle.importKey('raw', utf8.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256'}, seed, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
export async function encryptRecoveryBundle(bundle: RecoveryBundle, password: string): Promise<string> {
  validatePassword(password);
  await verifyRecoveryBundle(bundle);
  const bytes = utf8.encode(JSON.stringify(bundle));
  if (bytes.length > MAX_PLAIN_BYTES) throw new Error('Recovery file exceeds 64 MB. Export device pending changes separately or arrange an administrator backup.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: AAD}, await keyFor(password, salt), bytes);
  return JSON.stringify({format: 'gwcc-encrypted-recovery-v1', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, cipher: 'AES-256-GCM', salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted))});
}
export async function decryptRecoveryBundle(raw: string, password: string, expectedProject?: string, expectedSource?: string): Promise<{bundle: RecoveryBundle; summary: RecoverySummary}> {
  validatePassword(password);
  if (utf8.encode(raw).length > MAX_RECOVERY_FILE_BYTES) throw new Error('Choose a recovery file smaller than 96 MB.');
  const envelope = JSON.parse(raw);
  requireObject(envelope, 'Recovery file is unreadable.');
  if (envelope.format !== 'gwcc-encrypted-recovery-v1' || envelope.kdf !== 'PBKDF2-SHA256' || envelope.iterations !== ITERATIONS || envelope.cipher !== 'AES-256-GCM') throw new Error('Choose an encrypted GWCC recovery file. Older partial JSON exports require administrator review.');
  const salt = base64ToBytes(envelope.salt, 16), iv = base64ToBytes(envelope.iv, 12), data = base64ToBytes(envelope.data, MAX_PLAIN_BYTES + 16);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Recovery encryption parameters are invalid.');
  let plain: ArrayBuffer;
  try {plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: iv as BufferSource, additionalData: AAD}, await keyFor(password, salt), data as BufferSource);}
  catch {throw new Error('The passphrase is incorrect or the recovery file is damaged.');}
  const bundle = JSON.parse(text.decode(plain));
  return {bundle, summary: await verifyRecoveryBundle(bundle, expectedProject, expectedSource)};
}
