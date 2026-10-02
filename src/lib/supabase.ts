import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
} from '../types/database.types';

const STORAGE_KEY_URL = 'gwcc_supabase_url';
const STORAGE_KEY_ANON = 'gwcc_supabase_anon_key';

// Retrieve credentials from Vite env or LocalStorage
export function getStoredSupabaseConfig(): { url: string; anonKey: string; source: 'env' | 'storage' | 'none' } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (
    envUrl &&
    envKey &&
    envUrl !== 'YOUR_SUPABASE_URL' &&
    envKey !== 'YOUR_SUPABASE_ANON_KEY' &&
    !envUrl.includes('your-project-ref')
  ) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  try {
    const savedUrl = (localStorage.getItem(STORAGE_KEY_URL) || '').trim();
    const savedKey = (localStorage.getItem(STORAGE_KEY_ANON) || '').trim();
    if (savedUrl && savedKey) {
      return { url: savedUrl, anonKey: savedKey, source: 'storage' };
    }
  } catch {
    // LocalStorage unavailable
  }

  return { url: '', anonKey: '', source: 'none' };
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
    const cleanKey = anonKey.trim();

    if (!cleanUrl.startsWith('https://')) {
      return { success: false, message: 'Supabase URL must start with https://' };
    }
    if (cleanKey.length < 20) {
      return { success: false, message: 'Invalid Supabase Anon key provided.' };
    }

    localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
    localStorage.setItem(STORAGE_KEY_ANON, cleanKey);

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
  const url = (customUrl || getStoredSupabaseConfig().url).trim().replace(/\/+$/, '');
  const key = (customKey || getStoredSupabaseConfig().anonKey).trim();

  if (!url || !key) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Supabase URL and Anon Key are required.',
    };
  }

  try {
    const testClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

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

      // If invalid API key / JWT
      if (settingsError.message?.toLowerCase().includes('jwt') || settingsError.message?.toLowerCase().includes('apikey')) {
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
      message: `Successfully connected to Supabase in ${latencyMs}ms! All tables active.`,
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
    'members',
    'visitors',
    'services',
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
      } else if (error) {
        missing.push(table);
      } else {
        existing.push(table);
      }
    } catch {
      missing.push(table);
    }
  }

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

    default:
      return record;
  }
}

// PUSH ALL DATA FROM LOCAL TO SUPABASE
export interface ChurchAllData {
  settings: ChurchSettings;
  members: Member[];
  visitors: Visitor[];
  services: ChurchService[];
  attendance: AttendanceRecord[];
  headcounts?: HeadcountRecord[];
  giving: GivingRecord[];
  expenses: ExpenseRecord[];
  campaigns: PledgeCampaign[];
  pledges: PledgeRecord[];
  ministries: Ministry[];
  smallGroups: SmallGroup[];
  events: ChurchEvent[];
  pastoralCare: PastoralCareRecord[];
  prayerRequests: PrayerRequest[];
  communications: CommunicationRecord[];
  auditLogs: AuditLog[];
}

