import {COMMUNICATION_ROLES} from './communicationUtils';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SyncOutbox, type Mutation, type SyncResult } from './syncOutbox';
import { setCacheOwner, clearScopedCache } from './storageScope';
import {
  Member,
  Visitor,
  ChurchService,
  AttendanceRecord,
  GivingRecord,
  PledgeRecord,
  PledgeCampaign,
  ExpenseRecord,
  Ministry,
  SmallGroup,
  ChurchEvent,
  PastoralCareRecord,
  PrayerRequest,
  CommunicationRecord,
  AuditLog,
  ChurchSettings,
  HeadcountRecord,
  WelfareContribution,
  WelfareClaim,
  WelfareEvent,
  WelfareEventContribution,
  RosterAssignment,
  ChurchAccount,
  ChurchFinanceRecord,
} from '../types/database.types';

const STORAGE_KEY_URL = 'gwcc_supabase_url';
const STORAGE_KEY_ANON = 'gwcc_supabase_anon_key';
const VITE_ENV = typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env ? (import.meta as any).env : {};

// Credentials are environment-specific. Never silently reconnect a different project.
export const DEFAULT_SUPABASE_URL = '';
export const DEFAULT_SUPABASE_ANON_KEY = '';
export function getStoredSupabaseConfig(): { url: string; anonKey: string; source: 'env' | 'storage' | 'default' | 'none' } {
  const envUrl = String(VITE_ENV.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const envKey = String(VITE_ENV.VITE_SUPABASE_ANON_KEY || '').trim();
  if (envUrl && envKey) return { url: envUrl, anonKey: envKey, source:'env' };
  try {
    if (localStorage.getItem('gwcc_supabase_disabled') === 'true') return {url:'',anonKey:'',source:'none'};
    const url=(localStorage.getItem(STORAGE_KEY_URL)||'').trim().replace(/\/+$/, '');
    const anonKey=(localStorage.getItem(STORAGE_KEY_ANON)||'').trim();
    if (url && anonKey) return { url,anonKey,source:'storage' };
  } catch {}
  return {url:'',anonKey:'',source:'none'};
}

// Active singleton instance
let cachedClient: SupabaseClient | null = null;
let currentConfigKey = '';
const GLOBAL_SUPABASE_CLIENT_KEY = '__GWCC_SUPABASE_CLIENT__';

function getGlobalSupabaseClient(): SupabaseClient | null {
  return (globalThis as typeof globalThis & { [GLOBAL_SUPABASE_CLIENT_KEY]?: SupabaseClient })[
    GLOBAL_SUPABASE_CLIENT_KEY
  ] ?? null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey) {
    cachedClient = null;
    currentConfigKey = '';
    return null;
  }

  const configKey = `${url}:${anonKey}`;
  const existingGlobalClient = getGlobalSupabaseClient();

  if (cachedClient && currentConfigKey === configKey) {
    return cachedClient;
  }

  if (existingGlobalClient && (existingGlobalClient as any).__gwcc_config_key === configKey) {
    cachedClient = existingGlobalClient;
    currentConfigKey = configKey;
    return cachedClient;
  }

  try {
    const client = createClient(url, anonKey, {
      auth: {
        storageKey: 'gwcc-church-auth-token',
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    (client as any).__gwcc_config_key = configKey;
    (globalThis as typeof globalThis & { [GLOBAL_SUPABASE_CLIENT_KEY]?: SupabaseClient })[GLOBAL_SUPABASE_CLIENT_KEY] = client;

    cachedClient = client;
    currentConfigKey = configKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client', err);
    return null;
  }
}

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(url && anonKey);
};

export const supabase = getSupabaseClient();

// Save Supabase credentials to LocalStorage
export function saveSupabaseCredentials(url: string, anonKey: string): { success: boolean; message: string } {
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    let cleanKey = anonKey.trim();

    let serverSecret=cleanKey.startsWith('sb_secret_');
    try {serverSecret ||= JSON.parse(atob(cleanKey.split('.')[1]||'')).role==='service_role';}catch{}
    if(serverSecret)return {success:false,message:'Use the public publishable/anon key. Server authentication keys must never be stored in the browser.'};
    if (!cleanUrl.startsWith('https://')) {
      return { success: false, message: 'Supabase URL must start with https://' };
    }

    localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
    localStorage.setItem(STORAGE_KEY_ANON, cleanKey);
    localStorage.removeItem('gwcc_supabase_disabled');

    const configKey = `${cleanUrl}:${cleanKey}`;
    const existingGlobalClient = getGlobalSupabaseClient();

    if (existingGlobalClient && (existingGlobalClient as any).__gwcc_config_key === configKey) {
      cachedClient = existingGlobalClient;
      currentConfigKey = configKey;
      return { success: true, message: 'Supabase credentials saved successfully!' };
    }

    cachedClient = createClient(cleanUrl, cleanKey, {
      auth: {
        storageKey: 'gwcc-church-auth-token',
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    (cachedClient as any).__gwcc_config_key = configKey;
    (globalThis as typeof globalThis & { [GLOBAL_SUPABASE_CLIENT_KEY]?: SupabaseClient })[GLOBAL_SUPABASE_CLIENT_KEY] = cachedClient;
    currentConfigKey = configKey;

    return { success: true, message: 'Supabase credentials saved successfully!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not save credentials.' };
  }
}

// Disconnect / Clear credentials
export function clearSupabaseCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON);
    localStorage.setItem('gwcc_supabase_disabled', 'true');
  } catch {
    // Ignore
  }
  cachedClient = null;
  currentConfigKey = '';
  (globalThis as typeof globalThis & { [GLOBAL_SUPABASE_CLIENT_KEY]?: SupabaseClient })[GLOBAL_SUPABASE_CLIENT_KEY] = undefined;
}

// Helper to check if an error is due to missing tables / schema cache
export function isTableNotFoundError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const msg = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  const hint = String(error.hint || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    details.includes('schema cache') ||
    details.includes('could not find the table') ||
    hint.includes('schema cache')
  );
}

