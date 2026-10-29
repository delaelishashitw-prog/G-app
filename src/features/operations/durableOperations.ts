import type { ChurchAsset, AssetMaintenanceLog, FoundationStudent, Member } from '../../types/database.types';

type Row = { id: string; updated_at?: string; _sync_status?: string } & Record<string, any>;
type Change = { table: string; record: Row };
export const OPERATION_SAVE_NOTICE = 'Saved on this device; awaiting cloud confirmation.';
export interface OperationWriter {
  persist: (changes: Change[]) => Promise<{ durable?: boolean; error?: string }>;
  remove: (table: string, id: string, version?: string) => Promise<{ durable?: boolean; error?: string }>;
  pending: (table: string, id: string) => Row | undefined;
  pendingDelete: (table: string, id: string) => boolean;
  retry: () => Promise<{ durable?: boolean; error?: string }>;
  current: () => boolean;
  apply: (table: string, rows: Row[], removedId?: string) => void;
  log: (action: string, module: string, details: string, id?: string) => void;
}
const ignored = new Set(['id', 'created_at', 'updated_at', '_expected_updated_at', '_sync_status']);
function sameIntent(a: Row, b: Row) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => ignored.has(key) || JSON.stringify(a[key] ?? null) === JSON.stringify(b[key] ?? null));
}
function requireCurrent(writer: OperationWriter) {
  if (!writer.current()) throw new Error('The signed-in account changed. Reopen the form.');
}
async function preserve(changes: Change[], writer: OperationWriter) {
  requireCurrent(writer);
  const retained = changes.map(({ table, record }) => writer.pending(table, record.id));
  if (retained.some(Boolean) && retained.some((row, i) => !row || !sameIntent(changes[i].record, row)))
    throw new Error('An earlier change is awaiting confirmation. Restore the original details and retry, or use Retry sync before making another change.');
  const result = retained.some(Boolean) ? await writer.retry() : await writer.persist(changes);
  if (!result.durable) throw new Error(result.error || 'This device could not preserve the change. Keep the form open and retry.');
  requireCurrent(writer);
  return changes.map(({ table, record }, i) => ({ table, record: { ...(retained[i] || record), _sync_status: 'pending' } }));
}
function base<T extends Row>(table: string, id: string, rows: T[], writer: OperationWriter): T {
  const row = rows.find(item => item.id === id);
  if (!row) throw new Error('The record was removed. Refresh before saving.');
  const retained = writer.pending(table, id);
  if (row._sync_status === 'pending' && !retained) throw new Error('Wait for cloud confirmation before changing this record.');
  return (retained ? { ...retained, _sync_status: 'pending' } : row) as T;
}
function apply(changes: Change[], writer: OperationWriter) {
  for (const table of new Set(changes.map(change => change.table))) writer.apply(table, changes.filter(change => change.table === table).map(change => change.record));
}
export async function saveAsset(data: Partial<ChurchAsset>, rows: ChurchAsset[], writer: OperationWriter, id: string, creating = false, expectedVersion?: string) {
  const previous = creating ? rows.find(row => row.id === id) : base('assets', id, rows, writer);
  if (!creating && !writer.pending('assets',id) && expectedVersion && previous?.updated_at !== expectedVersion) throw new Error('This asset changed while the form was open. Refresh before saving.');
  const tag = String(data.asset_tag ?? previous?.asset_tag ?? '').trim().toUpperCase();
  const name = String(data.name ?? previous?.name ?? '').trim();
  const cost = Number(data.purchase_cost ?? previous?.purchase_cost);
  if (!tag || !name || !Number.isFinite(cost) || cost < 0) throw new Error('Enter an asset tag, name and valid non-negative purchase cost.');
  if (rows.some(row => row.id !== id && row.asset_tag?.trim().toUpperCase() === tag)) throw new Error('This asset tag is already in use. Choose another tag.');
  const now = new Date().toISOString();
  const row = { ...previous, ...data, id, asset_tag: tag, name, purchase_cost: cost, created_at: previous?.created_at || now, updated_at: now,
    ...(previous ? { _expected_updated_at: previous.updated_at } : {}) } as ChurchAsset;
  if (creating && previous && previous._sync_status !== 'pending') {
    if (!sameIntent(row, previous)) throw new Error('This asset is already saved. Open its record to edit it.');
    return previous;
  }
  const admitted = await preserve([{ table: 'assets', record: row }], writer);
  apply(admitted, writer);
  writer.log(creating ? 'CREATE_ASSET' : 'UPDATE_ASSET', 'Inventory', `Queued asset [${tag}] ${name}`, id);
  return admitted[0].record as unknown as ChurchAsset;
}
export async function removeAsset(id: string, rows: ChurchAsset[], writer: OperationWriter) {
  requireCurrent(writer);
  const previous = rows.find(row => row.id === id);
  if (!previous) throw new Error('The asset was removed. Refresh the register.');
  const retained = writer.pendingDelete('assets', id);
  if (!retained && (previous._sync_status === 'pending' || writer.pending('assets', id))) throw new Error('Wait for this asset to sync before deleting it.');
  const result = retained ? await writer.retry() : await writer.remove('assets', id, previous.updated_at);
  if (!result.durable) throw new Error(result.error || 'The deletion could not be preserved. Keep this record open and retry.');
  requireCurrent(writer);
  writer.apply('assets', [], id);
  writer.log('DELETE_ASSET', 'Inventory', `Queued deletion of asset [${previous.asset_tag}] ${previous.name}`, id);
}
export async function saveMaintenance(assetId: string, data: Omit<AssetMaintenanceLog, 'id'>, rows: ChurchAsset[], writer: OperationWriter, requestId: string, expectedVersion?: string) {
  const previous = base('assets', assetId, rows, writer);
  if (!Number.isFinite(data.cost) || data.cost < 0 || !data.technician_vendor?.trim() || !data.details?.trim()) throw new Error('Enter maintenance details, technician and a valid non-negative cost.');
  const existing = previous.maintenance_logs?.find(log => log.id === requestId);
  if (existing && !sameIntent({ ...data, id: requestId }, existing)) throw new Error('This maintenance entry is already saved with different details.');
  const maintenance_logs = existing ? previous.maintenance_logs : [{ ...data, id: requestId }, ...(previous.maintenance_logs || [])];
  return saveAsset({ ...previous, last_service_date: data.service_date, maintenance_logs }, rows, writer, assetId, false, expectedVersion);
}
export async function graduateStudent(studentId: string, certificate: string | undefined, students: FoundationStudent[], members: Member[], writer: OperationWriter, normalize: (row: Member) => Member) {
  const previous = base('foundation_students', studentId, students, writer);
  const member = base('members', previous.member_id, members, writer);
  if (member.is_archived || ['deceased', 'transferred'].includes(member.status)) throw new Error('Review this member before recording graduation.');
  if (previous.status === 'graduated' && member.membership_class_completed && previous._sync_status !== 'pending' && member._sync_status !== 'pending') return previous;
  const retained = writer.pending('foundation_students', studentId);
  const today = new Date().toISOString().slice(0, 10);
  const student = { ...previous, status: 'graduated', graduation_date: previous.graduation_date || retained?.graduation_date || today,
    certificate_no: certificate?.trim() || previous.certificate_no || retained?.certificate_no || `GWCC-FS-${today.slice(0, 4)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    completed_modules: [1, 2, 3, 4, 5], updated_at: new Date().toISOString(), _expected_updated_at: previous.updated_at };
  const completedMember = { ...normalize({ ...member, membership_class_completed: true }), _expected_updated_at: member.updated_at };
  const admitted = await preserve([{ table: 'foundation_students', record: student }, { table: 'members', record: completedMember }], writer);
  apply(admitted, writer);
  writer.log('GRADUATE_FOUNDATION_STUDENT', 'Discipleship', `Queued graduation and member completion for ${previous.member_name}`, studentId);
  return admitted[0].record as unknown as FoundationStudent;
}