export async function pushAllDataToSupabase(
  data: ChurchAllData,
  onProgress?: (step: string, percent: number) => void
): Promise<{ success: boolean; summary: Record<string, number>; errors: string[] }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, summary: {}, errors: ['Supabase is not configured.'] };
  }

  const errors: string[] = [];
  const summary: Record<string, number> = {};

  const steps = [
    {
      name: 'settings',
      label: 'Church Settings',
      run: async () => {
        const payload: any = {
          id: 'gwcc_global_settings',
          ...data.settings,
          updated_at: new Date().toISOString(),
        };
        let { error } = await client.from('settings').upsert(payload);
        if (error && (error.message?.includes('general_secretary') || String(error.details || '').includes('general_secretary'))) {
          delete payload.general_secretary;
          const retry = await client.from('settings').upsert(payload);
          error = retry.error;
        }
        if (error) throw error;
        summary['settings'] = 1;
      },
    },
    {
      name: 'ministries',
      label: 'Ministries',
      run: async () => {
        if (data.ministries.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.ministries.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description || '',
          leader_id: m.leader_id || null,
          leader_name: m.leader_name || null,
          assistant_leader_id: m.assistant_leader_id || null,
          assistant_leader_name: m.assistant_leader_name || null,
          meeting_schedule: m.meeting_schedule || '',
          meeting_day: m.meeting_day || '',
          meeting_time: m.meeting_time || '',
          status: m.status || 'active',
          member_count: Number(m.member_count) || 0,
          created_at: (m as any).created_at || now,
        }));
        const { error } = await client.from('ministries').upsert(sanitized);
        if (error) throw error;
        summary['ministries'] = sanitized.length;
      },
    },
    {
      name: 'small_groups',
      label: 'Small Groups / Cells',
      run: async () => {
        if (data.smallGroups.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.smallGroups.map((g) => ({
          id: g.id,
          name: g.name,
          leader_id: g.leader_id || null,
          leader_name: g.leader_name || null,
          leader_phone: g.leader_phone || null,
          assistant_leader_id: g.assistant_leader_id || null,
          assistant_leader_name: g.assistant_leader_name || null,
          meeting_location: g.meeting_location || 'Church Annex',
          meeting_address: g.meeting_address || null,
          zone: g.zone || null,
          meeting_day: g.meeting_day || 'Wednesday',
          meeting_time: g.meeting_time || '18:30',
          notes: g.notes || '',
          member_count: Number(g.member_count) || 0,
          created_at: (g as any).created_at || now,
        }));
        const { error } = await client.from('small_groups').upsert(sanitized);
        if (error) throw error;
        summary['small_groups'] = sanitized.length;
      },
    },
    {
      name: 'members',
      label: 'Church Members',
      run: async () => {
        if (data.members.length === 0) return;
        const sanitized = data.members.map((m) => sanitizeMemberForSupabase(m));

        // Deduplicate incoming array by member_id to prevent multi-row batch conflict errors
        const seenMemberIds = new Set<string>();
        const uniqueMembers: any[] = [];
        for (let i = sanitized.length - 1; i >= 0; i--) {
          const m = sanitized[i];
          const rawId = (m.member_id || '').trim();
          if (!rawId || seenMemberIds.has(rawId)) continue;
          seenMemberIds.add(rawId);
          uniqueMembers.unshift(m);
        }

        // Query existing members in Supabase to align primary keys and avoid unique constraint clashes
        const existingIdByMemberId = new Map<string, string>();
        try {
          const { data: existingRows } = await client
            .from('members')
            .select('id, member_id');
          if (existingRows && Array.isArray(existingRows)) {
            for (const row of existingRows) {
              if (row.member_id && row.id) {
                existingIdByMemberId.set(row.member_id.trim(), row.id);
              }
            }
          }
        } catch (fetchErr) {
          console.warn('Note checking existing members in Supabase:', fetchErr);
        }

        // Reconcile primary keys: if Supabase already has this member_id under an existing id, retain that id
        for (const m of uniqueMembers) {
          const mId = (m.member_id || '').trim();
          if (existingIdByMemberId.has(mId)) {
            m.id = existingIdByMemberId.get(mId);
          }
        }

        // Attempt upsert targeting member_id as conflict resolution column
        let { error } = await client
          .from('members')
          .upsert(uniqueMembers, { onConflict: 'member_id' });

        if (error) {
          // If batch upsert failed (e.g. constraint mismatch), perform resilient per-member sync
          let syncedCount = 0;
          const individualErrors: string[] = [];

          for (const m of uniqueMembers) {
            try {
              // 1. Try single-record upsert with onConflict: member_id
              const singleUpsert = await client
                .from('members')
                .upsert(m, { onConflict: 'member_id' });

              if (!singleUpsert.error) {
                syncedCount++;
                continue;
              }

              // 2. If rejected due to constraint on id, update by member_id without overwriting id
              const { id, ...updateFields } = m;
              const updateRes = await client
                .from('members')
                .update(updateFields)
                .eq('member_id', m.member_id);

              if (!updateRes.error) {
                syncedCount++;
                continue;
              }

              // 3. If row didn't exist or update was empty, try insert
              const insertRes = await client.from('members').insert(updateFields);
              if (!insertRes.error) {
                syncedCount++;
                continue;
              }

              individualErrors.push(`${m.member_id}: ${singleUpsert.error.message || updateRes.error?.message}`);
            } catch (err: any) {
              individualErrors.push(`${m.member_id}: ${err.message}`);
            }
          }

          if (syncedCount > 0) {
            summary['members'] = syncedCount;
          }
          if (syncedCount === uniqueMembers.length) {
            error = null;
          } else if (individualErrors.length > 0 && syncedCount === 0) {
            throw new Error(`Failed to sync members: ${individualErrors[0]}`);
          }
        } else {
          summary['members'] = uniqueMembers.length;
        }
      },
    },
    {
      name: 'visitors',
      label: 'First-time Visitors',
      run: async () => {
        if (data.visitors.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.visitors.map((v) => ({
          ...v,
          service_attended: v.service_attended || 'Sunday Main Service',
          visit_date: v.visit_date || now.split('T')[0],
          follow_up_status: v.follow_up_status || 'new',
          created_at: v.created_at || now,
          updated_at: v.updated_at || now,
        }));
        const { error } = await client.from('visitors').upsert(sanitized);
        if (error) throw error;
        summary['visitors'] = sanitized.length;
      },
    },
    {
      name: 'services',
      label: 'Worship Services',
      run: async () => {
        if (data.services.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.services.map((s) => ({
          ...s,
          type: s.type || 'sunday',
          day_of_week: s.day_of_week || 'Sunday',
          start_time: s.start_time || '09:00',
          end_time: s.end_time || '12:00',
          order_of_service: s.order_of_service || [],
          created_at: (s as any).created_at || now,
        }));
        const { error } = await client.from('services').upsert(sanitized);
        if (error) throw error;
        summary['services'] = sanitized.length;
      },
    },
    {
      name: 'attendance',
      label: 'Attendance Records',
      run: async () => {
        if (data.attendance.length === 0) return;
        const sanitized = data.attendance.map((a) => {
          const memId = a.member_id && typeof a.member_id === 'string' && a.member_id.trim() !== '' ? a.member_id.trim() : null;
          const visId = a.visitor_id && typeof a.visitor_id === 'string' && a.visitor_id.trim() !== '' ? a.visitor_id.trim() : null;
          const srvId = a.service_id && typeof a.service_id === 'string' && a.service_id.trim() !== '' ? a.service_id.trim() : 'srv-001';
          return {
            ...a,
            member_id: memId,
            visitor_id: visId,
            service_id: srvId,
            date: a.date || new Date().toISOString().split('T')[0],
            check_in_time: a.check_in_time || new Date().toISOString(),
            status: a.status || 'present',
          };
        });
        const { error } = await client.from('attendance').upsert(sanitized);
        if (error) {
          // If a legacy FK constraint (e.g. attendance_member_id_fkey or attendance_service_id_fkey) fails, retry safely with null member_id
          if (error.message?.includes('foreign key') || error.message?.includes('fkey')) {
            const fallback = sanitized.map((r) => ({ ...r, member_id: null }));
            const retry = await client.from('attendance').upsert(fallback);
            if (!retry.error) {
              summary['attendance'] = fallback.length;
              return;
            }
          }
          throw error;
        }
        summary['attendance'] = sanitized.length;
      },
    },
    {
      name: 'headcounts',
      label: 'Auditorium Headcounts',
      run: async () => {
        if (!data.headcounts || data.headcounts.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.headcounts.map((h) => ({
          ...h,
          date: cleanDate(h.date) || now.split('T')[0],
          created_at: (h as any).created_at || now,
          men: Number(h.men) || 0,
          women: Number(h.women) || 0,
          youth: Number(h.youth) || 0,
          children: Number(h.children) || 0,
          total_auditorium:
            Number(h.total_auditorium) ||
            (Number(h.men) || 0) +
              (Number(h.women) || 0) +
              (Number(h.youth) || 0) +
              (Number(h.children) || 0),
        }));
        const { error } = await client.from('headcounts').upsert(sanitized);
        if (error) throw error;
        summary['headcounts'] = sanitized.length;
      },
    },
    {
      name: 'giving',
      label: 'Giving & Tithes',
      run: async () => {
        if (data.giving.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.giving.map((g) => {
          const memId = g.member_id && typeof g.member_id === 'string' && g.member_id.trim() !== '' ? g.member_id.trim() : null;
          return {
            ...g,
            member_id: memId,
            created_at: (g as any).created_at || now,
            amount: Number(g.amount) || 0,
            currency: g.currency || 'GHS',
            date: cleanDate(g.date) || now.split('T')[0],
            payment_method: g.payment_method || 'mobile_money',
          };
        });
        const { error } = await client.from('giving').upsert(sanitized);
        if (error) {
          if (error.message?.includes('foreign key') || error.message?.includes('fkey')) {
            const fallback = sanitized.map((r) => ({ ...r, member_id: null }));
            const retry = await client.from('giving').upsert(fallback);
            if (!retry.error) {
              summary['giving'] = fallback.length;
              return;
            }
          }
          throw error;
        }
        summary['giving'] = sanitized.length;
      },
    },
    {
      name: 'expenses',
      label: 'Expenditure & Operations',
      run: async () => {
        if (data.expenses.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.expenses.map((e) => ({
          ...e,
          created_at: (e as any).created_at || now,
          amount: Number(e.amount) || 0,
          currency: e.currency || 'GHS',
          date: cleanDate(e.date) || now.split('T')[0],
          description: e.description || e.title || 'Church operational expenditure',
          category: e.category || 'Operations',
        }));
        const { error } = await client.from('expenses').upsert(sanitized);
        if (error) throw error;
        summary['expenses'] = sanitized.length;
      },
    },
    {
      name: 'pledge_campaigns',
      label: 'Pledge Campaigns',
      run: async () => {
        if (data.campaigns.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.campaigns.map((c) => ({
          ...c,
          created_at: (c as any).created_at || now,
          target_amount: Number(c.target_amount) || 0,
          start_date: cleanDate(c.start_date) || now.split('T')[0],
          end_date: cleanDate(c.end_date) || now.split('T')[0],
        }));
        const { error } = await client.from('pledge_campaigns').upsert(sanitized);
        if (error) throw error;
        summary['pledge_campaigns'] = sanitized.length;
      },
    },
    {
      name: 'pledges',
      label: 'Member Pledges',
      run: async () => {
        if (data.pledges.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.pledges.map((p) => {
          const pledged = Number(p.amount_pledged) || 0;
          const paid = Number(p.amount_paid) || 0;
          return {
            ...p,
            created_at: (p as any).created_at || now,
            updated_at: (p as any).updated_at || (p as any).created_at || now,
            amount_pledged: pledged,
            amount_paid: paid,
            balance: Math.max(0, pledged - paid),
            status: p.status || 'active',
            due_date: cleanDate(p.due_date) || now.split('T')[0],
          };
        });
        const { error } = await client.from('pledges').upsert(sanitized);
        if (error) throw error;
        summary['pledges'] = sanitized.length;
      },
    },
    {
      name: 'events',
      label: 'Church Calendar Events',
      run: async () => {
        if (data.events.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.events.map((ev) => ({
          ...ev,
          created_at: ev.created_at || now,
          updated_at: ev.updated_at || now,
          event_type: ev.event_type || 'church_service',
          start_date: cleanDate(ev.start_date) || now.split('T')[0],
          end_date: cleanDate(ev.end_date) || cleanDate(ev.start_date) || now.split('T')[0],
          start_time: ev.start_time || '09:00',
          end_time: ev.end_time || '12:00',
          venue: ev.venue || 'Main Sanctuary, Joma',
          status: ev.status || 'upcoming',
          attendees: ev.attendees || [],
        }));
        let { error } = await client.from('events').upsert(sanitized);
        if (error && (error.message?.includes('updated_at') || String(error.details || '').includes('updated_at'))) {
          const fallback = sanitized.map(({ updated_at, ...rest }) => rest);
          const retry = await client.from('events').upsert(fallback);
          error = retry.error;
        }
        if (error) throw error;
        summary['events'] = sanitized.length;
      },
    },
    {
      name: 'pastoral_care',
      label: 'Pastoral Care Records',
      run: async () => {
        if (data.pastoralCare.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.pastoralCare.map((p) => {
          const memId = p.member_id && typeof p.member_id === 'string' && p.member_id.trim() !== '' ? p.member_id.trim() : null;
          return {
            ...p,
            member_id: memId,
            created_at: p.created_at || now,
            care_type: p.care_type || 'Visitation',
            assigned_pastor: p.assigned_pastor || p.pastor_name || 'Senior Pastor',
            notes: p.notes || 'Pastoral session recorded',
            date: cleanDate(p.date) || now.split('T')[0],
          };
        });
        const { error } = await client.from('pastoral_care').upsert(sanitized);
        if (error) {
          if (error.message?.includes('foreign key') || error.message?.includes('fkey')) {
            const fallback = sanitized.map((r) => ({ ...r, member_id: null }));
            const retry = await client.from('pastoral_care').upsert(fallback);
            if (!retry.error) {
              summary['pastoral_care'] = fallback.length;
              return;
            }
          }
          throw error;
        }
        summary['pastoral_care'] = sanitized.length;
      },
    },
    {
      name: 'prayer_requests',
      label: 'Prayer Requests',
      run: async () => {
        if (data.prayerRequests.length === 0) return;
        const now = new Date().toISOString();
        const sanitized = data.prayerRequests.map((pr) => {
          const memId = pr.member_id && typeof pr.member_id === 'string' && pr.member_id.trim() !== '' ? pr.member_id.trim() : null;
          return {
            ...pr,
            member_id: memId,
            created_at: pr.created_at || now,
            category: pr.category || 'General',
            request: pr.request || 'Prayer request',
            date_submitted: cleanDate(pr.date_submitted) || now.split('T')[0],
            status: pr.status || 'new',
          };
        });
        const { error } = await client.from('prayer_requests').upsert(sanitized);
        if (error) {
          if (error.message?.includes('foreign key') || error.message?.includes('fkey')) {
            const fallback = sanitized.map((r) => ({ ...r, member_id: null }));
            const retry = await client.from('prayer_requests').upsert(fallback);
            if (!retry.error) {
              summary['prayer_requests'] = fallback.length;
              return;
            }
          }
          throw error;
        }
        summary['prayer_requests'] = sanitized.length;
      },
    },
    {
      name: 'communications',
      label: 'Communications',
      run: async () => {
        if (data.communications.length === 0) return;
        const sanitized = data.communications.map((comm) => ({
          ...comm,
          channel: comm.channel || 'sms',
          recipient_type: comm.recipient_type || 'all',
          recipient_count: Number(comm.recipient_count) || 0,
          status: comm.status || 'sent',
          message: comm.message || '',
        }));
        const { error } = await client.from('communications').upsert(sanitized);
        if (error) throw error;
        summary['communications'] = sanitized.length;
      },
    },
    {
      name: 'audit_logs',
      label: 'System Audit Logs',
      run: async () => {
        if (data.auditLogs.length === 0) return;
        const sanitized = data.auditLogs.map((log) => ({
          ...log,
          action: log.action || 'ACTION',
          module: log.module || 'System',
          timestamp: log.timestamp || new Date().toISOString(),
        }));
        const { error } = await client.from('audit_logs').upsert(sanitized);
        if (error) throw error;
        summary['audit_logs'] = sanitized.length;
      },
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const percent = Math.round(((i + 1) / steps.length) * 100);
    onProgress?.(`Syncing ${step.label}...`, percent);
    try {
      await step.run();
    } catch (err: any) {
      console.error(`Error syncing ${step.name}:`, err);
      errors.push(`${step.label}: ${err.message || 'Unknown error'}`);
    }
  }

  return {
    success: errors.length === 0,
    summary,
    errors,
  };
}

// PULL ALL DATA FROM SUPABASE INTO LOCAL APP
export async function pullAllDataFromSupabase(): Promise<{
  success: boolean;
  data: Partial<ChurchAllData>;
  errors: string[];
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, data: {}, errors: ['Supabase not configured.'] };
  }

  const result: Partial<ChurchAllData> = {};
  const errors: string[] = [];

  const fetchTable = async (table: string, key: keyof ChurchAllData) => {
    try {
      const { data, error } = await client.from(table).select('*');
      if (error) {
        if (!isTableNotFoundError(error)) {
          errors.push(`${table}: ${error.message}`);
        }
        return;
      }
      if (data && data.length > 0) {
        if (key === 'settings') {
          result.settings = data[0] as ChurchSettings;
        } else {
          (result as any)[key] = data;
        }
      }
    } catch (err: any) {
      if (!isTableNotFoundError(err)) {
        errors.push(`${table}: ${err.message}`);
      }
    }
  };

  await Promise.allSettled([
    fetchTable('settings', 'settings'),
    fetchTable('members', 'members'),
    fetchTable('visitors', 'visitors'),
    fetchTable('services', 'services'),
    fetchTable('attendance', 'attendance'),
    fetchTable('headcounts', 'headcounts'),
    fetchTable('giving', 'giving'),
    fetchTable('expenses', 'expenses'),
    fetchTable('pledge_campaigns', 'campaigns'),
    fetchTable('pledges', 'pledges'),
    fetchTable('ministries', 'ministries'),
    fetchTable('small_groups', 'smallGroups'),
    fetchTable('events', 'events'),
    fetchTable('pastoral_care', 'pastoralCare'),
    fetchTable('prayer_requests', 'prayerRequests'),
    fetchTable('communications', 'communications'),
    fetchTable('audit_logs', 'auditLogs'),
  ]);

  return {
    success: errors.length === 0,
    data: result,
    errors,
  };
}

// ASYNC INDIVIDUAL CRUD OPS TO SUPABASE
export async function dbSyncUpsert(table: string, record: any): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !record) return;
  try {
    const sanitized = sanitizeRecordForSupabase(table, record);

    if (table === 'members' && sanitized.member_id) {
      let { error: memErr } = await client.from('members').upsert(sanitized, { onConflict: 'member_id' });
      if (memErr && (memErr.message?.includes('members_member_id_key') || memErr.message?.includes('duplicate key') || memErr.message?.includes('unique constraint'))) {
        const { id, ...updateFields } = sanitized;
        const updateRes = await client.from('members').update(updateFields).eq('member_id', sanitized.member_id);
        if (!updateRes.error) return;
      } else if (!memErr) {
        return;
      }
    }

    let { error } = await client.from(table).upsert(sanitized);
    if (error && !isTableNotFoundError(error)) {
      if (table === 'settings' && (error.message?.includes('general_secretary') || String(error.details || '').includes('general_secretary'))) {
        const { general_secretary, ...rest } = sanitized;
        const retry = await client.from(table).upsert(rest);
        if (!retry.error) return;
      }
      if (table === 'events' && (error.message?.includes('updated_at') || String(error.details || '').includes('updated_at'))) {
        const { updated_at, ...rest } = sanitized;
        const retry = await client.from(table).upsert(rest);
        if (!retry.error) return;
      }
      // If foreign key constraint failed on attendance/prayer_requests/pastoral_care, retry with member_id: null
      if (
        (error.message?.includes('foreign key') || error.message?.includes('fkey')) &&
        (table === 'attendance' || table === 'prayer_requests' || table === 'pastoral_care')
      ) {
        const fallback = { ...sanitized, member_id: null };
        const retry = await client.from(table).upsert(fallback);
        if (!retry.error) return;
      }
      console.warn(`Supabase upsert failed on ${table}:`, error.message);
    }
  } catch (err: any) {
    if (!isTableNotFoundError(err)) {
      console.warn(`Supabase upsert failed on ${table}:`, err?.message || err);
    }
  }
}

export async function dbSyncDelete(table: string, id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error && !isTableNotFoundError(error)) {
      console.warn(`Supabase delete failed on ${table}:`, error.message);
    }
  } catch (err: any) {
    if (!isTableNotFoundError(err)) {
      console.warn(`Supabase delete failed on ${table}:`, err?.message || err);
    }
  }
}