// Helper to check if an error is due to missing privileges / RLS restrictions
export function isPermissionDeniedError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const msg = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    details.includes('permission denied')
  );
}

// Extract project ref from https://<ref>.supabase.co
export function getSupabaseProjectRef(url: string): string | null {
  try {
    const clean = url.trim().replace(/\/+$/, '');
    const parsed = new URL(clean);
    const parts = parsed.hostname.split('.');
    if (parts.length >= 3 && parts[1] === 'supabase' && parts[2] === 'co') {
      return parts[0];
    }
  } catch {
    // Ignore
  }
  return null;
}

// Diagnostics: Test live connection to Supabase
export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ success: boolean; latencyMs: number; message: string; tablesStatus?: 'ready' | 'tables_missing' }> {
  const startTime = Date.now();
  const storedConfig = getStoredSupabaseConfig();
  const url = (customUrl || storedConfig.url).trim().replace(/\/+$/, '');
  const key = (customKey || storedConfig.anonKey).trim();

  if (!url || !key) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Supabase URL and Anon Key are required.',
    };
  }

  try {
    const testClient =
      ((!customUrl && !customKey)||(url===storedConfig.url && key===storedConfig.anonKey))
        ? getSupabaseClient()
        : createClient(url, key, {
            auth: {
              storageKey: `gwcc-supabase-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          });

    if (!testClient) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: 'Could not initialize the Supabase client for this configuration.',
      };
    }

    // Test query against settings or members
    const { error: settingsError } = await testClient
      .from('settings')
      .select('church_name')
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (settingsError) {
      // If table does not exist in schema cache
      if (isTableNotFoundError(settingsError)) {
        return {
          success: true,
          latencyMs,
          message: 'Connected to Supabase! The database tables are pending creation. Run the SQL migration script in your Supabase SQL Editor.',
          tablesStatus: 'tables_missing',
        };
      }

      if(isPermissionDeniedError(settingsError))return {success:true,latencyMs,message:'The project is reachable. Private data requires a verified, reviewed account; permissions have not been relaxed.'};

      // If invalid API key / JWT
      if (
        settingsError.message?.toLowerCase().includes('jwt') ||
        settingsError.message?.toLowerCase().includes('apikey') ||
        settingsError.message?.toLowerCase().includes('api key')
      ) {
        return {
          success: false,
          latencyMs,
          message: `Authentication failed: ${settingsError.message}`,
        };
      }

      return {
        success: false,
        latencyMs,
        message: `Connection error: ${settingsError.message}`,
      };
    }

    return {
      success: true,
      latencyMs,
      message: `Successfully connected to Supabase in ${latencyMs}ms! The settings query succeeded.`,
      tablesStatus: 'ready',
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      message: err?.message || 'Unable to connect to Supabase endpoint.',
    };
  }
}

// Table inspection helper
export async function checkSupabaseTables(): Promise<{
  ready: boolean;
  existing: string[];
  missing: string[];
}> {
  const client = getSupabaseClient();
  if (!client) return { ready: false, existing: [], missing: [] };

  const tablesToCheck = [
    'church_accounts','church_finances','child_check_ins','gwcc_documents','roster_notifications',
    'members',
    'visitors',
    'services',
    'roster_assignments',
    'attendance',
    'headcounts',
    'giving',
    'expenses',
    'pledge_campaigns',
    'pledges',
    'ministries',
    'small_groups',
    'events',
    'pastoral_care',
    'prayer_requests',
    'communications',
    'welfare_contributions',
    'welfare_claims',
    'welfare_events',
    'welfare_event_contributions',
    'audit_logs',
    'settings',
  ];

  const existing: string[] = [];
  const missing: string[] = [];

  for (const table of tablesToCheck) {
    try {
      const { error } = await client.from(table).select('*', { count: 'exact', head: true });
      if (error && isTableNotFoundError(error)) {
        missing.push(table);
      } else if (error && isPermissionDeniedError(error)) {
        // Table exists in Postgres but has restrictive RLS/permissions
        existing.push(table);
      } else if (error) {
        missing.push(table);
      } else {
        existing.push(table);
      }
    } catch {
      missing.push(table);
    }
  }

  const release=await client.rpc('gwcc_release_status');
  if(release.error || release.data?.migration!=='20261015000001')missing.push('security upgrade 20261015000001');
  return {
    ready: missing.length === 0,
    existing,
    missing,
  };
}

// HELPER: CLEAN DATE VALUES FOR POSTGRESQL DATE COLUMNS
export function cleanDate(val: any): string | null {
  if (!val) return null;
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '-') return null;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

// SANITIZE MEMBER OBJECT FOR SUPABASE POSTGRESQL CONSTRAINTS
export function sanitizeMemberForSupabase(m: any): any {
  if (!m) return m;
  const dateJoined =
    cleanDate(m.date_joined) ||
    cleanDate(m.membership_date) ||
    new Date().toISOString().split('T')[0];

  return {
    ...m,
    gender: m.gender || 'male',
    status: m.status || 'active',
    marital_status: m.marital_status || 'single',
    nationality: m.nationality || 'Ghanaian',
    city: m.city || 'Accra',
    region: m.region || 'Greater Accra',
    membership_date: cleanDate(m.membership_date) || dateJoined,
    date_joined: dateJoined,
    date_of_birth: cleanDate(m.date_of_birth),
    first_visit_date: cleanDate(m.first_visit_date),
    baptism_date: cleanDate(m.baptism_date),
    salvation_date: cleanDate(m.salvation_date),
    holy_spirit_baptism_date: cleanDate(m.holy_spirit_baptism_date),
    right_hand_of_fellowship_date: cleanDate(m.right_hand_of_fellowship_date),
    wedding_anniversary: cleanDate(m.wedding_anniversary),
    number_of_children: Number(m.number_of_children) || 0,
    ministry_id: m.ministry_id && typeof m.ministry_id === 'string' && m.ministry_id.trim() !== '' ? m.ministry_id.trim() : null,
    small_group_id: m.small_group_id && typeof m.small_group_id === 'string' && m.small_group_id.trim() !== '' ? m.small_group_id.trim() : null,
  };
}

// SANITIZE ANY RECORD FOR POSTGRESQL BEFORE UPSERT
export function sanitizeRecordForSupabase(table: string, record: any): any {
  if (!record || typeof record !== 'object') return record;

  switch (table) {
    case 'members':
      return sanitizeMemberForSupabase(record);

    case 'visitors':
      return {
        ...record,
        visit_date: cleanDate(record.visit_date) || new Date().toISOString().split('T')[0],
        next_follow_up_date: cleanDate(record.next_follow_up_date),
        service_attended: record.service_attended || 'Sunday Main Service',
        follow_up_status: record.follow_up_status || 'new',
      };

    case 'roster_assignments': {
      const memId = record.member_id && typeof record.member_id === 'string' && record.member_id.trim() !== '' ? record.member_id.trim() : null;
      return {
        ...record,
        member_id: memId,
        service_id: record.service_id || null,
        service_name: record.service_name || 'Church Service',
        date: cleanDate(record.date) || new Date().toISOString().split('T')[0],
        department: record.department || 'ushers_protocol',
        role_title: record.role_title || 'Volunteer',
        report_time: record.report_time || '08:00',
        status: record.status || 'pending',
        notes: record.notes || null,
        announcement: record.announcement ? String(record.announcement).trim() : null,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: record.updated_at || new Date().toISOString(),
      };
    }

    case 'attendance': {
      const memId = record.member_id && typeof record.member_id === 'string' && record.member_id.trim() !== '' ? record.member_id.trim() : null;
      const visId = record.visitor_id && typeof record.visitor_id === 'string' && record.visitor_id.trim() !== '' ? record.visitor_id.trim() : null;
      const srvId = record.service_id && typeof record.service_id === 'string' && record.service_id.trim() !== '' ? record.service_id.trim() : 'srv-001';
      return {
        ...record,
        member_id: memId,
        visitor_id: visId,
        service_id: srvId,
        date: cleanDate(record.date) || new Date().toISOString().split('T')[0],
        check_in_time: record.check_in_time || new Date().toISOString(),
        status: record.status || 'present',
      };
    }

    case 'headcounts':
      return {
        ...record,
        date: cleanDate(record.date) || new Date().toISOString().split('T')[0],
        men: Number(record.men) || 0,
        women: Number(record.women) || 0,
        youth: Number(record.youth) || 0,
        children: Number(record.children) || 0,
        total_auditorium:
          Number(record.total_auditorium) ||
          (Number(record.men) || 0) +
            (Number(record.women) || 0) +
            (Number(record.youth) || 0) +
            (Number(record.children) || 0),
      };

    case 'giving': {
      const memId = record.member_id && typeof record.member_id === 'string' && record.member_id.trim() !== '' ? record.member_id.trim() : null;
      return {
        ...record,
        member_id: memId,
        amount: Number(record.amount) || 0,
        currency: record.currency || 'GHS',
        date: cleanDate(record.date) || new Date().toISOString().split('T')[0],
        payment_method: record.payment_method || 'mobile_money',
      };
    }

    case 'expenses':
      return {
        ...record,
        amount: Number(record.amount) || 0,
        currency: record.currency || 'GHS',
        date: cleanDate(record.date) || new Date().toISOString().split('T')[0],
        description: record.description || record.title || 'Church operational expenditure',
        category: record.category || 'Operations',
      };

    case 'pledge_campaigns':
      return {
        ...record,
        target_amount: Number(record.target_amount) || 0,
        start_date: cleanDate(record.start_date) || new Date().toISOString().split('T')[0],
        end_date: cleanDate(record.end_date) || new Date().toISOString().split('T')[0],
      };

    case 'pledges': {
      const memId = record.member_id && typeof record.member_id === 'string' && record.member_id.trim() !== '' ? record.member_id.trim() : null;
      const pledged = Number(record.amount_pledged) || 0;
      const paid = Number(record.amount_paid) || 0;
      return {
        ...record,
        member_id: memId,
        amount_pledged: pledged,
        amount_paid: paid,
        balance: Math.max(0, pledged - paid),
        status: record.status || 'active',
        pledge_date: cleanDate(record.pledge_date) || new Date().toISOString().split('T')[0],
        due_date: cleanDate(record.due_date) || new Date().toISOString().split('T')[0],
      };
    }

    case 'events': {
      const now = new Date().toISOString();
      return {
        ...record,
        created_at: record.created_at || now,
        updated_at: record.updated_at || now,
        event_type: record.event_type || 'church_service',
        start_date: cleanDate(record.start_date) || now.split('T')[0],
        end_date: cleanDate(record.end_date) || cleanDate(record.start_date) || now.split('T')[0],
        start_time: record.start_time || '09:00',
        end_time: record.end_time || '12:00',
        venue: record.venue || 'Main Sanctuary, Joma',
        status: record.status || 'upcoming',
        attendees: record.attendees || [],
      };
    }

    case 'pastoral_care': {
      const memId = record.member_id && typeof record.member_id === 'string' && record.member_id.trim() !== '' ? record.member_id.trim() : null;
      return {
        ...record,
        member_id: memId,
        care_type: record.care_type || 'Visitation',
        assigned_pastor: record.assigned_pastor || record.pastor_name || 'Senior Pastor',
        notes: record.notes || 'Pastoral session recorded',
        date: cleanDate(record.date) || new Date().toISOString().split('T')[0],
        follow_up_date: cleanDate(record.follow_up_date),
      };
    }

    case 'prayer_requests': {
      const memId = record.member_id && typeof record.member_id === 'string' && record.member_id.trim() !== '' ? record.member_id.trim() : null;
      return {
        ...record,
        member_id: memId,
        category: record.category || 'General',
        request: record.request || 'Prayer request',
        date_submitted: cleanDate(record.date_submitted) || new Date().toISOString().split('T')[0],
        status: record.status || 'new',
      };
    }

    case 'services':
      return {
        ...record,
        type: record.type || 'sunday',
        day_of_week: record.day_of_week || 'Sunday',
        start_time: record.start_time || '09:00',
        end_time: record.end_time || '12:00',
        order_of_service: record.order_of_service || [],
      };

    case 'small_groups':
      return {
        ...record,
        leader_id: record.leader_id || null,
        leader_name: record.leader_name || null,
        leader_phone: record.leader_phone || null,
        assistant_leader_id: record.assistant_leader_id || null,
        assistant_leader_name: record.assistant_leader_name || null,
        meeting_location: record.meeting_location || 'Church Annex',
        meeting_address: record.meeting_address || null,
        zone: record.zone || null,
        meeting_day: record.meeting_day || 'Wednesday',
        meeting_time: record.meeting_time || '18:30',
        notes: record.notes || '',
        member_count: Number(record.member_count) || 0,
      };

    case 'ministries':
      return {
        ...record,
        description: record.description || '',
        leader_id: record.leader_id || null,
        leader_name: record.leader_name || null,
        assistant_leader_id: record.assistant_leader_id || null,
        assistant_leader_name: record.assistant_leader_name || null,
        meeting_schedule: record.meeting_schedule || '',
        meeting_day: record.meeting_day || '',
        meeting_time: record.meeting_time || '',
        status: record.status || 'active',
        member_count: Number(record.member_count) || 0,
      };

    case 'welfare_contributions': {
      const memId =
        record.member_id && typeof record.member_id === 'string' && record.member_id.trim() !== ''
          ? record.member_id.trim()
          : record.id || 'MEM-GEN';
      const contributionDate = cleanDate(record.date) || new Date().toISOString().split('T')[0];
      return {
        ...record,
        member_id: memId,
        member_name: record.member_name || 'Member',
        date: contributionDate,
        month: record.month || contributionDate.slice(0, 7),
        amount: Number(record.amount) || 0,
        payment_method: record.payment_method || 'mobile_money',
        payment_channel: record.payment_channel || null,
        reference_no: record.reference_no || null,
        notes: record.notes || null,
        recorded_by: record.recorded_by || 'Church Office',
      };
    }

    case 'welfare_claims': {
      const memId =
        record.member_id && typeof record.member_id === 'string' && record.member_id.trim() !== ''
          ? record.member_id.trim()
          : record.id || 'MEM-GEN';
      const claimDate = cleanDate(record.date_submitted) || new Date().toISOString().split('T')[0];
      return {
        ...record,
        claim_number: record.claim_number || `BEN-${new Date().getFullYear()}-${record.id || '001'}`,
        member_id: memId,
        member_name: record.member_name || 'Member',
        category: record.category || 'emergency_relief',
        title: record.title || 'Welfare support',
        description: record.description || '',
        amount_requested: Number(record.amount_requested) || 0,
        amount_approved: record.amount_approved == null ? null : Number(record.amount_approved) || 0,
        status: record.status || 'pending',
        emergency_level: record.emergency_level || 'normal',
        date_submitted: claimDate,
        date_reviewed: cleanDate(record.date_reviewed),
        reviewed_by: record.reviewed_by || null,
        pastoral_notes: record.pastoral_notes || null,
        disbursement_date: cleanDate(record.disbursement_date),
        disbursement_method: record.disbursement_method || null,
        disbursement_channel: record.disbursement_channel || null,
        disbursement_voucher_no: record.disbursement_voucher_no || null,
        supporting_documents: record.supporting_documents || null,
      };
    }

    case 'church_accounts': {
      return {
        ...record,
        name: record.name || 'Main Church Account',
        account_type: record.account_type || 'bank',
        account_number: record.account_number || null,
        bank_or_provider: record.bank_or_provider || 'GCB Bank',
        current_balance: Number(record.current_balance) || 0,
        currency: record.currency || 'GHS',
        is_active: record.is_active !== false,
        description: record.description || null,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: record.updated_at || new Date().toISOString(),
      };
    }

    case 'church_finances': {
      return {
        ...record,
        transaction_type: record.transaction_type || 'expense',
        account_id: record.account_id || null,
        account_name: record.account_name || 'Main Operating Account',
        to_account_id: record.to_account_id || null,
        to_account_name: record.to_account_name || null,
        category: record.category || 'Operations',
        title: record.title || 'Church Expenditure',
        recipient_or_vendor: record.recipient_or_vendor || null,
        amount: Number(record.amount) || 0,
        currency: record.currency || 'GHS',
        date: cleanDate(record.date) || new Date().toISOString().split('T')[0],
        payment_method: record.payment_method || 'bank_transfer',
        reference_no: record.reference_no || null,
        department: record.department || null,
        budget_id: record.budget_id || null,
        description: record.description || null,
        notes: record.notes || null,
        approved_by: record.approved_by || null,
        receipt_url: record.receipt_url || null,
        recorded_by: record.recorded_by || null,
        status: record.status || 'completed',
        void_reason: record.void_reason || null,
        voided_by: record.voided_by || null,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: record.updated_at || new Date().toISOString(),
      };
    }

    case 'settings': {
      return {
        ...record,
        id: record.id || 'gwcc_global_settings',
        church_name: record.church_name || 'Greater Works City Church',
        short_name: record.short_name || 'GWCC',
        location: record.location || 'Joma, Accra, Ghana',
        address: record.address || 'Main High Street, Adjacent to Joma Market, Joma, Accra',
        gps_address: record.gps_address || 'GA-183-4921',
        phone: record.phone || '+233 24 456 7890',
        email: record.email || 'admin@greaterworkscitychurch.org',
        currency: record.currency || 'GHS',
        currency_symbol: record.currency_symbol || 'GH₵',
        timezone: record.timezone || 'Africa/Accra',
        updated_at: record.updated_at || new Date().toISOString(),
      };
    }

    case 'welfare_events': {
      return {
        ...record,
        title: record.title || 'Welfare Contribution Appeal',
        category: record.category || 'other',
        category_custom: record.category_custom || null,
        member_id: record.member_id || 'mem-1',
        member_name: record.member_name || 'Church Member',
        beneficiary_family_name: record.beneficiary_family_name || null,
        description: record.description || '',
        pastoral_notes: record.pastoral_notes || null,
        start_date: cleanDate(record.start_date) || new Date().toISOString().split('T')[0],
        end_date: cleanDate(record.end_date) || new Date().toISOString().split('T')[0],
        target_amount: record.target_amount ? Number(record.target_amount) : null,
        minimum_contribution: Math.max(20.0, Number(record.minimum_contribution) || 20.0),
        status: record.status || 'open',
        created_by: record.created_by || 'Church Administrator',
        created_at: record.created_at || new Date().toISOString(),
        updated_at: record.updated_at || new Date().toISOString(),
      };
    }

    case 'welfare_event_contributions': {
      return {
        ...record,
        event_id: record.event_id,
        member_id: record.member_id || 'mem-1',
        contributor_name: record.contributor_name || 'Member Contributor',
        contributor_phone: record.contributor_phone || null,
        tithe_number: record.tithe_number || null,
        amount: Math.max(20.0, Number(record.amount) || 20.0),
        payment_date: cleanDate(record.payment_date) || new Date().toISOString().split('T')[0],
        payment_method: record.payment_method || 'mobile_money',
        payment_channel: record.payment_channel || null,
        reference_no: record.reference_no || null,
        notes: record.notes || null,
        payment_status: record.payment_status || 'confirmed',
        recorded_by: record.recorded_by || 'Welfare Officer',
        corrected_by: record.corrected_by || null,
        finance_transaction_id: record.finance_transaction_id || null,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: record.updated_at || new Date().toISOString(),
      };
    }

    default:
      return record;
  }
}

// RESILIENT UPSERT FOR CHURCH SETTINGS
// Automatically handles remote Supabase databases where schema cache has not yet reloaded
// or where newly added columns (such as pastor_signature_url, general_secretary, etc.) are pending migration.
export async function upsertSettingsWithFallback(
  client: SupabaseClient,
  rawPayload: any
): Promise<{ error: any }> {
  let payload: any = {
    id: 'gwcc_global_settings',
    ...rawPayload,
    updated_at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await client.from('settings').upsert(payload);
    if (!error) {
      return { error: null };
    }

    const msg = error.message || '';
    const details = String(error.details || '');
    const hint = String((error as any).hint || '');
    const combined = `${msg} ${details} ${hint}`;

    // Detect PostgREST schema cache missing column error:
    // e.g. "Could not find the 'pastor_signature_url' column of 'settings' in the schema cache"
    const match = combined.match(/Could not find the '([^']+)' column of 'settings'/i);
    if (match && match[1] && match[1] in payload) {
      const colToRemove = match[1];
      delete payload[colToRemove];
      continue;
    }

    if (combined.includes('pastor_signature_url') && 'pastor_signature_url' in payload) {
      delete payload.pastor_signature_url;
      continue;
    }

    if (combined.includes('general_secretary') && 'general_secretary' in payload) {
      delete payload.general_secretary;
      continue;
    }

    if (combined.includes('senior_pastor') && 'senior_pastor' in payload) {
      delete payload.senior_pastor;
      continue;
    }

    if (combined.includes('branch_name') && 'branch_name' in payload) {
      delete payload.branch_name;
      continue;
    }

    if (combined.includes('tagline') && 'tagline' in payload) {
      delete payload.tagline;
      continue;
    }

    if (combined.includes('website') && 'website' in payload) {
      delete payload.website;
      continue;
    }

    // Unrecoverable error
    return { error };
  }

  return { error: null };
}

// PUSH ALL DATA FROM LOCAL TO SUPABASE
export interface ChurchAllData {
  settings: ChurchSettings;
  members: Member[];
  visitors: Visitor[];
  services: ChurchService[];
  rosterAssignments?: RosterAssignment[];
  attendance: AttendanceRecord[];
  headcounts?: HeadcountRecord[];
  giving: GivingRecord[];
  expenses: ExpenseRecord[];
  churchAccounts?: ChurchAccount[];
  churchFinances?: ChurchFinanceRecord[];
  campaigns: PledgeCampaign[];
  pledges: PledgeRecord[];
  ministries: Ministry[];
  smallGroups: SmallGroup[];
  events: ChurchEvent[];
  pastoralCare: PastoralCareRecord[];
  prayerRequests: PrayerRequest[];
  communications: CommunicationRecord[];
  auditLogs: AuditLog[];
  welfareContributions?: WelfareContribution[];
  welfareClaims?: WelfareClaim[];
  welfareEvents?: WelfareEvent[];
  welfareEventContributions?: WelfareEventContribution[];
  childCheckIns?: any[];
  assets?: any[];
  departmentBudgets?: any[];
  foundationCohorts?: any[];
  foundationStudents?: any[];
  pastoralVisitations?: any[];
  counselingSessions?: any[];
  intercessorySlots?: any[];
}

let syncOwner: string | null = null;
let syncRole:string|null=null;
let outbox: SyncOutbox | null = null;
let atomicChanges:Mutation[]|null=null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const emit = (name: string, detail: unknown) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name,{ detail }));
};

export async function setSyncIdentity(id: string | null,role:string|null=null) {
  if(id===syncOwner && role===syncRole && outbox){await outbox.ready;return;}
  let previousRole:string|null=null;
  try{previousRole=id?localStorage.getItem(`gwcc_cache_role_${id}`):null;}catch{}
  if(id && previousRole!==role){
    setCacheOwner(id);clearScopedCache();
    // A full preference/cache store must never prevent verified authentication.
    try{localStorage.setItem(`gwcc_cache_role_${id}`,role||'');}catch{}
  }
  syncRole=role;
  syncOwner=id; setCacheOwner(id);
  const active=id && typeof localStorage !== 'undefined' ? new SyncOutbox(id,localStorage,detail=>{if(syncOwner===id && outbox===active)emit('gwcc-sync-status',detail);}) : null;
  outbox=active;
  if(active)await active.ready;
  if(outbox!==active)return;
  emit('gwcc-sync-status',getSyncStatus());
}
export function clearPrivateCache() {
  clearScopedCache(); setSyncIdentity(null); emit('gwcc-cache-cleared',{});
}
export const getSyncStatus = (): SyncResult => outbox?.status || {success:true,pending:0};
export const hasPendingChanges=(table:string)=>Boolean(outbox?.pendingChanges.some(change=>change.table===table));
export const exportPendingChanges=()=>outbox?.exportPending()||'{}';
export const previewPendingChanges=()=>outbox?.previewPending()||'{}';
export async function restorePendingChanges(raw:string){
  const active=outbox;if(!active)throw new Error('Sign in as the backup’s original owner first.');
  const count=await active.restorePending(raw);if(active!==outbox)throw new Error('The signed-in account changed. The backup remains with its original owner.');
  emit('gwcc-sync-status',active.status);return count;
}
export async function discardPendingChanges(expectedExport?:string){await outbox?.discardPending(expectedExport);emit('gwcc-reload-cloud',{});}
export function withSyncTransaction<T>(work:()=>T):T {
  if(atomicChanges)return work();
  atomicChanges=[];
  try {const value=work();const changes=atomicChanges;atomicChanges=null;if(changes.length)void queueMany(changes);return value;}
  catch(error){atomicChanges=null;throw error;}
}
export const mergePendingRecords = (table: string, rows: any[]) => outbox?.merge(table,rows) || rows;

export async function flushSyncOutbox({approveRestored=false}:{approveRestored?:boolean}={}): Promise<SyncResult> {
  const client=getSupabaseClient(); const active=outbox; const owner=syncOwner;
  if(!client || !active || !owner) return {success:false,pending:active?.status.pending || 0,error:'Please sign in to synchronize changes.'};
  await active.ready;
  if(active!==outbox || owner!==syncOwner)return {success:false,pending:active.status.pending,error:'The signed-in account changed. Pending changes remain with their owner.'};
  if(typeof navigator!=='undefined' && !navigator.onLine) return {...active.status,success:false,error:'Offline. Changes remain queued on this device.'};
  const { data: {session} }=await client.auth.getSession();
  if(!session || session.user.id!==owner) return {...active.status,success:false,error:'Please sign in again to synchronize these changes.'};
  const config=getStoredSupabaseConfig();
  const fixedClient=createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${session.access_token}`}}});
  const transport={rpc:(name:string,args:any)=>owner===syncOwner && active===outbox?fixedClient.rpc(name,args):Promise.resolve({data:null,error:{message:'The signed-in account changed. Remaining changes were kept for their owner.'}})};
  return active.flush(transport,records=>{
    if(owner===syncOwner) emit('gwcc-sync-records',{owner,records});
  },approveRestored);
}
async function queueMany(changes:Mutation[],autoFlush=true):Promise<SyncResult> {
  if(!outbox) return {success:false,pending:0,error:'A verified staff session is required.'};
  const active=outbox;
  try {
    const result=await active.enqueueMany(changes);
    if(active!==outbox)return {success:false,pending:active.status.pending,error:'The signed-in account changed. Pending changes remain with their owner.'};
    if(autoFlush){if(flushTimer) clearTimeout(flushTimer);flushTimer=setTimeout(()=>{flushTimer=null;void flushSyncOutbox();},100);}
    return {...result,durable:true};
  } catch(error) {
    const result={success:false,pending:active.status.pending,error:`Device storage could not preserve this change: ${(error as Error).message}`};
    if(active===outbox)emit('gwcc-sync-status',result); return result;
  }
}
function queue(change:Mutation):Promise<SyncResult>{
  if(atomicChanges){atomicChanges.push(change);return Promise.resolve({...getSyncStatus(),success:false});}
  return queueMany([change]);
}
function upsertMutation(table:string,record:any):Mutation {
  const sanitized={...sanitizeRecordForSupabase(table,record)};
  if(!sanitized.id)throw new Error('Record ID is required.');
  sanitized.id=String(sanitized.id);
  const expected=record._expected_updated_at;
  delete sanitized._expected_updated_at;delete sanitized._sync_status;
  return {table,operation:'upsert',id:String(sanitized.id),record:sanitized,expected_updated_at:expected};
}
export async function dbSyncUpsert(table: string, record: any): Promise<SyncResult> {
  if(!record) return {success:false,pending:getSyncStatus().pending,error:'A record is required.'};
  try{return queue(upsertMutation(table,record));}catch(error){return {success:false,pending:getSyncStatus().pending,error:(error as Error).message};}
}
export async function dbSyncDelete(table: string, id: string): Promise<SyncResult> {
  return queue({table,operation:'delete',id});
}

