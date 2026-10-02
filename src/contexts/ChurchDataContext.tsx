import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Member,
  Visitor,
  ChurchService,
  AttendanceRecord,
  HeadcountRecord,
  GivingRecord,
  PledgeRecord,
  PledgeCampaign,
  PledgeStatus,
  ExpenseRecord,
  Ministry,
  SmallGroup,
  ChurchEvent,
  PastoralCareRecord,
  PrayerRequest,
  CommunicationRecord,
  AuditLog,
  ChurchSettings,
  PaymentMethod,
} from '../types/database.types';
import {
  initialSettings,
  sampleMembers,
  sampleVisitors,
  sampleServices,
  sampleAttendance,
  sampleHeadcounts,
  sampleGiving,
  sampleCampaigns,
  samplePledges,
  sampleExpenses,
  sampleMinistries,
  sampleSmallGroups,
  sampleEvents,
  samplePastoralCare,
  samplePrayerRequests,
  sampleCommunications,
  sampleAuditLogs,
} from '../lib/initialData';
import { useAuth } from './AuthContext';
import {
  isSupabaseConfigured,
  getStoredSupabaseConfig,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  testSupabaseConnection,
  pushAllDataToSupabase,
  pullAllDataFromSupabase,
  dbSyncUpsert,
  dbSyncDelete,
  ChurchAllData,
} from '../lib/supabase';

export type SupabaseStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'tables_missing';

interface ChurchDataContextType {
  settings: ChurchSettings;
  updateSettings: (newSettings: Partial<ChurchSettings>) => void;

  // Members
  members: Member[];
  addMember: (member: Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'>) => Member;
  updateMember: (id: string, updates: Partial<Member>) => void;
  archiveMember: (id: string) => void;
  unarchiveMember: (id: string) => void;
  getMember: (id: string) => Member | undefined;

  // Visitors
  visitors: Visitor[];
  addVisitor: (visitor: Omit<Visitor, 'id' | 'created_at' | 'updated_at'>) => Visitor;
  updateVisitor: (id: string, updates: Partial<Visitor>) => void;
  deleteVisitor: (id: string) => void;
  convertVisitorToMember: (visitorId: string) => Member | undefined;

  // Attendance & Services
  services: ChurchService[];
  attendance: AttendanceRecord[];
  headcounts: HeadcountRecord[];
  createService: (service: Omit<ChurchService, 'id'>) => ChurchService;
  addService: (service: Omit<ChurchService, 'id'>) => ChurchService;
  updateService: (id: string, updates: Partial<ChurchService>) => void;
  deleteService: (id: string) => void;
  recordAttendance: (
    serviceId: string,
    personType: 'member' | 'visitor',
    personId: string,
    method?: 'manual' | 'search' | 'qr_code',
    customDate?: string
  ) => { success: boolean; message: string };
  batchRecordAttendance: (
    serviceId: string,
    date: string,
    items: Array<{ personType: 'member' | 'visitor'; personId: string; method?: 'manual' | 'search' | 'qr_code' }>
  ) => { added: number; skipped: number };
  deleteAttendanceRecord: (id: string) => void;
  removeAttendance: (id: string) => void;
  recordHeadcount: (headcount: Omit<HeadcountRecord, 'id' | 'created_at'>) => HeadcountRecord;
  updateHeadcount: (id: string, updates: Partial<HeadcountRecord>) => void;
  deleteHeadcount: (id: string) => void;

  // Finance & Giving
  giving: GivingRecord[];
  recordGiving: (record: Omit<GivingRecord, 'id' | 'created_at'>) => GivingRecord;
  updateGiving: (id: string, updates: Partial<GivingRecord>) => void;
  deleteGiving: (id: string) => void;
  expenses: ExpenseRecord[];
  recordExpense: (record: Omit<ExpenseRecord, 'id' | 'created_at'>) => ExpenseRecord;
  updateExpense: (id: string, updates: Partial<ExpenseRecord>) => void;
  deleteExpense: (id: string) => void;

  // Pledges
  campaigns: PledgeCampaign[];
  addCampaign: (campaign: Omit<PledgeCampaign, 'id'>) => PledgeCampaign;
  updateCampaign: (id: string, updates: Partial<PledgeCampaign>) => void;
  deleteCampaign: (id: string) => void;
  pledges: PledgeRecord[];
  createPledge: (pledge: Omit<PledgeRecord, 'id' | 'balance' | 'status' | 'created_at'>) => PledgeRecord;
  addPledge: (pledge: Omit<PledgeRecord, 'id' | 'balance' | 'status' | 'created_at'>) => PledgeRecord;
  updatePledge: (id: string, updates: Partial<PledgeRecord>) => void;
  deletePledge: (id: string) => void;
  recordPledgePayment: (
    pledgeId: string,
    amount: number,
    paymentDetails?: {
      method?: PaymentMethod;
      channel?: string;
      reference?: string;
      syncWithGiving?: boolean;
    }
  ) => void;

  // Ministries & Small Groups
  ministries: Ministry[];
  addMinistry: (ministry: Omit<Ministry, 'id' | 'member_count'>) => Ministry;
  updateMinistry: (id: string, updates: Partial<Ministry>) => void;
  deleteMinistry: (id: string) => void;
  assignMemberToMinistry: (memberId: string, ministryId: string, ministryName: string, role?: string) => void;
  removeMemberFromMinistry: (memberId: string) => void;
  smallGroups: SmallGroup[];
  addSmallGroup: (group: Omit<SmallGroup, 'id' | 'member_count'>) => SmallGroup;

  // Events
  events: ChurchEvent[];
  createEvent: (event: Omit<ChurchEvent, 'id'>) => ChurchEvent;
  updateEvent: (id: string, updates: Partial<ChurchEvent>) => void;
  deleteEvent: (id: string) => void;
  addEventAttendee: (
    eventId: string,
    attendee: { name: string; phone?: string; email?: string; member_id?: string; role?: string }
  ) => void;
  removeEventAttendee: (eventId: string, attendeeId: string) => void;
  toggleAttendeeCheckIn: (eventId: string, attendeeId: string) => void;

  // Pastoral Care & Prayer Requests
  pastoralCare: PastoralCareRecord[];
  addPastoralCare: (record: Omit<PastoralCareRecord, 'id' | 'created_at'>) => PastoralCareRecord;
  addPastoralCareLog: (record: Omit<PastoralCareRecord, 'id' | 'created_at'>) => PastoralCareRecord;
  prayerRequests: PrayerRequest[];
  addPrayerRequest: (record: Omit<PrayerRequest, 'id' | 'created_at'>) => PrayerRequest;
  updatePrayerStatus: (id: string, status: PrayerRequest['status'], testimony?: string) => void;

  // Communication
  communications: CommunicationRecord[];
  sendSMSMessage: (record: Omit<CommunicationRecord, 'id' | 'sent_at'>) => CommunicationRecord;

  // Audit Logs
  auditLogs: AuditLog[];
  logAction: (action: string, module: string, details: string, recordId?: string) => void;

  // Supabase Integration State & Actions
  isSupabaseConfigured: boolean;
  supabaseStatus: SupabaseStatus;
  supabaseError: string | null;
  lastSyncTime: string | null;
  supabaseConfig: { url: string; anonKey: string; source: 'env' | 'storage' | 'default' | 'none' };
  connectSupabase: (url: string, key: string) => Promise<{ success: boolean; message: string }>;
  disconnectSupabase: () => void;
  pushToSupabase: (onProgress?: (step: string, percent: number) => void) => Promise<{ success: boolean; summary: Record<string, number>; errors: string[] }>;
  pullFromSupabase: () => Promise<{ success: boolean; errors: string[] }>;

  // General Reset
  resetToSampleData: () => void;
  resetToDefaultData: () => void;
}

const ChurchDataContext = createContext<ChurchDataContextType | undefined>(undefined);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(`gwcc_${key}`);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

// Debounced batch storage saver to prevent main thread blocking
const pendingSaves = new Map<string, any>();
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function saveToStorage<T>(key: string, data: T) {
  pendingSaves.set(key, data);
  if (!saveDebounceTimer) {
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null;
      pendingSaves.forEach((val, k) => {
        try {
          localStorage.setItem(`gwcc_${k}`, JSON.stringify(val));
        } catch (err) {
          console.error(`Failed to save gwcc_${k}`, err);
        }
      });
      pendingSaves.clear();
    }, 150);
  }
}

