import type { Dispatch, SetStateAction } from 'react';
import type { GivingRecord, ChurchAccount, ChurchFinanceRecord, DepartmentBudget } from '../../types/database.types';
import type { FinanceSnapshot } from './financeStore';

type Change = { table: string; record: Record<string, any> };
type Setter<T> = Dispatch<SetStateAction<T[]>>;
type Logger = (action: string, module: string, details: string, id?: string) => void;
export interface FinanceStage {
  state: FinanceSnapshot;
  setGiving: Setter<GivingRecord>;
  setAccounts: Setter<ChurchAccount>;
  setFinances: Setter<ChurchFinanceRecord>;
  setBudgets: Setter<DepartmentBudget>;
  sync: (table: string, record: any) => void;
  log: Logger;
}
interface Writer {
  persist: (changes: Change[]) => Promise<{ durable?: boolean; error?: string }>;
  retry: () => Promise<{ durable?: boolean; error?: string }>;
  pending: (table: string, id: string) => Record<string, any> | undefined;
  normalize: (table: string, record: any) => Record<string, any>;
  current: () => boolean;
  apply: (changes: Change[]) => void;
  log: Logger;
}
const ignored = new Set(['created_at', 'updated_at', '_expected_updated_at', '_sync_status']);
export function sameFinanceIntent(a: Record<string, any>, b: Record<string, any>) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => ignored.has(key) || JSON.stringify(a[key] ?? null) === JSON.stringify(b[key] ?? null));
}
function requireCurrent(writer: Writer) {
  if (!writer.current()) throw new Error('The signed-in account changed. Reopen this financial form.');
}
/** Plan against isolated arrays. Publish only after the exact batch has a durable device copy. */
export async function writeFinance<T>(giving: GivingRecord[], snapshot: FinanceSnapshot, plan: (stage: FinanceStage) => T, writer: Writer): Promise<T> {
  requireCurrent(writer);
  const state = structuredClone(snapshot), changes: Change[] = [], logs: Parameters<Logger>[] = [];
  let givingRows = structuredClone(giving);
  const setter = <R,>(read: () => R[], write: (rows: R[]) => void): Setter<R> => action => write(typeof action === 'function' ? action(read()) : action);
  const value = plan({ state,
    setGiving: setter(() => givingRows, rows => { givingRows = rows; }),
    setAccounts: setter(() => state.accounts, rows => { state.accounts = rows; }),
    setFinances: setter(() => state.finances, rows => { state.finances = rows; }),
    setBudgets: setter(() => state.budgets, rows => { state.budgets = rows; }),
    sync: (table, record) => { changes.push({ table, record: writer.normalize(table, record) }); },
    log: (...args) => { logs.push(args); },
  });
  if (!changes.length) return value;
  const retained = changes.map(change => writer.pending(change.table, change.record.id));
  if (retained.some(Boolean) && retained.some((row, i) => !row || !sameFinanceIntent(changes[i].record, row)))
    throw new Error('An earlier financial change is awaiting confirmation. Restore the original details and retry, or use Retry sync first.');
  const admission = retained.some(Boolean) ? await writer.retry() : await writer.persist(changes);
  if (!admission.durable) throw new Error(admission.error || 'This device could not preserve the financial entry. Keep the form open and retry.');
  requireCurrent(writer);
  const pending: Change[] = changes.map((change, i) => ({ table: change.table, record: { ...(retained[i] || change.record), _sync_status: 'pending' } }));
  writer.apply(pending);
  for (const log of logs) writer.log(...log);
  if (value && typeof value === 'object' && 'id' in value) return (pending.find(change => change.record.id === value.id)?.record || value) as T;
  return value;
}