export const SYNC_TABLES: Array<{table:string;key:keyof ChurchAllData;document?:boolean}> = [
  ['settings','settings'],['members','members'],['visitors','visitors'],['services','services'],['attendance','attendance'],
  ['headcounts','headcounts'],['giving','giving'],['church_accounts','churchAccounts'],['church_finances','churchFinances'],
  ['pledge_campaigns','campaigns'],['pledges','pledges'],['expenses','expenses'],['ministries','ministries'],['small_groups','smallGroups'],
  ['events','events'],['pastoral_care','pastoralCare'],['prayer_requests','prayerRequests'],['communications','communications'],
  ['audit_logs','auditLogs'],['welfare_contributions','welfareContributions'],['welfare_claims','welfareClaims'],
  ['welfare_events','welfareEvents'],['welfare_event_contributions','welfareEventContributions'],['roster_assignments','rosterAssignments'],
  ['child_check_ins','childCheckIns'],
].map(([table,key])=>({table,key:key as keyof ChurchAllData})).concat([
  ['assets','assets'],['department_budgets','departmentBudgets'],['foundation_cohorts','foundationCohorts'],
  ['foundation_students','foundationStudents'],['pastoral_visitations','pastoralVisitations'],
  ['counseling_sessions','counselingSessions'],['intercessory_slots','intercessorySlots'],
].map(([table,key])=>({table,key:key as keyof ChurchAllData,document:true})));