export const ChurchDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const isInitialMount = React.useRef(true);

  const [settings, setSettings] = useState<ChurchSettings>(() => {
    const loaded = loadFromStorage('settings', initialSettings);
    if (!loaded.church_name || loaded.church_name === 'Church Management System') {
      return initialSettings;
    }
    const seniorPastor = (!loaded.senior_pastor || loaded.senior_pastor === 'Senior Pastor' || loaded.senior_pastor.includes('Agyemang-Prempeh') || loaded.senior_pastor.includes('Emmanuel'))
      ? initialSettings.senior_pastor
      : loaded.senior_pastor;
    const generalSecretary = (!loaded.general_secretary || loaded.general_secretary === 'General Secretary')
      ? initialSettings.general_secretary
      : loaded.general_secretary;
    return {
      ...initialSettings,
      ...loaded,
      senior_pastor: seniorPastor,
      general_secretary: generalSecretary,
    };
  });
  const [members, setMembers] = useState<Member[]>(() => {
    const loaded = loadFromStorage<Member[]>('members', []);
    return loaded && loaded.length > 0 ? loaded : sampleMembers;
  });
  const [visitors, setVisitors] = useState<Visitor[]>(() => {
    const loaded = loadFromStorage<Visitor[]>('visitors', []);
    return loaded && loaded.length > 0 ? loaded : sampleVisitors;
  });
  const [services, setServices] = useState<ChurchService[]>(() => {
    const loaded = loadFromStorage<ChurchService[]>('services', []);
    return loaded && loaded.length > 0 ? loaded : sampleServices;
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const loaded = loadFromStorage<AttendanceRecord[]>('attendance', []);
    return loaded && loaded.length > 0 ? loaded : sampleAttendance;
  });
  const [headcounts, setHeadcounts] = useState<HeadcountRecord[]>(() => {
    const loaded = loadFromStorage<HeadcountRecord[]>('headcounts', []);
    return loaded && loaded.length > 0 ? loaded : sampleHeadcounts;
  });
  const [giving, setGiving] = useState<GivingRecord[]>(() => {
    const loaded = loadFromStorage<GivingRecord[]>('giving', []);
    return loaded && loaded.length > 0 ? loaded : sampleGiving;
  });
  const [campaigns, setCampaigns] = useState<PledgeCampaign[]>(() => {
    const loaded = loadFromStorage<PledgeCampaign[]>('campaigns', []);
    return loaded && loaded.length > 0 ? loaded : sampleCampaigns;
  });
  const [pledges, setPledges] = useState<PledgeRecord[]>(() => {
    const loaded = loadFromStorage<PledgeRecord[]>('pledges', []);
    return loaded && loaded.length > 0 ? loaded : samplePledges;
  });
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const loaded = loadFromStorage<ExpenseRecord[]>('expenses', []);
    return loaded && loaded.length > 0 ? loaded : sampleExpenses;
  });
  const [ministries, setMinistries] = useState<Ministry[]>(() => {
    const loaded = loadFromStorage<Ministry[]>('ministries', []);
    return loaded && loaded.length > 0 ? loaded : sampleMinistries;
  });
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>(() => {
    const loaded = loadFromStorage<SmallGroup[]>('smallGroups', []);
    return loaded && loaded.length > 0 ? loaded : sampleSmallGroups;
  });
  const [events, setEvents] = useState<ChurchEvent[]>(() => {
    const loaded = loadFromStorage<ChurchEvent[]>('events', []);
    return loaded && loaded.length > 0 ? loaded : sampleEvents;
  });
  const [pastoralCare, setPastoralCare] = useState<PastoralCareRecord[]>(() => {
    const loaded = loadFromStorage<PastoralCareRecord[]>('pastoralCare', []);
    return loaded && loaded.length > 0 ? loaded : samplePastoralCare;
  });
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>(() => {
    const loaded = loadFromStorage<PrayerRequest[]>('prayerRequests', []);
    return loaded && loaded.length > 0 ? loaded : samplePrayerRequests;
  });
  const [communications, setCommunications] = useState<CommunicationRecord[]>(() => {
    const loaded = loadFromStorage<CommunicationRecord[]>('communications', []);
    return loaded && loaded.length > 0 ? loaded : sampleCommunications;
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const loaded = loadFromStorage<AuditLog[]>('auditLogs', []);
    return loaded && loaded.length > 0 ? loaded : sampleAuditLogs;
  });

  // Supabase states
  const [supabaseConfig, setSupabaseConfig] = useState(getStoredSupabaseConfig());
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>(() =>
    isSupabaseConfigured() ? 'syncing' : 'disconnected'
  );
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('gwcc_last_supabase_sync') || null;
    } catch {
      return null;
    }
  });

  // Skip writing identical datasets to localStorage immediately on mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveToStorage('settings', settings);
  }, [settings]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('members', members);
  }, [members]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('visitors', visitors);
  }, [visitors]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('services', services);
  }, [services]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('attendance', attendance);
  }, [attendance]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('headcounts', headcounts);
  }, [headcounts]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('giving', giving);
  }, [giving]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('campaigns', campaigns);
  }, [campaigns]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('pledges', pledges);
  }, [pledges]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('expenses', expenses);
  }, [expenses]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('ministries', ministries);
  }, [ministries]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('smallGroups', smallGroups);
  }, [smallGroups]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('events', events);
  }, [events]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('pastoralCare', pastoralCare);
  }, [pastoralCare]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('prayerRequests', prayerRequests);
  }, [prayerRequests]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('communications', communications);
  }, [communications]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('auditLogs', auditLogs);
  }, [auditLogs]);

  // Initial Supabase check and hydration
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSupabaseStatus('disconnected');
      return;
    }

    let isMounted = true;

    async function initSupabaseSync() {
      setSupabaseStatus('syncing');
      const test = await testSupabaseConnection();
      if (!isMounted) return;

      if (!test.success) {
        setSupabaseStatus('error');
        setSupabaseError(test.message);
        return;
      }

      if (test.tablesStatus === 'tables_missing') {
        setSupabaseStatus('tables_missing');
        setSupabaseError(null);
        return;
      }

      setSupabaseStatus('connected');
      setSupabaseError(null);

      // Attempt to pull latest cloud records
      try {
        const pullRes = await pullAllDataFromSupabase();
        if (!isMounted) return;

        if (pullRes.success && pullRes.data) {
          const { data } = pullRes;
          if (data.members && data.members.length > 0) setMembers(data.members);
          if (data.visitors && data.visitors.length > 0) setVisitors(data.visitors);
          if (data.services && data.services.length > 0) setServices(data.services);
          if (data.attendance && data.attendance.length > 0) setAttendance(data.attendance);
          if (data.headcounts && data.headcounts.length > 0) setHeadcounts(data.headcounts);
          if (data.giving && data.giving.length > 0) setGiving(data.giving);
          if (data.expenses && data.expenses.length > 0) setExpenses(data.expenses);
          if (data.campaigns && data.campaigns.length > 0) setCampaigns(data.campaigns);
          if (data.pledges && data.pledges.length > 0) setPledges(data.pledges);
          if (data.ministries && data.ministries.length > 0) setMinistries(data.ministries);
          if (data.smallGroups && data.smallGroups.length > 0) setSmallGroups(data.smallGroups);
          if (data.events && data.events.length > 0) setEvents(data.events);
          if (data.pastoralCare && data.pastoralCare.length > 0) setPastoralCare(data.pastoralCare);
          if (data.prayerRequests && data.prayerRequests.length > 0) setPrayerRequests(data.prayerRequests);
          if (data.communications && data.communications.length > 0) setCommunications(data.communications);
          if (data.settings) setSettings(data.settings);

          const now = new Date().toISOString();
          setLastSyncTime(now);
          try {
            localStorage.setItem('gwcc_last_supabase_sync', now);
          } catch {
            // Ignore
          }
        }
      } catch (err: any) {
        console.warn('Initial Supabase pull note:', err);
      }
    }

    initSupabaseSync();

    return () => {
      isMounted = false;
    };
  }, []);

  const connectSupabase = useCallback(async (url: string, key: string) => {
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
  }, []);

  const disconnectSupabase = useCallback(() => {
    clearSupabaseCredentials();
    setSupabaseConfig(getStoredSupabaseConfig());
    setSupabaseStatus('disconnected');
    setSupabaseError(null);
  }, []);

  const pushToSupabase = useCallback(
    async (onProgress?: (step: string, percent: number) => void) => {
      const allData: ChurchAllData = {
        settings,
        members,
        visitors,
        services,
        attendance,
        headcounts,
        giving,
        expenses,
        campaigns,
        pledges,
        ministries,
        smallGroups,
        events,
        pastoralCare,
        prayerRequests,
        communications,
        auditLogs,
      };

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
    },
    [
      settings,
      members,
      visitors,
      services,
      attendance,
      headcounts,
      giving,
      expenses,
      campaigns,
      pledges,
      ministries,
      smallGroups,
      events,
      pastoralCare,
      prayerRequests,
      communications,
      auditLogs,
    ]
  );

  const pullFromSupabase = useCallback(async () => {
    setSupabaseStatus('syncing');
    const res = await pullAllDataFromSupabase();
    if (res.success && res.data) {
      const { data } = res;
      if (data.members) setMembers(data.members);
      if (data.visitors) setVisitors(data.visitors);
      if (data.services) setServices(data.services);
      if (data.attendance) setAttendance(data.attendance);
      if (data.headcounts) setHeadcounts(data.headcounts);
      if (data.giving) setGiving(data.giving);
      if (data.expenses) setExpenses(data.expenses);
      if (data.campaigns) setCampaigns(data.campaigns);
      if (data.pledges) setPledges(data.pledges);
      if (data.ministries) setMinistries(data.ministries);
      if (data.smallGroups) setSmallGroups(data.smallGroups);
      if (data.events) setEvents(data.events);
      if (data.pastoralCare) setPastoralCare(data.pastoralCare);
      if (data.prayerRequests) setPrayerRequests(data.prayerRequests);
      if (data.communications) setCommunications(data.communications);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      if (data.settings) setSettings(data.settings);

      setSupabaseStatus('connected');
      setSupabaseError(null);
      const now = new Date().toISOString();
      setLastSyncTime(now);
      try {
        localStorage.setItem('gwcc_last_supabase_sync', now);
      } catch {
        // Ignore
      }
      return { success: true, errors: [] };
    } else {
      setSupabaseStatus('error');
      setSupabaseError(res.errors.join('; '));
      return { success: false, errors: res.errors };
    }
  }, []);

  const logAction = (action: string, module: string, details: string, recordId?: string) => {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_name: `${currentUser.first_name} ${currentUser.last_name}`,
      user_role: currentUser.role.replace('_', ' ').toUpperCase(),
      action,
      module,
      record_id: recordId,
      details,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    dbSyncUpsert('audit_logs', newLog);
  };

  const updateSettings = (newSettings: Partial<ChurchSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      logAction('UPDATE_SETTINGS', 'Settings', 'Updated church profile and parameters');
      dbSyncUpsert('settings', { id: 'gwcc_global_settings', ...updated, updated_at: new Date().toISOString() });
      return updated;
    });
  };

  // Helper to generate the next member ID.
  const generateMemberId = () => {
    const numbers = members.map((m) => {
      const match = m.member_id.match(/MEMBER-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `MEMBER-${String(maxNum + 1).padStart(6, '0')}`;
  };

  // Helper to generate next Tithe Number: T-1049
  const generateTitheNumber = () => {
    const numbers = members.map((m) => {
      if (!m.tithe_number) return 1000;
      const match = m.tithe_number.match(/T-(\d+)/);
      return match ? parseInt(match[1], 10) : 1000;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 1000;
    return `T-${maxNum + 1}`;
  };

  // MEMBER OPERATIONS
  const addMember = (data: Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'>): Member => {
    const now = new Date().toISOString();
    const newMember: Member = {
      ...data,
      id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      member_id: generateMemberId(),
      tithe_number: data.tithe_number || generateTitheNumber(),
      created_at: now,
      updated_at: now,
    };
    setMembers((prev) => [newMember, ...prev]);
    logAction(
      'CREATE_MEMBER',
      'Members',
      `Registered member ${newMember.first_name} ${newMember.last_name} (${newMember.member_id})`,
      newMember.id
    );
    dbSyncUpsert('members', newMember);
    return newMember;
  };

  const updateMember = (id: string, updates: Partial<Member>) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated = { ...m, ...updates, updated_at: new Date().toISOString() };
          logAction(
            'UPDATE_MEMBER',
            'Members',
            `Updated member details for ${updated.first_name} ${updated.last_name}`,
            id
          );
          dbSyncUpsert('members', updated);
          return updated;
        }
        return m;
      })
    );
  };

  const archiveMember = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const archived = { ...m, is_archived: true, updated_at: new Date().toISOString() };
          logAction(
            'ARCHIVE_MEMBER',
            'Members',
            `Archived member ${m.first_name} ${m.last_name} (${m.member_id})`,
            id
          );
          dbSyncUpsert('members', archived);
          return archived;
        }
        return m;
      })
    );
  };

  const unarchiveMember = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const restored = { ...m, is_archived: false, updated_at: new Date().toISOString() };
          logAction(
            'RESTORE_MEMBER',
            'Members',
            `Restored member ${m.first_name} ${m.last_name} (${m.member_id})`,
            id
          );
          dbSyncUpsert('members', restored);
          return restored;
        }
        return m;
      })
    );
  };

  const getMember = (id: string) => members.find((m) => m.id === id);

  // VISITOR OPERATIONS
  const addVisitor = (data: Omit<Visitor, 'id' | 'created_at' | 'updated_at'>): Visitor => {
    const now = new Date().toISOString();
    const newVisitor: Visitor = {
      ...data,
      id: `vis-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: now,
      updated_at: now,
    };
    setVisitors((prev) => [newVisitor, ...prev]);
    logAction('REGISTER_VISITOR', 'Visitors', `Registered visitor ${newVisitor.full_name}`, newVisitor.id);
    dbSyncUpsert('visitors', newVisitor);
    return newVisitor;
  };

  const updateVisitor = (id: string, updates: Partial<Visitor>) => {
    setVisitors((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          const updated = { ...v, ...updates, updated_at: new Date().toISOString() };
          logAction('UPDATE_VISITOR', 'Visitors', `Updated visitor ${updated.full_name}`, id);
          dbSyncUpsert('visitors', updated);
          return updated;
        }
        return v;
      })
    );
  };

  const deleteVisitor = (id: string) => {
    const visitorToDelete = visitors.find((v) => v.id === id);
    setVisitors((prev) => prev.filter((v) => v.id !== id));
    if (visitorToDelete) {
      logAction('DELETE_VISITOR', 'Visitors', `Deleted visitor record ${visitorToDelete.full_name}`, id);
    }
    dbSyncDelete('visitors', id);
  };

  const convertVisitorToMember = (visitorId: string): Member | undefined => {
    const visitor = visitors.find((v) => v.id === visitorId);
    if (!visitor) return undefined;

    const nameParts = visitor.full_name.trim().split(' ');
    const firstName = nameParts[0] || 'Visitor';
    const lastName = nameParts.slice(1).join(' ') || 'Member';

    const newMemberData: Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'> = {
      first_name: firstName,
      last_name: lastName,
      gender: visitor.gender || 'male',
      marital_status: 'single',
      nationality: 'Ghanaian',
      phone: visitor.phone,
      email: visitor.email,
      residential_address: visitor.address,
      city: 'Accra',
      region: 'Greater Accra',
      gps_address: visitor.gps_address,
      status: 'new_member',
      membership_date: new Date().toISOString().split('T')[0],
      first_visit_date: visitor.visit_date,
      baptism_status: false,
      salvation_status: true,
      membership_class_completed: false,
      is_archived: false,
      notes: `Converted from visitor recorded on ${visitor.visit_date}. Notes: ${visitor.notes || ''}`,
    };

    const newMember = addMember(newMemberData);

    updateVisitor(visitorId, {
      follow_up_status: 'converted_to_member',
      converted_to_member_id: newMember.id,
      notes: `${visitor.notes || ''} [Converted to member: ${newMember.member_id}]`,
    });

    return newMember;
  };

  // ATTENDANCE & SERVICES
  const createService = (data: Omit<ChurchService, 'id'>): ChurchService => {
    const newService: ChurchService = {
      ...data,
      id: `ser-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    setServices((prev) => [newService, ...prev]);
    logAction('CREATE_SERVICE', 'Services', `Created service "${newService.name}"`, newService.id);
    dbSyncUpsert('services', newService);
    return newService;
  };

  const updateService = (id: string, updates: Partial<ChurchService>) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, ...updates };
          logAction('UPDATE_SERVICE', 'Services', `Updated service "${updated.name}"`, id);
          dbSyncUpsert('services', updated);
          return updated;
        }
        return s;
      })
    );
  };

  const deleteService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    logAction('DELETE_SERVICE', 'Services', `Deleted church service ${id}`, id);
    dbSyncDelete('services', id);
  };

  const recordAttendance = (
    serviceId: string,
    personType: 'member' | 'visitor',
    personId: string,
    method: 'manual' | 'search' | 'qr_code' = 'manual',
    customDate?: string
  ): { success: boolean; message: string } => {
    const targetDate = customDate || new Date().toISOString().split('T')[0];

    const exists = attendance.some(
      (a) =>
        a.service_id === serviceId &&
        a.date === targetDate &&
        ((personType === 'member' && a.member_id === personId) ||
          (personType === 'visitor' && a.visitor_id === personId))
    );

    if (exists) {
      return { success: false, message: 'Person already checked in for this service date.' };
    }

    const targetService = services.find((s) => s.id === serviceId);
    const serviceName = targetService ? targetService.name : 'Worship Service';
    const member = personType === 'member' ? members.find((x) => x.id === personId) : undefined;
    const visitor = personType === 'visitor' ? visitors.find((x) => x.id === personId) : undefined;
    const name = member
      ? `${member.first_name} ${member.last_name}`
      : visitor
      ? visitor.full_name
      : 'Attendee';

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      service_id: serviceId,
      service_name: serviceName,
      date: targetDate,
      member_id: personType === 'member' ? personId : undefined,
      member_name: member ? `${member.first_name} ${member.last_name}` : undefined,
      visitor_id: personType === 'visitor' ? personId : undefined,
      visitor_name: visitor ? visitor.full_name : undefined,
      person_name: name,
      check_in_time: new Date().toISOString(),
      check_in_method: method,
      status: 'present',
    };

    setAttendance((prev) => [newRecord, ...prev]);
    dbSyncUpsert('attendance', newRecord);

    logAction('RECORD_ATTENDANCE', 'Attendance', `Checked in ${name} (${personType}) for ${targetDate}`, newRecord.id);
    return { success: true, message: `Checked in ${name} successfully!` };
  };

  const batchRecordAttendance = (
    serviceId: string,
    date: string,
    items: Array<{ personType: 'member' | 'visitor'; personId: string; method?: 'manual' | 'search' | 'qr_code' }>
  ): { added: number; skipped: number } => {
    const targetService = services.find((s) => s.id === serviceId);
    const serviceName = targetService ? targetService.name : 'Worship Service';

    const newRecords: AttendanceRecord[] = [];
    let skipped = 0;

    items.forEach((item) => {
      const exists = attendance.some(
        (a) =>
          a.service_id === serviceId &&
          a.date === date &&
          ((item.personType === 'member' && a.member_id === item.personId) ||
            (item.personType === 'visitor' && a.visitor_id === item.personId))
      );
      if (exists) {
        skipped++;
        return;
      }

      const member = item.personType === 'member' ? members.find((x) => x.id === item.personId) : undefined;
      const visitor = item.personType === 'visitor' ? visitors.find((x) => x.id === item.personId) : undefined;
      const name = member
        ? `${member.first_name} ${member.last_name}`
        : visitor
        ? visitor.full_name
        : 'Attendee';

      const rec: AttendanceRecord = {
        id: `att-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        service_id: serviceId,
        service_name: serviceName,
        date: date,
        member_id: item.personType === 'member' ? item.personId : undefined,
        member_name: member ? `${member.first_name} ${member.last_name}` : undefined,
        visitor_id: item.personType === 'visitor' ? item.personId : undefined,
        visitor_name: visitor ? visitor.full_name : undefined,
        person_name: name,
        check_in_time: new Date().toISOString(),
        check_in_method: item.method || 'manual',
        status: 'present',
      };
      newRecords.push(rec);
    });

    if (newRecords.length > 0) {
      setAttendance((prev) => [...newRecords, ...prev]);
      newRecords.forEach((r) => dbSyncUpsert('attendance', r));
      logAction('BATCH_ATTENDANCE', 'Attendance', `Batch checked in ${newRecords.length} attendees for ${date}`);
    }

    return { added: newRecords.length, skipped };
  };

  const recordHeadcount = (data: Omit<HeadcountRecord, 'id' | 'created_at'>): HeadcountRecord => {
    const existingIndex = headcounts.findIndex((h) => h.service_id === data.service_id && h.date === data.date);
    const newRecord: HeadcountRecord = {
      ...data,
      id: existingIndex >= 0 ? headcounts[existingIndex].id : `hc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: existingIndex >= 0 && headcounts[existingIndex].created_at ? headcounts[existingIndex].created_at : new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      setHeadcounts((prev) => prev.map((h, i) => (i === existingIndex ? newRecord : h)));
      logAction('UPDATE_HEADCOUNT', 'Attendance', `Updated auditorium headcount for ${data.service_name} on ${data.date} (Total: ${data.total_auditorium})`, newRecord.id);
    } else {
      setHeadcounts((prev) => [newRecord, ...prev]);
      logAction('RECORD_HEADCOUNT', 'Attendance', `Recorded auditorium headcount for ${data.service_name} on ${data.date} (Total: ${data.total_auditorium})`, newRecord.id);
    }

    dbSyncUpsert('headcounts', newRecord);
    return newRecord;
  };

  const updateHeadcount = (id: string, updates: Partial<HeadcountRecord>) => {
    setHeadcounts((prev) =>
      prev.map((h) => {
        if (h.id === id) {
          const updated = { ...h, ...updates };
          logAction('UPDATE_HEADCOUNT', 'Attendance', `Updated headcount record ${id}`, id);
          dbSyncUpsert('headcounts', updated);
          return updated;
        }
        return h;
      })
    );
  };

  const deleteHeadcount = (id: string) => {
    setHeadcounts((prev) => prev.filter((h) => h.id !== id));
    logAction('DELETE_HEADCOUNT', 'Attendance', `Deleted headcount record ${id}`, id);
    dbSyncDelete('headcounts', id);
  };

  const deleteAttendanceRecord = (id: string) => {
    setAttendance((prev) => prev.filter((a) => a.id !== id));
    logAction('DELETE_ATTENDANCE', 'Attendance', `Removed attendance record ${id}`, id);
    dbSyncDelete('attendance', id);
  };

  // FINANCE & GIVING
  const recordGiving = (data: Omit<GivingRecord, 'id' | 'created_at'>): GivingRecord => {
    const newRecord: GivingRecord = {
      ...data,
      id: `giv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    setGiving((prev) => [newRecord, ...prev]);

    const donor =
      data.donor_name ||
      (() => {
        const m = members.find((x) => x.id === data.member_id);
        return m ? `${m.first_name} ${m.last_name}` : 'Anonymous';
      })();

    logAction(
      'RECORD_GIVING',
      'Finance',
      `Recorded ${data.category} of GH₵ ${data.amount.toFixed(2)} from ${donor}`,
      newRecord.id
    );
    dbSyncUpsert('giving', newRecord);
    return newRecord;
  };

  const updateGiving = (id: string, updates: Partial<GivingRecord>) => {
    setGiving((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          const updated = { ...g, ...updates };
          logAction(
            'UPDATE_GIVING',
            'Finance',
            `Updated giving entry of GH₵ ${updated.amount.toFixed(2)} for ${updated.member_name || updated.donor_name || 'Anonymous'}`,
            id
          );
          dbSyncUpsert('giving', updated);
          return updated;
        }
        return g;
      })
    );
  };

  const deleteGiving = (id: string) => {
    setGiving((prev) => prev.filter((g) => g.id !== id));
    logAction('DELETE_GIVING', 'Finance', `Deleted giving entry ${id}`, id);
    dbSyncDelete('giving', id);
  };

  const recordExpense = (data: Omit<ExpenseRecord, 'id' | 'created_at'>): ExpenseRecord => {
    let approver = data.approved_by?.trim();
    if (
      !approver ||
      approver === 'Rev. Emmanuel Appiah' ||
      approver.includes('Agyemang-Prempeh') ||
      approver.includes('Emmanuel Agyemang') ||
      approver.includes('Emmanuel Appiah')
    ) {
      approver = 'Prophet Elisha K. Richard';
    }
    const newRecord: ExpenseRecord = {
      ...data,
      approved_by: approver,
      id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    setExpenses((prev) => [newRecord, ...prev]);
    logAction(
      'RECORD_EXPENSE',
      'Finance',
      `Disbursed GH₵ ${data.amount.toFixed(2)} for ${data.category} (${data.description || data.title})`,
      newRecord.id
    );
    dbSyncUpsert('expenses', newRecord);
    return newRecord;
  };

  const updateExpense = (id: string, updates: Partial<ExpenseRecord>) => {
    let sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.approved_by !== undefined) {
      const raw = sanitizedUpdates.approved_by.trim();
      if (
        !raw ||
        raw === 'Rev. Emmanuel Appiah' ||
        raw.includes('Agyemang-Prempeh') ||
        raw.includes('Emmanuel Agyemang') ||
        raw.includes('Emmanuel Appiah')
      ) {
        sanitizedUpdates.approved_by = 'Prophet Elisha K. Richard';
      }
    }
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const updated = { ...e, ...sanitizedUpdates };
          logAction(
            'UPDATE_EXPENSE',
            'Finance',
            `Updated expense voucher: ${updated.title || updated.description} (GH₵ ${updated.amount.toFixed(2)})`,
            id
          );
          dbSyncUpsert('expenses', updated);
          return updated;
        }
        return e;
      })
    );
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    logAction('DELETE_EXPENSE', 'Finance', `Deleted expense voucher ${id}`, id);
    dbSyncDelete('expenses', id);
  };

  // CAMPAIGNS
  const addCampaign = (data: Omit<PledgeCampaign, 'id'>): PledgeCampaign => {
    const newCampaign: PledgeCampaign = {
      ...data,
      id: `cmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setCampaigns((prev) => [newCampaign, ...prev]);
    logAction(
      'CREATE_CAMPAIGN',
      'Pledges',
      `Created campaign "${newCampaign.name}" with target GH₵ ${newCampaign.target_amount.toLocaleString()}`,
      newCampaign.id
    );
    dbSyncUpsert('pledge_campaigns', newCampaign);
    return newCampaign;
  };

  const updateCampaign = (id: string, updates: Partial<PledgeCampaign>) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...updates };
          logAction('UPDATE_CAMPAIGN', 'Pledges', `Updated campaign "${updated.name}"`, id);
          dbSyncUpsert('pledge_campaigns', updated);
          return updated;
        }
        return c;
      })
    );
  };

  const deleteCampaign = (id: string) => {
    const cmp = campaigns.find((c) => c.id === id);
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    logAction('DELETE_CAMPAIGN', 'Pledges', `Deleted campaign "${cmp?.name || id}"`, id);
    dbSyncDelete('pledge_campaigns', id);
  };

  // PLEDGES
  const createPledge = (
    data: Omit<PledgeRecord, 'id' | 'balance' | 'status' | 'created_at'>
  ): PledgeRecord => {
    const balance = Math.max(0, data.amount_pledged - data.amount_paid);
    const status: PledgeStatus =
      balance <= 0 ? 'completed' : data.amount_paid > 0 ? 'partially_paid' : 'active';
    const newRecord: PledgeRecord = {
      ...data,
      id: `plg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      balance,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPledges((prev) => [newRecord, ...prev]);

    const member = members.find((m) => m.id === data.member_id);
    const mName = member ? `${member.first_name} ${member.last_name}` : data.member_name || 'Member';
    logAction(
      'CREATE_PLEDGE',
      'Pledges',
      `Recorded pledge of GH₵ ${data.amount_pledged.toFixed(2)} by ${mName} for "${data.campaign_name}"`,
      newRecord.id
    );
    dbSyncUpsert('pledges', newRecord);
    return newRecord;
  };

  const updatePledge = (id: string, updates: Partial<PledgeRecord>) => {
    setPledges((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updatedPledge = { ...p, ...updates, updated_at: new Date().toISOString() };
          if (updates.amount_pledged !== undefined || updates.amount_paid !== undefined) {
            const pledged = updates.amount_pledged ?? p.amount_pledged;
            const paid = updates.amount_paid ?? p.amount_paid;
            const newBal = Math.max(0, pledged - paid);
            updatedPledge.balance = newBal;
            updatedPledge.status = newBal <= 0 ? 'completed' : paid > 0 ? 'partially_paid' : 'active';
          }
          logAction('UPDATE_PLEDGE', 'Pledges', `Updated pledge record for ${updatedPledge.member_name}`, id);
          dbSyncUpsert('pledges', updatedPledge);
          return updatedPledge;
        }
        return p;
      })
    );
  };

  const deletePledge = (id: string) => {
    const p = pledges.find((item) => item.id === id);
    setPledges((prev) => prev.filter((item) => item.id !== id));
    logAction('DELETE_PLEDGE', 'Pledges', `Deleted pledge record of ${p?.member_name || id}`, id);
    dbSyncDelete('pledges', id);
  };

  const recordPledgePayment = (
    pledgeId: string,
    amount: number,
    paymentDetails?: {
      method?: PaymentMethod;
      channel?: string;
      reference?: string;
      syncWithGiving?: boolean;
    }
  ) => {
    let affectedPledge: PledgeRecord | null = null;
    setPledges((prev) =>
      prev.map((p) => {
        if (p.id === pledgeId) {
          const newPaid = p.amount_paid + amount;
          const newBalance = Math.max(0, p.amount_pledged - newPaid);
          const newStatus: PledgeStatus =
            newBalance === 0 ? 'completed' : newPaid > 0 ? 'partially_paid' : 'active';
          const updated = {
            ...p,
            amount_paid: newPaid,
            balance: newBalance,
            status: newStatus,
            updated_at: new Date().toISOString(),
          };
          affectedPledge = updated;
          logAction(
            'PLEDGE_PAYMENT',
            'Pledges',
            `Received installment of GH₵ ${amount.toFixed(2)} on pledge by ${p.member_name} (${p.campaign_name})`,
            pledgeId
          );
          dbSyncUpsert('pledges', updated);
          return updated;
        }
        return p;
      })
    );

    // If syncWithGiving is requested or enabled, also write to giving ledger
    if (paymentDetails?.syncWithGiving && affectedPledge) {
      const plg = affectedPledge as PledgeRecord;
      recordGiving({
        member_id: plg.member_id,
        member_name: plg.member_name,
        donor_name: plg.member_name,
        category: 'Building Fund',
        amount,
        currency: 'GHS',
        date: new Date().toISOString().split('T')[0],
        payment_method: paymentDetails.method || 'cash',
        payment_channel: paymentDetails.channel || 'Cash Deposit',
        reference_number: paymentDetails.reference || `PLG-${Date.now().toString().slice(-6)}`,
        notes: `Pledge installment for ${plg.campaign_name}`,
      });
    }
  };

  // MINISTRIES & SMALL GROUPS
  const addMinistry = (data: Omit<Ministry, 'id' | 'member_count'>): Ministry => {
    const newMinistry: Ministry = {
      ...data,
      id: `min-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      member_count: 0,
    };
    setMinistries((prev) => [...prev, newMinistry]);
    logAction('CREATE_MINISTRY', 'Ministries', `Formed ministry "${newMinistry.name}"`, newMinistry.id);
    dbSyncUpsert('ministries', newMinistry);
    return newMinistry;
  };

  const updateMinistry = (id: string, updates: Partial<Ministry>) => {
    setMinistries((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated = { ...m, ...updates };
          logAction('UPDATE_MINISTRY', 'Ministries', `Updated ministry "${updated.name}"`, id);
          dbSyncUpsert('ministries', updated);
          return updated;
        }
        return m;
      })
    );
  };

  const deleteMinistry = (id: string) => {
    const toDelete = ministries.find((m) => m.id === id);
    const minName = toDelete ? toDelete.name : id;
    setMinistries((prev) => prev.filter((m) => m.id !== id));
    // Clear assignment for members in this ministry
    setMembers((prev) =>
      prev.map((m) => {
        if (m.ministry_id === id || m.ministry_name === minName) {
          const cleared = {
            ...m,
            ministry_id: undefined,
            ministry_name: undefined,
            updated_at: new Date().toISOString(),
          };
          dbSyncUpsert('members', cleared);
          return cleared;
        }
        return m;
      })
    );
    logAction('DELETE_MINISTRY', 'Ministries', `Deleted ministry "${minName}"`, id);
    dbSyncDelete('ministries', id);
  };

  const assignMemberToMinistry = (
    memberId: string,
    ministryId: string,
    ministryName: string,
    role?: string
  ) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const updated = {
            ...m,
            ministry_id: ministryId,
            ministry_name: ministryName,
            leadership_position: role !== undefined ? role : m.leadership_position,
            updated_at: new Date().toISOString(),
          };
          logAction(
            'ASSIGN_MINISTRY',
            'Ministries',
            `Assigned ${m.first_name} ${m.last_name} to ${ministryName} as ${role || 'Member'}`,
            memberId
          );
          dbSyncUpsert('members', updated);
          return updated;
        }
        return m;
      })
    );
  };

  const removeMemberFromMinistry = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const prevMinistry = m.ministry_name || 'Ministry';
          const updated = {
            ...m,
            ministry_id: undefined,
            ministry_name: undefined,
            updated_at: new Date().toISOString(),
          };
          logAction(
            'REMOVE_MINISTRY_MEMBER',
            'Ministries',
            `Removed ${m.first_name} ${m.last_name} from ${prevMinistry}`,
            memberId
          );
          dbSyncUpsert('members', updated);
          return updated;
        }
        return m;
      })
    );
  };

  const addSmallGroup = (data: Omit<SmallGroup, 'id' | 'member_count'>): SmallGroup => {
    const newGroup: SmallGroup = {
      ...data,
      id: `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      member_count: 0,
    };
    setSmallGroups((prev) => [...prev, newGroup]);
    logAction('CREATE_SMALL_GROUP', 'Small Groups', `Created cell group "${newGroup.name}"`, newGroup.id);
    dbSyncUpsert('small_groups', newGroup);
    return newGroup;
  };

  // EVENTS
  const createEvent = (data: Omit<ChurchEvent, 'id'>): ChurchEvent => {
    const now = new Date().toISOString();
    const newEvent: ChurchEvent = {
      ...data,
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
    };
    setEvents((prev) => [newEvent, ...prev]);
    logAction('CREATE_EVENT', 'Events', `Scheduled event "${newEvent.title}"`, newEvent.id);
    dbSyncUpsert('events', newEvent);
    return newEvent;
  };

  const updateEvent = (id: string, updates: Partial<ChurchEvent>) => {
    const now = new Date().toISOString();
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const updated = {
            ...e,
            ...updates,
            created_at: e.created_at || now,
            updated_at: now,
          };
          logAction('UPDATE_EVENT', 'Events', `Updated event details for ${updated.title}`, id);
          dbSyncUpsert('events', updated);
          return updated;
        }
        return e;
      })
    );
  };

  const deleteEvent = (id: string) => {
    const toDelete = events.find((e) => e.id === id);
    const title = toDelete ? toDelete.title : id;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    logAction('DELETE_EVENT', 'Events', `Deleted event "${title}"`, id);
    dbSyncDelete('events', id);
  };

  const addEventAttendee = (
    eventId: string,
    attendee: { name: string; phone?: string; email?: string; member_id?: string; role?: string }
  ) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const newAtt = {
            id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ...attendee,
            registered_at: new Date().toISOString(),
            checked_in: false,
          };
          const attendees = [...(e.attendees || []), newAtt];
          const updated = {
            ...e,
            attendees,
            registration_count: attendees.length,
          };
          logAction('REGISTER_EVENT_ATTENDEE', 'Events', `Registered ${attendee.name} for ${e.title}`, eventId);
          dbSyncUpsert('events', updated);
          return updated;
        }
        return e;
      })
    );
  };

  const removeEventAttendee = (eventId: string, attendeeId: string) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const attendees = (e.attendees || []).filter((a) => a.id !== attendeeId);
          const updated = {
            ...e,
            attendees,
            registration_count: attendees.length,
          };
          dbSyncUpsert('events', updated);
          return updated;
        }
        return e;
      })
    );
  };

  const toggleAttendeeCheckIn = (eventId: string, attendeeId: string) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const attendees = (e.attendees || []).map((a) =>
            a.id === attendeeId ? { ...a, checked_in: !a.checked_in } : a
          );
          const updated = { ...e, attendees };
          dbSyncUpsert('events', updated);
          return updated;
        }
        return e;
      })
    );
  };

  // PASTORAL CARE & PRAYER REQUESTS
  const addPastoralCare = (
    data: Omit<PastoralCareRecord, 'id' | 'created_at'>
  ): PastoralCareRecord => {
    const newRecord: PastoralCareRecord = {
      ...data,
      id: `care-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    setPastoralCare((prev) => [newRecord, ...prev]);
    const m = members.find((x) => x.id === data.member_id);
    const mName = m ? `${m.first_name} ${m.last_name}` : 'Member';
    logAction(
      'RECORD_PASTORAL_CARE',
      'Pastoral Care',
      `Logged ${data.care_type} visit/session with ${mName}`,
      newRecord.id
    );
    dbSyncUpsert('pastoral_care', newRecord);
    return newRecord;
  };

  const addPrayerRequest = (
    data: Omit<PrayerRequest, 'id' | 'created_at'>
  ): PrayerRequest => {
    const newRecord: PrayerRequest = {
      ...data,
      id: `pray-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    setPrayerRequests((prev) => [newRecord, ...prev]);
    logAction(
      'ADD_PRAYER_REQUEST',
      'Prayer Requests',
      `Received prayer petition from ${data.requester_name} (${data.category})`,
      newRecord.id
    );
    dbSyncUpsert('prayer_requests', newRecord);
    return newRecord;
  };

  const updatePrayerStatus = (
    id: string,
    status: PrayerRequest['status'],
    testimony?: string
  ) => {
    setPrayerRequests((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = {
            ...p,
            status,
            testimony: testimony !== undefined ? testimony : p.testimony,
          };
          logAction(
            'UPDATE_PRAYER_STATUS',
            'Prayer Requests',
            `Prayer request status changed to ${status}`,
            id
          );
          dbSyncUpsert('prayer_requests', updated);
          return updated;
        }
        return p;
      })
    );
  };

  // COMMUNICATION
  const sendSMSMessage = (
    data: Omit<CommunicationRecord, 'id' | 'sent_at'>
  ): CommunicationRecord => {
    const newRecord: CommunicationRecord = {
      ...data,
      id: `com-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sent_at: new Date().toISOString(),
      created_by: `${currentUser.first_name} ${currentUser.last_name}`,
    };
    setCommunications((prev) => [newRecord, ...prev]);
    logAction(
      'SEND_COMMUNICATION',
      'Communication',
      `Sent ${data.channel.toUpperCase()} to ${data.recipient_count} recipients (${data.title})`,
      newRecord.id
    );
    dbSyncUpsert('communications', newRecord);
    return newRecord;
  };

  // RESET
  const resetToSampleData = () => {
    setSettings(initialSettings);
    setMembers(sampleMembers);
    setVisitors(sampleVisitors);
    setServices(sampleServices);
    setAttendance(sampleAttendance);
    setHeadcounts(sampleHeadcounts);
    setGiving(sampleGiving);
    setCampaigns(sampleCampaigns);
    setPledges(samplePledges);
    setExpenses(sampleExpenses);
    setMinistries(sampleMinistries);
    setSmallGroups(sampleSmallGroups);
    setEvents(sampleEvents);
    setPastoralCare(samplePastoralCare);
    setPrayerRequests(samplePrayerRequests);
    setCommunications(sampleCommunications);
    setAuditLogs(sampleAuditLogs);

    saveToStorage('settings', initialSettings);
    saveToStorage('members', sampleMembers);
    saveToStorage('visitors', sampleVisitors);
    saveToStorage('services', sampleServices);
    saveToStorage('attendance', sampleAttendance);
    saveToStorage('headcounts', sampleHeadcounts);
    saveToStorage('giving', sampleGiving);
    saveToStorage('campaigns', sampleCampaigns);
    saveToStorage('pledges', samplePledges);
    saveToStorage('expenses', sampleExpenses);
    saveToStorage('ministries', sampleMinistries);
    saveToStorage('smallGroups', sampleSmallGroups);
    saveToStorage('events', sampleEvents);
    saveToStorage('pastoralCare', samplePastoralCare);
    saveToStorage('prayerRequests', samplePrayerRequests);
    saveToStorage('communications', sampleCommunications);
    saveToStorage('auditLogs', sampleAuditLogs);

    logAction('RESET_SAMPLE_DATA', 'System', 'Populated Greater Works City Church sample data');
  };

  const contextValue = React.useMemo<ChurchDataContextType>(
    () => ({
      settings,
      updateSettings,
      members,
      addMember,
      updateMember,
      archiveMember,
      unarchiveMember,
      getMember,
      visitors,
      addVisitor,
      updateVisitor,
      deleteVisitor,
      convertVisitorToMember,
      services,
      attendance,
      headcounts,
      createService,
      addService: createService,
      updateService,
      deleteService,
      recordAttendance,
      batchRecordAttendance,
      deleteAttendanceRecord,
      removeAttendance: deleteAttendanceRecord,
      recordHeadcount,
      updateHeadcount,
      deleteHeadcount,
      giving,
      recordGiving,
      updateGiving,
      deleteGiving,
      expenses,
      recordExpense,
      updateExpense,
      deleteExpense,
      campaigns,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      pledges,
      createPledge,
      addPledge: createPledge,
      updatePledge,
      deletePledge,
      recordPledgePayment,
      ministries,
      addMinistry,
      updateMinistry,
      deleteMinistry,
      assignMemberToMinistry,
      removeMemberFromMinistry,
      smallGroups,
      addSmallGroup,
      events,
      createEvent,
      updateEvent,
      deleteEvent,
      addEventAttendee,
      removeEventAttendee,
      toggleAttendeeCheckIn,
      pastoralCare,
      addPastoralCare,
      addPastoralCareLog: addPastoralCare,
      prayerRequests,
      addPrayerRequest,
      updatePrayerStatus,
      communications,
      sendSMSMessage,
      auditLogs,
      logAction,
      isSupabaseConfigured: isSupabaseConfigured(),
      supabaseStatus,
      supabaseError,
      lastSyncTime,
      supabaseConfig,
      connectSupabase,
      disconnectSupabase,
      pushToSupabase,
      pullFromSupabase,
      resetToSampleData,
      resetToDefaultData: resetToSampleData,
    }),
    [
      settings,
      members,
      visitors,
      services,
      attendance,
      giving,
      expenses,
      campaigns,
      pledges,
      ministries,
      smallGroups,
      events,
      pastoralCare,
      prayerRequests,
      communications,
      auditLogs,
      supabaseStatus,
      supabaseError,
      lastSyncTime,
      supabaseConfig,
    ]
  );

  return (
    <ChurchDataContext.Provider value={contextValue}>
      {children}
    </ChurchDataContext.Provider>
  );
};

export const useChurchData = () => {
  const context = useContext(ChurchDataContext);
  if (!context) {
    throw new Error('useChurchData must be used within a ChurchDataProvider');
  }
  return context;
};
