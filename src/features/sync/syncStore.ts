import type { Dispatch, SetStateAction } from 'react';
import {
  clearSupabaseCredentials,
  getStoredSupabaseConfig,
  isSupabaseConfigured,
  pushAllDataToSupabase,
  pullAllDataFromSupabase,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../../lib/supabase';
import type { ChurchAllData } from '../../lib/supabase';

export type SupabaseStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'tables_missing';

export function getInitialSupabaseStatus(): SupabaseStatus {
  return isSupabaseConfigured() ? 'syncing' : 'disconnected';
}

export async function connectSupabase(
  url: string,
  key: string,
  setSupabaseStatus: Dispatch<SetStateAction<SupabaseStatus>>,
  setSupabaseError: Dispatch<SetStateAction<string | null>>,
  setSupabaseConfig: Dispatch<SetStateAction<{ url: string; anonKey: string; source: 'env' | 'storage' | 'default' | 'none' }>>
): Promise<{ success: boolean; message: string }> {
  setSupabaseStatus('syncing');
  const test = await testSupabaseConnection(url, key);
  if (!test.success) {
    setSupabaseStatus('error');
    setSupabaseError(test.message);
    return { success: false, message: test.message };
  }

  const saveRes = saveSupabaseCredentials(url, key);
  if (!saveRes.success) {
    setSupabaseStatus('error');
    setSupabaseError(saveRes.message);
    return saveRes;
  }

  setSupabaseConfig(getStoredSupabaseConfig());
  if (test.tablesStatus === 'tables_missing') {
    setSupabaseStatus('tables_missing');
    setSupabaseError(null);
    return { success: true, message: test.message };
  }

  setSupabaseStatus('connected');
  setSupabaseError(null);
  return { success: true, message: test.message };
}

export function disconnectSupabase(
  setSupabaseConfig: Dispatch<SetStateAction<{ url: string; anonKey: string; source: 'env' | 'storage' | 'default' | 'none' }>>,
  setSupabaseStatus: Dispatch<SetStateAction<SupabaseStatus>>,
  setSupabaseError: Dispatch<SetStateAction<string | null>>
) {
  clearSupabaseCredentials();
  setSupabaseConfig(getStoredSupabaseConfig());
  setSupabaseStatus('disconnected');
  setSupabaseError(null);
}

export async function pushSupabaseData(
  allData: ChurchAllData,
  setSupabaseStatus: Dispatch<SetStateAction<SupabaseStatus>>,
  setSupabaseError: Dispatch<SetStateAction<string | null>>,
  setLastSyncTime: Dispatch<SetStateAction<string | null>>,
  onProgress?: (step: string, percent: number) => void
): Promise<{ success: boolean; summary: Record<string, number>; errors: string[] }> {
  setSupabaseStatus('syncing');
  const res = await pushAllDataToSupabase(allData, onProgress);
  if (res.success) {
    setSupabaseStatus('connected');
    setSupabaseError(null);
    const now = new Date().toISOString();
    setLastSyncTime(now);
    try {
      localStorage.setItem('gwcc_last_supabase_sync', now);
    } catch {
      // Ignore
    }
  } else {
    setSupabaseStatus('error');
    setSupabaseError(res.errors.join('; '));
  }
  return res;
}

export async function pullSupabaseData(
  setSupabaseStatus: Dispatch<SetStateAction<SupabaseStatus>>,
  setSupabaseError: Dispatch<SetStateAction<string | null>>,
  setLastSyncTime: Dispatch<SetStateAction<string | null>>
): Promise<{ success: boolean; errors: string[]; data?: Partial<ChurchAllData> }> {
  setSupabaseStatus('syncing');
  const res = await pullAllDataFromSupabase();
  if (res.success && res.data) {
    setSupabaseStatus('connected');
    setSupabaseError(null);
    const now = new Date().toISOString();
    setLastSyncTime(now);
    try {
      localStorage.setItem('gwcc_last_supabase_sync', now);
    } catch {
      // Ignore
    }
    return { success: true, errors: [], data: res.data };
  }

  setSupabaseStatus('error');
  setSupabaseError(res.errors.join('; '));
  return { success: false, errors: res.errors };
}