export async function fetchAllRows(client: SupabaseClient, table: string, namespace?: string): Promise<any[]> {
  const rows:any[]=[]; let offset=0;
  while(true) {
    let query=client.from(table).select('*').order('id',{ascending:true});
    if(namespace) query=query.eq('namespace',namespace);
    const {data,error}=await query.range(offset,offset+499);
    if(error) throw error;
    const page=data || []; rows.push(...page); offset+=page.length;
    if(page.length===0) return rows;
  }
}
export async function pullAllDataFromSupabase(): Promise<{success:boolean;data:Partial<ChurchAllData>;errors:string[]}> {
  const client=getSupabaseClient();
  if(!client || !syncOwner) return {success:false,data:{},errors:['Please sign in before loading church records.']};
  const owner=syncOwner,active=outbox;
  await active?.ready;
  const result:Partial<ChurchAllData>={}; const errors:string[]=[];
  await Promise.allSettled(SYNC_TABLES.map(async({table,key,document})=>{
    if(table==='communications'&&!COMMUNICATION_ROLES.includes(syncRole||'')){result.communications=[];return;}
    try {
      let records:any[];
      if(syncRole==='member' && ['welfare_claims','pastoral_care','welfare_events','foundation_cohorts','foundation_students'].includes(table)){
        const {data,error}=await client.rpc('gwcc_member_records',{p_table:table});if(error)throw error;records=data||[];
      }else {const rows=await fetchAllRows(client,document?'gwcc_documents':table,document?table:undefined);records=document?rows.map(row=>row.data):rows;}
      if(owner!==syncOwner)return;
      await active?.observe(table,records);
      const merged=active?.merge(table,records)||records;
      if(key==='settings') result.settings=merged[0] || undefined;
      else (result as any)[key]=merged;
    } catch(error) { errors.push(`${table}: ${(error as Error).message}`); }
  }));
  if(owner!==syncOwner)return {success:false,data:{},errors:['The signed-in account changed.']};
  return {success:errors.length===0,data:result,errors};
}
export async function pushAllDataToSupabase(data:ChurchAllData,onProgress?:(step:string,percent:number)=>void) {
  const summary:Record<string,number>={};
  const owner=syncOwner,active=outbox;
  const changedAccount=()=>!owner || syncOwner!==owner || outbox!==active;
  const changedMessage='The signed-in account changed. Bulk sync stopped; remaining records were not queued.';
  const initial=await flushSyncOutbox({approveRestored:true});
  if(!initial.success)return {success:false,summary,errors:[initial.error || 'Pending changes are still waiting for cloud confirmation.']};
  for(const [index,{table,key}] of SYNC_TABLES.entries()) {
    if(changedAccount())return {success:false,summary,errors:[changedMessage]};
    if(key==='auditLogs') continue; // Existing server audit history is never rewritten.
    const records=key==='settings' ? [data.settings] : ((data as any)[key] || []);
    summary[table]=0;
    let chunk:Mutation[]=[],bytes=0;
    const confirm=async()=>{
      if(!chunk.length)return null;
      if(changedAccount())return changedMessage;
      const queued=await queueMany(chunk,false);if(queued.error)return queued.error;
      if(changedAccount())return changedMessage;
      const status=await flushSyncOutbox();if(!status.success)return status.error || 'Records are still waiting for cloud confirmation.';
      summary[table]+=chunk.length;chunk=[];bytes=0;return null;
    };
    for(const record of records){
      let change:Mutation;
      try{change=upsertMutation(table,record);}catch(error){return {success:false,summary,errors:[(error as Error).message]};}
      const size=new TextEncoder().encode(JSON.stringify(change)).byteLength;
      if(chunk.length && (chunk.length>=50 || bytes+size>128000)){const error=await confirm();if(error)return {success:false,summary,errors:[error]};}
      chunk.push(change);bytes+=size;
    }
    const error=await confirm();if(error)return {success:false,summary,errors:[error]};
    onProgress?.(table,Math.round((index+1)/SYNC_TABLES.length*100));
  }
  const status=await flushSyncOutbox();
  return {success:status.success,summary,errors:status.error?[status.error]:[]};
}
export async function syncRosterAssignmentToSupabase(assignment:RosterAssignment):Promise<{success:boolean;error?:string}> {
  await dbSyncUpsert('roster_assignments',assignment);return flushSyncOutbox();
}
export async function deleteRosterAssignmentFromSupabase(id:string):Promise<{success:boolean;error?:string}> {
  await dbSyncDelete('roster_assignments',id);return flushSyncOutbox();
}

if(typeof window!=='undefined') window.addEventListener('online',()=>{void flushSyncOutbox();});
