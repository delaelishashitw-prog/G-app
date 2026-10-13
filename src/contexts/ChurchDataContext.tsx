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
  WelfareContribution,
  WelfareClaim,
  ChildCheckInRecord,
  ChurchAsset,
  AssetMaintenanceLog,
  RosterAssignment,
  RosterConflict,
  FoundationCohort,
  FoundationStudent,
  PastoralVisitationRecord,
  PastoralCounselingSession,
  IntercessoryWatchSlot,
  ChurchAccount,
  ChurchFinanceRecord,
  DepartmentBudget,
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
  sampleChurchAccounts,
  sampleChurchFinances,
  sampleDepartmentBudgets,
  sampleMinistries,
  sampleSmallGroups,
  sampleEvents,
  samplePastoralCare,
  samplePrayerRequests,
  sampleCommunications,
  sampleAuditLogs,
  sampleWelfareContributions,
  sampleWelfareClaims,
  sampleChildCheckIns,
  sampleAssets,
  sampleRosterAssignments,
  sampleFoundationCohorts,
  sampleFoundationStudents,
  samplePastoralVisitations,
  samplePastoralCounselingSessions,
  sampleIntercessoryWatchSlots,
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
  syncRosterAssignmentToSupabase,
  deleteRosterAssignmentFromSupabase,
  ChurchAllData,
} from '../lib/supabase';
import {
  addMember as addMemberRecord,
  archiveMember as archiveMemberRecord,
  bulkUpdateMembers as bulkUpdateMembersRecord,
  getMember as getMemberRecord,
  unarchiveMember as unarchiveMemberRecord,
  updateMember as updateMemberRecord,
} from '../features/members/memberStore';
import {
  loadSettingsFromStorage,
  normalizeSettings,
} from '../features/settings/settingsStore';
import { logAction as logActionRecord } from '../features/audit/auditStore';
import {
  loadFromStorage,
  saveToStorage,
} from '../features/system/systemStore';
import { resetToSampleDataState } from '../features/system/resetStore';
import {
  connectSupabase as connectSupabaseRecord,
  disconnectSupabase as disconnectSupabaseRecord,
  getInitialSupabaseStatus,
  pullSupabaseData as pullSupabaseDataRecord,
  pushSupabaseData as pushSupabaseDataRecord,
  type SupabaseStatus,
} from '../features/sync/syncStore';
import {
  batchRecordAttendance as batchRecordAttendanceRecord,
  createService as createServiceRecord,
  deleteAttendanceRecord as deleteAttendanceRecordRecord,
  deleteHeadcount as deleteHeadcountRecord,
  deleteService as deleteServiceRecord,
  recordAttendance as recordAttendanceRecord,
  recordHeadcount as recordHeadcountRecord,
  updateHeadcount as updateHeadcountRecord,
  updateService as updateServiceRecord,
} from '../features/attendance/attendanceStore';
import {
  deleteExpense as deleteExpenseRecord,
  deleteGiving as deleteGivingRecord,
  voidGiving as voidGivingRecord,
  recordExpense as recordExpenseRecord,
  recordGiving as recordGivingRecord,
  updateExpense as updateExpenseRecord,
  updateGiving as updateGivingRecord,
  addChurchAccount as addChurchAccountRecord,
  updateChurchAccount as updateChurchAccountRecord,
  deleteChurchAccount as deleteChurchAccountRecord,
  recordChurchFinance as recordChurchFinanceRecord,
  updateChurchFinance as updateChurchFinanceRecord,
  deleteChurchFinance as deleteChurchFinanceRecord,
  voidChurchFinance as voidChurchFinanceRecord,
  transferBetweenAccounts as transferBetweenAccountsRecord,
  addDepartmentBudget as addDepartmentBudgetRecord,
  updateDepartmentBudget as updateDepartmentBudgetRecord,
} from '../features/finance/financeStore';
import {
  addCampaign as addCampaignRecord,
  createPledge as createPledgeRecord,
  deleteCampaign as deleteCampaignRecord,
  deletePledge as deletePledgeRecord,
  recordPledgePayment as recordPledgePaymentRecord,
  updateCampaign as updateCampaignRecord,
  updatePledge as updatePledgeRecord,
} from '../features/pledges/pledgeStore';
import {
  addEventAttendee as addEventAttendeeRecord,
  createEvent as createEventRecord,
  deleteEvent as deleteEventRecord,
  removeEventAttendee as removeEventAttendeeRecord,
  toggleAttendeeCheckIn as toggleAttendeeCheckInRecord,
  updateEvent as updateEventRecord,
} from '../features/events/eventStore';
import {
  addMinistry as addMinistryRecord,
  addSmallGroup as addSmallGroupRecord,
  assignMemberToMinistry as assignMemberToMinistryRecord,
  deleteMinistry as deleteMinistryRecord,
  removeMemberFromMinistry as removeMemberFromMinistryRecord,
  updateMinistry as updateMinistryRecord,
} from '../features/ministries/ministryStore';
import {
  sendSMSMessage as sendSMSMessageRecord,
} from '../features/communications/communicationStore';
import {
  deleteWelfareClaim as deleteWelfareClaimRecord,
  deleteWelfareContribution as deleteWelfareContributionRecord,
  disburseWelfareClaim as disburseWelfareClaimRecord,
  recordWelfareContribution as recordWelfareContributionRecord,
  submitWelfareClaim as submitWelfareClaimRecord,
  updateWelfareClaim as updateWelfareClaimRecord,
} from '../features/welfare/welfareStore';
import {
  addAsset as addAssetRecord,
  addAssetMaintenanceLog as addAssetMaintenanceLogRecord,
  addRosterAssignment as addRosterAssignmentRecord,
  batchAddOrUpdateRosterAssignments as batchAddOrUpdateRosterAssignmentsRecord,
  buildRosterConflicts as buildRosterConflictsRecord,
  createFoundationCohort as createFoundationCohortRecord,
  deleteAsset as deleteAssetRecord,
  deleteRosterAssignment as deleteRosterAssignmentRecord,
  enrollMemberInFoundationSchool as enrollMemberInFoundationSchoolRecord,
  graduateFoundationStudent as graduateFoundationStudentRecord,
  toggleFoundationModule as toggleFoundationModuleRecord,
  updateAsset as updateAssetRecord,
  updateFoundationCohort as updateFoundationCohortRecord,
  updateFoundationStudent as updateFoundationStudentRecord,
  updateRosterAssignment as updateRosterAssignmentRecord,
} from '../features/operations/operationsStore';
import {
  addCounselingSession as addCounselingSessionRecord,
  addIntercessorySlot as addIntercessorySlotRecord,
  addPastoralCare as addPastoralCareRecord,
  addPastoralCareLog as addPastoralCareLogRecord,
  addPastoralVisitation as addPastoralVisitationRecord,
  addPrayerRequest as addPrayerRequestRecord,
  deleteCounselingSession as deleteCounselingSessionRecord,
  deleteIntercessorySlot as deleteIntercessorySlotRecord,
  deletePastoralCareLog as deletePastoralCareLogRecord,
  deletePastoralVisitation as deletePastoralVisitationRecord,
  deletePrayerRequest as deletePrayerRequestRecord,
  updateCounselingSession as updateCounselingSessionRecord,
  updateIntercessorySlot as updateIntercessorySlotRecord,
  updatePastoralCareLog as updatePastoralCareLogRecord,
  updatePastoralVisitation as updatePastoralVisitationRecord,
  updatePrayerStatus as updatePrayerStatusRecord,
} from '../features/pastoral/pastoralCareStore';

interface ChurchDataContextType {
  settings: ChurchSettings;
  updateSettings: (newSettings: Partial<ChurchSettings>) => void;

  // Members
  members: Member[];
  addMember: (member: Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'>) => Member;
  updateMember: (id: string, updates: Partial<Member>) => void;
  bulkUpdateMembers: (memberIds: string[], updates: Partial<Member>) => void;
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
  voidGiving: (id: string, reason: string) => void;
  expenses: ExpenseRecord[];
  recordExpense: (record: Omit<ExpenseRecord, 'id' | 'created_at'>) => ExpenseRecord;
  updateExpense: (id: string, updates: Partial<ExpenseRecord>) => void;
  deleteExpense: (id: string) => void;

  // Dedicated Church Finance & Accounts
  churchAccounts: ChurchAccount[];
  addChurchAccount: (account: Omit<ChurchAccount, 'id' | 'created_at' | 'updated_at'>) => ChurchAccount;
  updateChurchAccount: (id: string, updates: Partial<ChurchAccount>) => void;
  deleteChurchAccount: (id: string) => void;
  churchFinances: ChurchFinanceRecord[];
  recordChurchFinance: (record: Omit<ChurchFinanceRecord, 'id' | 'created_at' | 'updated_at'>) => ChurchFinanceRecord;
  updateChurchFinance: (id: string, updates: Partial<ChurchFinanceRecord>) => void;
  deleteChurchFinance: (id: string) => void;
  voidChurchFinance: (id: string, reason: string) => void;
  transferBetweenAccounts: (fromAccountId: string, toAccountId: string, amount: number, notes?: string) => { success: boolean; message: string };
  departmentBudgets: DepartmentBudget[];
  updateDepartmentBudget: (id: string, updates: Partial<DepartmentBudget>) => void;
  addDepartmentBudget: (budget: Omit<DepartmentBudget, 'id' | 'created_at' | 'updated_at'>) => DepartmentBudget;
  resetChurchFinanceData: (mode?: 'reset_balances' | 'wipe_all') => { success: boolean; message: string };

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
  updatePastoralCareLog: (id: string, updates: Partial<PastoralCareRecord>) => void;
  deletePastoralCareLog: (id: string) => void;
  prayerRequests: PrayerRequest[];
  addPrayerRequest: (record: Omit<PrayerRequest, 'id' | 'created_at'>) => PrayerRequest;
  updatePrayerStatus: (id: string, status: PrayerRequest['status'], testimony?: string) => void;
  deletePrayerRequest: (id: string) => void;
  pastoralVisitations: PastoralVisitationRecord[];
  addPastoralVisitation: (record: Omit<PastoralVisitationRecord, 'id' | 'created_at'>) => PastoralVisitationRecord;
  updatePastoralVisitation: (id: string, updates: Partial<PastoralVisitationRecord>) => void;
  deletePastoralVisitation: (id: string) => void;
  counselingSessions: PastoralCounselingSession[];
  addCounselingSession: (session: Omit<PastoralCounselingSession, 'id' | 'created_at'>) => PastoralCounselingSession;
  updateCounselingSession: (id: string, updates: Partial<PastoralCounselingSession>) => void;
  deleteCounselingSession: (id: string) => void;
  intercessorySlots: IntercessoryWatchSlot[];
  addIntercessorySlot: (slot: Omit<IntercessoryWatchSlot, 'id' | 'created_at'>) => IntercessoryWatchSlot;
  updateIntercessorySlot: (id: string, updates: Partial<IntercessoryWatchSlot>) => void;
  deleteIntercessorySlot: (id: string) => void;

  // Communication
  communications: CommunicationRecord[];
  sendSMSMessage: (record: Omit<CommunicationRecord, 'id' | 'sent_at'>) => CommunicationRecord;

  // Audit Logs
  auditLogs: AuditLog[];
  logAction: (action: string, module: string, details: string, recordId?: string) => void;

  // Welfare & Benevolence
  welfareContributions: WelfareContribution[];
  recordWelfareContribution: (record: Omit<WelfareContribution, 'id' | 'created_at'>) => WelfareContribution;
  deleteWelfareContribution: (id: string) => void;
  welfareClaims: WelfareClaim[];
  submitWelfareClaim: (claim: Omit<WelfareClaim, 'id' | 'claim_number' | 'created_at'>) => WelfareClaim;
  updateWelfareClaim: (id: string, updates: Partial<WelfareClaim>) => void;
  deleteWelfareClaim: (id: string) => void;
  disburseWelfareClaim: (
    id: string,
    details: {
      disbursement_method: PaymentMethod;
      disbursement_channel?: string;
      disbursement_voucher_no: string;
      amount_approved: number;
      amount_paid?: number;
      pastoral_notes?: string;
      finance_account_id?: string;
      finance_account_name?: string;
      sync_with_church_finance?: boolean;
    }
  ) => void;

  // Children's Ministry Safety & Pickup Tags
  childCheckIns: ChildCheckInRecord[];
  checkInChild: (
    record: Omit<ChildCheckInRecord, 'id' | 'security_code' | 'created_at' | 'status'> & { security_code?: string }
  ) => ChildCheckInRecord;
  checkOutChild: (
    id: string,
    details: { checked_out_to_person: string; verified_by_leader: string }
  ) => void;
  summonChildParent: (id: string, notes?: string) => void;
  deleteChildCheckIn: (id: string) => void;

  // Church Assets & Equipment Inventory
  assets: ChurchAsset[];
  addAsset: (asset: Omit<ChurchAsset, 'id' | 'created_at'>) => ChurchAsset;
  updateAsset: (id: string, updates: Partial<ChurchAsset>) => void;
  deleteAsset: (id: string) => void;
  addAssetMaintenanceLog: (assetId: string, log: Omit<AssetMaintenanceLog, 'id'>) => void;

  // Volunteer & Multi-Department Duty Roster
  rosterAssignments: RosterAssignment[];
  addRosterAssignment: (record: Omit<RosterAssignment, 'id' | 'created_at'>) => RosterAssignment;
  updateRosterAssignment: (id: string, updates: Partial<RosterAssignment>, fallbackAssignment?: RosterAssignment) => void;
  deleteRosterAssignment: (id: string) => void;
  batchAddOrUpdateRosterAssignments: (records: Omit<RosterAssignment, 'id' | 'created_at'>[]) => void;
  rosterConflicts: RosterConflict[];

  // Foundation School & Believers Academy Discipleship
  foundationCohorts: FoundationCohort[];
  createFoundationCohort: (cohort: Omit<FoundationCohort, 'id' | 'created_at'>) => FoundationCohort;
  updateFoundationCohort: (id: string, updates: Partial<FoundationCohort>) => void;
  foundationStudents: FoundationStudent[];
  enrollMemberInFoundationSchool: (data: Omit<FoundationStudent, 'id' | 'created_at'>) => FoundationStudent;
  updateFoundationStudent: (id: string, updates: Partial<FoundationStudent>) => void;
  toggleFoundationModule: (studentId: string, moduleNumber: number) => void;
  graduateFoundationStudent: (studentId: string, certificateNo?: string) => void;

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
  clearSupabaseError: () => void;
  retryRosterSync: () => Promise<void>;

  // Refresh functionality
  isRefreshing: boolean;
  lastRefreshedAt: Date;
  refreshData: () => Promise<{ success: boolean; source: 'supabase' | 'local'; message: string }>;

  // General Reset
  resetToSampleData: () => void;
  resetToDefaultData: () => void;
}

const ChurchDataContext = createContext<ChurchDataContextType | undefined>(undefined);

export const ChurchDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const isInitialMount = React.useRef(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  const [settings, setSettings] = useState<ChurchSettings>(() => loadSettingsFromStorage(initialSettings));
  const [members, setMembers] = useState<Member[]>(() => {
    const loaded = loadFromStorage<Member[]>('members', []);
    if (!loaded || loaded.length === 0) return sampleMembers;
    const existingIds = new Set(loaded.map((m) => m.id));
    const missing = sampleMembers.filter((m) => !existingIds.has(m.id));
    return missing.length > 0 ? [...loaded, ...missing] : loaded;
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
    try {
      const saved = localStorage.getItem('gwcc_expenses');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.some((e: any) => typeof e?.id === 'string' && e.id.startsWith('exp-'))) {
            localStorage.removeItem('gwcc_expenses');
            return [];
          }
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return sampleExpenses;
  });

  const [churchAccounts, setChurchAccounts] = useState<ChurchAccount[]>(() => {
    try {
      const saved = localStorage.getItem('gwcc_churchAccounts');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.some((a: any) => a.id === 'acc-1' && a.current_balance === 48500)) {
            const zeroed = parsed.map((a: any) => ({ ...a, current_balance: 0.00 }));
            localStorage.setItem('gwcc_churchAccounts', JSON.stringify(zeroed));
            return zeroed;
          }
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return sampleChurchAccounts;
  });

  const [churchFinances, setChurchFinances] = useState<ChurchFinanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('gwcc_churchFinances');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return sampleChurchFinances;
  });

  const [departmentBudgets, setDepartmentBudgets] = useState<DepartmentBudget[]>(() => {
    try {
      const saved = localStorage.getItem('gwcc_departmentBudgets');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return sampleDepartmentBudgets;
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

  const [welfareContributions, setWelfareContributions] = useState<WelfareContribution[]>(() => {
    const loaded = loadFromStorage<WelfareContribution[]>('welfareContributions', []);
    return loaded && loaded.length > 0 ? loaded : sampleWelfareContributions;
  });

  const [welfareClaims, setWelfareClaims] = useState<WelfareClaim[]>(() => {
    const loaded = loadFromStorage<WelfareClaim[]>('welfareClaims', []);
    return loaded && loaded.length > 0 ? loaded : sampleWelfareClaims;
  });

  const [childCheckIns, setChildCheckIns] = useState<ChildCheckInRecord[]>(() => {
    const loaded = loadFromStorage<ChildCheckInRecord[]>('childCheckIns', []);
    return loaded && loaded.length > 0 ? loaded : sampleChildCheckIns;
  });

  const [assets, setAssets] = useState<ChurchAsset[]>(() => {
    const loaded = loadFromStorage<ChurchAsset[]>('assets', []);
    return loaded && loaded.length > 0 ? loaded : sampleAssets;
  });

  const [rosterAssignments, setRosterAssignments] = useState<RosterAssignment[]>(() => {
    const loaded = loadFromStorage<RosterAssignment[]>('rosterAssignments', []);
    if (!loaded || loaded.length === 0) return sampleRosterAssignments;
    const existingIds = new Set(loaded.map((r) => r.id));
    const missing = sampleRosterAssignments.filter((r) => !existingIds.has(r.id));
    return missing.length > 0 ? [...loaded, ...missing] : loaded;
  });
  const previousRosterAssignmentsRef = React.useRef(rosterAssignments);
  const pendingRosterSyncRef = React.useRef(new Map<string, RosterAssignment | null>());
  const isRosterSyncingRef = React.useRef(false);

  const [foundationCohorts, setFoundationCohorts] = useState<FoundationCohort[]>(() => {
    const loaded = loadFromStorage<FoundationCohort[]>('foundationCohorts', []);
    return loaded && loaded.length > 0 ? loaded : sampleFoundationCohorts;
  });

  const [foundationStudents, setFoundationStudents] = useState<FoundationStudent[]>(() => {
    const loaded = loadFromStorage<FoundationStudent[]>('foundationStudents', []);
    return loaded && loaded.length > 0 ? loaded : sampleFoundationStudents;
  });

  const [pastoralVisitations, setPastoralVisitations] = useState<PastoralVisitationRecord[]>(() => {
    const loaded = loadFromStorage<PastoralVisitationRecord[]>('pastoralVisitations', []);
    return loaded && loaded.length > 0 ? loaded : samplePastoralVisitations;
  });

  const [counselingSessions, setCounselingSessions] = useState<PastoralCounselingSession[]>(() => {
    const loaded = loadFromStorage<PastoralCounselingSession[]>('counselingSessions', []);
    return loaded && loaded.length > 0 ? loaded : samplePastoralCounselingSessions;
  });

  const [intercessorySlots, setIntercessorySlots] = useState<IntercessoryWatchSlot[]>(() => {
    const loaded = loadFromStorage<IntercessoryWatchSlot[]>('intercessorySlots', []);
    return loaded && loaded.length > 0 ? loaded : sampleIntercessoryWatchSlots;
  });

  useEffect(() => {
    const handleStorageSync = (event: StorageEvent) => {
      if (!event.key) return;

      if (event.key === 'services') {
        try {
          const nextValue = event.newValue ? JSON.parse(event.newValue) : sampleServices;
          if (Array.isArray(nextValue)) {
            setServices(nextValue);
          }
        } catch {
          // Ignore malformed storage payloads and keep current state.
        }
      }

      if (event.key === 'rosterAssignments') {
        try {
          const nextValue = event.newValue ? JSON.parse(event.newValue) : sampleRosterAssignments;
          if (Array.isArray(nextValue)) {
            setRosterAssignments(nextValue);
          }
        } catch {
          // Ignore malformed storage payloads and keep current state.
        }
      }
    };

    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  // Supabase states
  const [supabaseConfig, setSupabaseConfig] = useState(getStoredSupabaseConfig());
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>(() => getInitialSupabaseStatus());
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
    saveToStorage('churchAccounts', churchAccounts);
  }, [churchAccounts]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('churchFinances', churchFinances);
  }, [churchFinances]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('departmentBudgets', departmentBudgets);
  }, [departmentBudgets]);

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

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('welfareContributions', welfareContributions);
  }, [welfareContributions]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('welfareClaims', welfareClaims);
  }, [welfareClaims]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('childCheckIns', childCheckIns);
  }, [childCheckIns]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('assets', assets);
  }, [assets]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('rosterAssignments', rosterAssignments);
  }, [rosterAssignments]);

  const flushPendingRosterSync = useCallback(async () => {
    const isOnline = typeof navigator === 'undefined' || navigator.onLine;
    if (
      currentUser.role === 'member' ||
      !isSupabaseConfigured() ||
      !isOnline ||
      isRosterSyncingRef.current ||
      pendingRosterSyncRef.current.size === 0
    ) {
      return;
    }

    isRosterSyncingRef.current = true;
    const pending = [...pendingRosterSyncRef.current.entries()];
    const results = await Promise.all(
      pending.map(async ([id, assignment]) => ({
        id,
        assignment,
        result: assignment
          ? await syncRosterAssignmentToSupabase(assignment)
          : await deleteRosterAssignmentFromSupabase(id),
      }))
    );
    const errors: string[] = [];

    results.forEach(({ id, assignment, result }) => {
      if (!result.success) {
        errors.push(`${id}: ${result.error || 'Unknown roster sync error.'}`);
        // Prune from pending queue so automatic loop doesn't thrash; user can retry via button
        pendingRosterSyncRef.current.delete(id);
        return;
      }
      if (pendingRosterSyncRef.current.get(id) === assignment) {
        pendingRosterSyncRef.current.delete(id);
      }
    });

    isRosterSyncingRef.current = false;

    if (errors.length > 0) {
      const message = `Service roster cloud sync failed: ${errors.join('; ')}`;
      console.warn(message);
      setSupabaseStatus('error');
      setSupabaseError(message);
      return;
    }

    const now = new Date().toISOString();
    setSupabaseStatus('connected');
    setSupabaseError(null);
    setLastSyncTime(now);
    try {
      localStorage.setItem('gwcc_last_supabase_sync', now);
    } catch (error) {
      console.warn('Could not save the roster sync timestamp:', error);
    }

    if (pendingRosterSyncRef.current.size > 0) {
      void flushPendingRosterSync();
    }
  }, [currentUser.role]);

  const clearSupabaseError = useCallback(() => {
    setSupabaseError(null);
    if (supabaseStatus === 'error') {
      setSupabaseStatus(isSupabaseConfigured() ? 'connected' : 'disconnected');
    }
  }, [supabaseStatus]);

  const retryRosterSync = useCallback(async () => {
    rosterAssignments.forEach((item) => {
      pendingRosterSyncRef.current.set(item.id, item);
    });
    setSupabaseError(null);
    await flushPendingRosterSync();
  }, [rosterAssignments, flushPendingRosterSync]);

  useEffect(() => {
    if (currentUser.role === 'member') {
      pendingRosterSyncRef.current.clear();
      previousRosterAssignmentsRef.current = rosterAssignments;
      return;
    }

    const previousById = new Map(previousRosterAssignmentsRef.current.map((item) => [item.id, item]));
    const nextById = new Map(rosterAssignments.map((item) => [item.id, item]));

    previousById.forEach((previous, id) => {
      if (!nextById.has(id)) pendingRosterSyncRef.current.set(id, null);
      else if (nextById.get(id) !== previous) pendingRosterSyncRef.current.set(id, nextById.get(id)!);
    });
    nextById.forEach((next, id) => {
      if (!previousById.has(id)) pendingRosterSyncRef.current.set(id, next);
    });

    previousRosterAssignmentsRef.current = rosterAssignments;
    void flushPendingRosterSync();
  }, [currentUser.role, rosterAssignments, flushPendingRosterSync]);

  useEffect(() => {
    const handleOnline = () => void flushPendingRosterSync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushPendingRosterSync]);

  useEffect(() => {
    void flushPendingRosterSync();
  }, [supabaseConfig.url, flushPendingRosterSync]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('foundationCohorts', foundationCohorts);
  }, [foundationCohorts]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('foundationStudents', foundationStudents);
  }, [foundationStudents]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('pastoralVisitations', pastoralVisitations);
  }, [pastoralVisitations]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('counselingSessions', counselingSessions);
  }, [counselingSessions]);

  useEffect(() => {
    if (isInitialMount.current) return;
    saveToStorage('intercessorySlots', intercessorySlots);
  }, [intercessorySlots]);

  // Initial Supabase check and hydration
  useEffect(() => {
    if (currentUser.role === 'member' || !isSupabaseConfigured()) {
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
          if (data.rosterAssignments) {
            pendingRosterSyncRef.current.clear();
            previousRosterAssignmentsRef.current = data.rosterAssignments;
            setRosterAssignments(data.rosterAssignments);
          }
          if (data.attendance && data.attendance.length > 0) setAttendance(data.attendance);
          if (data.headcounts && data.headcounts.length > 0) setHeadcounts(data.headcounts);
          if (data.giving && data.giving.length > 0) setGiving(data.giving);
          if (data.expenses && data.expenses.length > 0) setExpenses(data.expenses);
          if (data.churchAccounts && data.churchAccounts.length > 0) setChurchAccounts(data.churchAccounts);
          if (data.churchFinances && data.churchFinances.length > 0) setChurchFinances(data.churchFinances);
          if (data.campaigns && data.campaigns.length > 0) setCampaigns(data.campaigns);
          if (data.pledges && data.pledges.length > 0) setPledges(data.pledges);
          if (data.ministries && data.ministries.length > 0) setMinistries(data.ministries);
          if (data.smallGroups && data.smallGroups.length > 0) setSmallGroups(data.smallGroups);
          if (data.events && data.events.length > 0) setEvents(data.events);
          if (data.pastoralCare && data.pastoralCare.length > 0) setPastoralCare(data.pastoralCare);
          if (data.prayerRequests && data.prayerRequests.length > 0) setPrayerRequests(data.prayerRequests);
          if (data.communications && data.communications.length > 0) setCommunications(data.communications);
          if (data.welfareContributions && data.welfareContributions.length > 0) setWelfareContributions(data.welfareContributions);
          if (data.welfareClaims && data.welfareClaims.length > 0) setWelfareClaims(data.welfareClaims);
          if (data.settings) setSettings(normalizeSettings(data.settings, initialSettings));

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
  }, [currentUser.role]);

  const connectSupabase = useCallback(async (url: string, key: string) => {
    return connectSupabaseRecord(url, key, setSupabaseStatus, setSupabaseError, setSupabaseConfig);
  }, []);

  const disconnectSupabase = useCallback(() => {
    disconnectSupabaseRecord(setSupabaseConfig, setSupabaseStatus, setSupabaseError);
  }, []);

  const pushToSupabase = useCallback(
    async (onProgress?: (step: string, percent: number) => void) => {
      if (currentUser.role === 'member') {
        const errors = ['Member accounts cannot push church-wide records to Supabase.'];
        setSupabaseError(errors[0]);
        return { success: false, summary: {}, errors };
      }

      const allData: ChurchAllData = {
        settings,
        members,
        visitors,
        services,
        rosterAssignments,
        attendance,
        headcounts,
        giving,
        expenses,
        churchAccounts,
        churchFinances,
        campaigns,
        pledges,
        ministries,
        smallGroups,
        events,
        pastoralCare,
        prayerRequests,
        communications,
        welfareContributions,
        welfareClaims,
        auditLogs,
      };

      return pushSupabaseDataRecord(
        allData,
        setSupabaseStatus,
        setSupabaseError,
        setLastSyncTime,
        onProgress
      );
    },
    [
      settings,
      members,
      visitors,
      services,
      rosterAssignments,
      attendance,
      headcounts,
      giving,
      expenses,
      churchAccounts,
      churchFinances,
      campaigns,
      pledges,
      ministries,
      smallGroups,
      events,
      pastoralCare,
      prayerRequests,
      communications,
      welfareContributions,
      welfareClaims,
      auditLogs,
      currentUser.role,
      setSupabaseError,
    ]
  );

  const pullFromSupabase = useCallback(async () => {
    if (currentUser.role === 'member') {
      return { success: false, errors: ['Member accounts cannot pull the full church dataset.'] };
    }

    const res = await pullSupabaseDataRecord(setSupabaseStatus, setSupabaseError, setLastSyncTime);
    if (res.success && res.data) {
      const { data } = res;
      if (data.members) setMembers(data.members);
      if (data.visitors) setVisitors(data.visitors);
      if (data.services) setServices(data.services);
      if (data.rosterAssignments) {
        previousRosterAssignmentsRef.current = data.rosterAssignments;
        setRosterAssignments(data.rosterAssignments);
      }
      if (data.attendance) setAttendance(data.attendance);
      if (data.headcounts) setHeadcounts(data.headcounts);
      if (data.giving) setGiving(data.giving);
      if (data.expenses) setExpenses(data.expenses);
      if (data.churchAccounts) setChurchAccounts(data.churchAccounts);
      if (data.churchFinances) setChurchFinances(data.churchFinances);
      if (data.campaigns) setCampaigns(data.campaigns);
      if (data.pledges) setPledges(data.pledges);
      if (data.ministries) setMinistries(data.ministries);
      if (data.smallGroups) setSmallGroups(data.smallGroups);
      if (data.events) setEvents(data.events);
      if (data.pastoralCare) setPastoralCare(data.pastoralCare);
      if (data.prayerRequests) setPrayerRequests(data.prayerRequests);
      if (data.communications) setCommunications(data.communications);
      if (data.welfareContributions) setWelfareContributions(data.welfareContributions);
      if (data.welfareClaims) setWelfareClaims(data.welfareClaims);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      if (data.settings) setSettings(normalizeSettings(data.settings, initialSettings));
      return { success: true, errors: [] };
    }

    return { success: false, errors: res.errors };
  }, [currentUser.role]);

  const refreshData = useCallback(async (): Promise<{ success: boolean; source: 'supabase' | 'local'; message: string }> => {
    if (currentUser.role === 'member') {
      return {
        success: false,
        source: 'local',
        message: 'Member accounts can refresh their personal roster from the Member Portal only.',
      };
    }

    setIsRefreshing(true);
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const isConfigured = isSupabaseConfigured();

      if (isConfigured && isOnline) {
        setSupabaseStatus('syncing');
        const pullRes = await pullAllDataFromSupabase();
        if (pullRes.success && pullRes.data) {
          const { data } = pullRes;
          if (data.members) setMembers(data.members);
          if (data.visitors) setVisitors(data.visitors);
          if (data.services) setServices(data.services);
          if (data.rosterAssignments) {
            pendingRosterSyncRef.current.clear();
            previousRosterAssignmentsRef.current = data.rosterAssignments;
            setRosterAssignments(data.rosterAssignments);
          }
          if (data.attendance) setAttendance(data.attendance);
          if (data.headcounts) setHeadcounts(data.headcounts);
          if (data.giving) setGiving(data.giving);
          if (data.expenses) setExpenses(data.expenses);
          if (data.churchAccounts) setChurchAccounts(data.churchAccounts);
          if (data.churchFinances) setChurchFinances(data.churchFinances);
          if (data.campaigns) setCampaigns(data.campaigns);
          if (data.pledges) setPledges(data.pledges);
          if (data.ministries) setMinistries(data.ministries);
          if (data.smallGroups) setSmallGroups(data.smallGroups);
          if (data.events) setEvents(data.events);
          if (data.pastoralCare) setPastoralCare(data.pastoralCare);
          if (data.prayerRequests) setPrayerRequests(data.prayerRequests);
          if (data.communications) setCommunications(data.communications);
          if (data.welfareContributions) setWelfareContributions(data.welfareContributions);
          if (data.welfareClaims) setWelfareClaims(data.welfareClaims);
          if (data.auditLogs) setAuditLogs(data.auditLogs);
          if (data.settings) setSettings(normalizeSettings(data.settings, initialSettings));

          setSupabaseStatus('connected');
          setSupabaseError(null);
          const now = new Date();
          setLastRefreshedAt(now);
          const nowIso = now.toISOString();
          setLastSyncTime(nowIso);
          try {
            localStorage.setItem('gwcc_last_supabase_sync', nowIso);
          } catch {
            // Ignore
          }

          return {
            success: true,
            source: 'supabase',
            message: 'All church records synced fresh from Supabase cloud database.',
          };
        }
      }

      // Local storage reload
      const loadedMembers = loadFromStorage<Member[]>('members', []);
      if (loadedMembers && loadedMembers.length > 0) setMembers(loadedMembers);

      const loadedVisitors = loadFromStorage<Visitor[]>('visitors', []);
      if (loadedVisitors && loadedVisitors.length > 0) setVisitors(loadedVisitors);

      const loadedServices = loadFromStorage<ChurchService[]>('services', []);
      if (loadedServices && loadedServices.length > 0) setServices(loadedServices);

      const loadedAttendance = loadFromStorage<AttendanceRecord[]>('attendance', []);
      if (loadedAttendance && loadedAttendance.length > 0) setAttendance(loadedAttendance);

      const loadedHeadcounts = loadFromStorage<HeadcountRecord[]>('headcounts', []);
      if (loadedHeadcounts && loadedHeadcounts.length > 0) setHeadcounts(loadedHeadcounts);

      const loadedGiving = loadFromStorage<GivingRecord[]>('giving', []);
      if (loadedGiving && loadedGiving.length > 0) setGiving(loadedGiving);

      const loadedExpenses = loadFromStorage<ExpenseRecord[]>('expenses', []);
      if (loadedExpenses && loadedExpenses.length > 0) setExpenses(loadedExpenses);

      const loadedChurchAccounts = loadFromStorage<ChurchAccount[]>('churchAccounts', []);
      if (loadedChurchAccounts && loadedChurchAccounts.length > 0) setChurchAccounts(loadedChurchAccounts);

      const loadedChurchFinances = loadFromStorage<ChurchFinanceRecord[]>('churchFinances', []);
      if (loadedChurchFinances && loadedChurchFinances.length > 0) setChurchFinances(loadedChurchFinances);

      const loadedDepartmentBudgets = loadFromStorage<DepartmentBudget[]>('departmentBudgets', []);
      if (loadedDepartmentBudgets && loadedDepartmentBudgets.length > 0) setDepartmentBudgets(loadedDepartmentBudgets);

      const loadedCampaigns = loadFromStorage<PledgeCampaign[]>('campaigns', []);
      if (loadedCampaigns && loadedCampaigns.length > 0) setCampaigns(loadedCampaigns);

      const loadedPledges = loadFromStorage<PledgeRecord[]>('pledges', []);
      if (loadedPledges && loadedPledges.length > 0) setPledges(loadedPledges);

      const loadedMinistries = loadFromStorage<Ministry[]>('ministries', []);
      if (loadedMinistries && loadedMinistries.length > 0) setMinistries(loadedMinistries);

      const loadedSmallGroups = loadFromStorage<SmallGroup[]>('smallGroups', []);
      if (loadedSmallGroups && loadedSmallGroups.length > 0) setSmallGroups(loadedSmallGroups);

      const loadedEvents = loadFromStorage<ChurchEvent[]>('events', []);
      if (loadedEvents && loadedEvents.length > 0) setEvents(loadedEvents);

      const loadedPastoralCare = loadFromStorage<PastoralCareRecord[]>('pastoralCare', []);
      if (loadedPastoralCare && loadedPastoralCare.length > 0) setPastoralCare(loadedPastoralCare);

      const loadedPrayerRequests = loadFromStorage<PrayerRequest[]>('prayerRequests', []);
      if (loadedPrayerRequests && loadedPrayerRequests.length > 0) setPrayerRequests(loadedPrayerRequests);

      const loadedCommunications = loadFromStorage<CommunicationRecord[]>('communications', []);
      if (loadedCommunications && loadedCommunications.length > 0) setCommunications(loadedCommunications);

      const loadedAuditLogs = loadFromStorage<AuditLog[]>('auditLogs', []);
      if (loadedAuditLogs && loadedAuditLogs.length > 0) setAuditLogs(loadedAuditLogs);

      const loadedSettings = loadFromStorage('settings', initialSettings);
      if (loadedSettings) setSettings(normalizeSettings(loadedSettings, initialSettings));

      const now = new Date();
      setLastRefreshedAt(now);

      return {
        success: true,
        source: 'local',
        message: 'Church records reloaded fresh from local storage.',
      };
    } catch (err: any) {
      return {
        success: false,
        source: 'local',
        message: `Refresh failed: ${err?.message || 'Unknown error'}`,
      };
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  }, [currentUser.role]);

  const logAction = (action: string, module: string, details: string, recordId?: string) => {
    logActionRecord(action, module, details, recordId, currentUser, setAuditLogs, dbSyncUpsert);
  };

  const updateSettings = (newSettings: Partial<ChurchSettings>) => {
    setSettings((prev) => {
      const updated = normalizeSettings({ ...prev, ...newSettings }, prev);
      logAction('UPDATE_SETTINGS', 'Settings', 'Updated church profile and parameters');
      dbSyncUpsert('settings', { id: 'gwcc_global_settings', ...updated, updated_at: new Date().toISOString() });
      return updated;
    });
  };

  // Helper to generate the next member ID matching canonical GWCC-XXXX convention.
  const generateMemberId = () => {
    const numbers = members.map((m) => {
      const match = m.member_id.match(/GWCC-(\d+)/i) || m.member_id.match(/MEMBER-(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    let nextNum = maxNum + 1;
    let candidate = `GWCC-${String(nextNum).padStart(4, '0')}`;
    while (members.some((m) => m.member_id.toUpperCase() === candidate.toUpperCase())) {
      nextNum++;
      candidate = `GWCC-${String(nextNum).padStart(4, '0')}`;
    }
    return candidate;
  };

  // Helper to generate next Tithe Number: T-1049
  const generateTitheNumber = () => {
    const numbers = members.map((m) => {
      if (!m.tithe_number) return 1000;
      const match = m.tithe_number.match(/T-(\d+)/i);
      return match ? parseInt(match[1], 10) : 1000;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 1000;
    let nextNum = maxNum + 1;
    let candidate = `T-${nextNum}`;
    while (members.some((m) => m.tithe_number?.toUpperCase() === candidate.toUpperCase())) {
      nextNum++;
      candidate = `T-${nextNum}`;
    }
    return candidate;
  };

  // MEMBER OPERATIONS
  const addMember = (data: Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'>): Member =>
    addMemberRecord(data, members, setMembers, logAction, dbSyncUpsert, generateMemberId, generateTitheNumber);

  const updateMember = (id: string, updates: Partial<Member>) => {
    updateMemberRecord(id, updates, setMembers, logAction, dbSyncUpsert);
  };

  const bulkUpdateMembers = (memberIds: string[], updates: Partial<Member>) => {
    bulkUpdateMembersRecord(memberIds, updates, setMembers, logAction, dbSyncUpsert);
  };

  const archiveMember = (id: string) => {
    archiveMemberRecord(id, setMembers, logAction, dbSyncUpsert);
  };

  const unarchiveMember = (id: string) => {
    unarchiveMemberRecord(id, setMembers, logAction, dbSyncUpsert);
  };

  const getMember = (id: string) => getMemberRecord(members, id);

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
  const createService = (data: Omit<ChurchService, 'id'>): ChurchService =>
    createServiceRecord(data, setServices, logAction, dbSyncUpsert);

  const updateService = (id: string, updates: Partial<ChurchService>) => {
    updateServiceRecord(id, updates, setServices, logAction, dbSyncUpsert);
  };

  const deleteService = (id: string) => {
    deleteServiceRecord(id, setServices, logAction, dbSyncDelete);
  };

  const recordAttendance = (
    serviceId: string,
    personType: 'member' | 'visitor',
    personId: string,
    method: 'manual' | 'search' | 'qr_code' = 'manual',
    customDate?: string
  ): { success: boolean; message: string } =>
    recordAttendanceRecord(
      serviceId,
      personType,
      personId,
      members,
      visitors,
      attendance,
      setAttendance,
      services,
      logAction,
      dbSyncUpsert,
      method,
      customDate
    );

  const batchRecordAttendance = (
    serviceId: string,
    date: string,
    items: Array<{ personType: 'member' | 'visitor'; personId: string; method?: 'manual' | 'search' | 'qr_code' }>
  ): { added: number; skipped: number } =>
    batchRecordAttendanceRecord(
      serviceId,
      date,
      items,
      services,
      members,
      visitors,
      attendance,
      setAttendance,
      logAction,
      dbSyncUpsert
    );

  const recordHeadcount = (data: Omit<HeadcountRecord, 'id' | 'created_at'>): HeadcountRecord =>
    recordHeadcountRecord(data, headcounts, setHeadcounts, logAction, dbSyncUpsert);

  const updateHeadcount = (id: string, updates: Partial<HeadcountRecord>) => {
    updateHeadcountRecord(id, updates, setHeadcounts, logAction, dbSyncUpsert);
  };

  const deleteHeadcount = (id: string) => {
    deleteHeadcountRecord(id, setHeadcounts, logAction, dbSyncDelete);
  };

  const deleteAttendanceRecord = (id: string) => {
    deleteAttendanceRecordRecord(id, setAttendance, logAction, dbSyncDelete);
  };

  // FINANCE & GIVING
  const recordGiving = (data: Omit<GivingRecord, 'id' | 'created_at'>): GivingRecord => {
    const record = recordGivingRecord(data, members, setGiving, logAction, dbSyncUpsert);
    if (data.pledge_id && data.amount > 0) {
      setPledges((prev) =>
        prev.map((p) => {
          if (p.id === data.pledge_id) {
            const newPaid = p.amount_paid + data.amount;
            const newBalance = Math.max(0, p.amount_pledged - newPaid);
            const newStatus = newBalance === 0 ? 'completed' : 'partially_paid';
            const updated = {
              ...p,
              amount_paid: newPaid,
              balance: newBalance,
              status: newStatus as any,
              updated_at: new Date().toISOString(),
            };
            dbSyncUpsert('pledges', updated);
            return updated;
          }
          return p;
        })
      );
    }
    return record;
  };

  const updateGiving = (id: string, updates: Partial<GivingRecord>) => {
    updateGivingRecord(id, updates, members, setGiving, logAction, dbSyncUpsert);
  };

  const deleteGiving = (id: string) => {
    deleteGivingRecord(id, setGiving, logAction, dbSyncDelete);
  };

  const voidGiving = (id: string, reason: string) => {
    const actor = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Finance Secretariat';
    voidGivingRecord(id, reason, actor, setGiving, logAction, dbSyncUpsert);
  };

  const recordExpense = (data: Omit<ExpenseRecord, 'id' | 'created_at'>): ExpenseRecord =>
    recordExpenseRecord(data, setExpenses, logAction, dbSyncUpsert);

  const updateExpense = (id: string, updates: Partial<ExpenseRecord>) => {
    updateExpenseRecord(id, updates, setExpenses, logAction, dbSyncUpsert);
  };

  const deleteExpense = (id: string) => {
    deleteExpenseRecord(id, setExpenses, logAction, dbSyncDelete);
  };

  // DEDICATED CHURCH ACCOUNTS & FINANCES
  const addChurchAccount = (data: Omit<ChurchAccount, 'id' | 'created_at' | 'updated_at'>): ChurchAccount =>
    addChurchAccountRecord(data, setChurchAccounts, logAction, dbSyncUpsert);

  const updateChurchAccount = (id: string, updates: Partial<ChurchAccount>) => {
    updateChurchAccountRecord(id, updates, setChurchAccounts, logAction, dbSyncUpsert);
  };

  const deleteChurchAccount = (id: string) => {
    deleteChurchAccountRecord(id, setChurchAccounts, logAction, dbSyncDelete);
  };

  const recordChurchFinance = (data: Omit<ChurchFinanceRecord, 'id' | 'created_at' | 'updated_at'>): ChurchFinanceRecord =>
    recordChurchFinanceRecord(data, setChurchFinances, setChurchAccounts, setDepartmentBudgets, logAction, dbSyncUpsert);

  const updateChurchFinance = (id: string, updates: Partial<ChurchFinanceRecord>) => {
    updateChurchFinanceRecord(id, updates, setChurchFinances, setChurchAccounts, setDepartmentBudgets, logAction, dbSyncUpsert);
  };

  const deleteChurchFinance = (id: string) => {
    deleteChurchFinanceRecord(id, setChurchFinances, setChurchAccounts, setDepartmentBudgets, logAction, dbSyncDelete, dbSyncUpsert);
  };

  const voidChurchFinance = (id: string, reason: string) => {
    const userSignature = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Finance Secretariat';
    voidChurchFinanceRecord(id, reason, userSignature, setChurchFinances, setChurchAccounts, setDepartmentBudgets, logAction, dbSyncUpsert);
  };

  const transferBetweenAccounts = (fromAccountId: string, toAccountId: string, amount: number, notes?: string) =>
    transferBetweenAccountsRecord(fromAccountId, toAccountId, amount, notes, setChurchAccounts, setChurchFinances, logAction, dbSyncUpsert);

  const addDepartmentBudget = (data: Omit<DepartmentBudget, 'id' | 'created_at' | 'updated_at'>): DepartmentBudget =>
    addDepartmentBudgetRecord(data, setDepartmentBudgets, logAction);

  const updateDepartmentBudget = (id: string, updates: Partial<DepartmentBudget>) => {
    updateDepartmentBudgetRecord(id, updates, setDepartmentBudgets, logAction);
  };

  const resetChurchFinanceData = (mode: 'reset_balances' | 'wipe_all' = 'reset_balances') => {
    setChurchFinances([]);
    setExpenses([]);
    setDepartmentBudgets([]);
    saveToStorage('churchFinances', []);
    saveToStorage('expenses', []);
    saveToStorage('departmentBudgets', []);

    if (mode === 'wipe_all') {
      setChurchAccounts([]);
      saveToStorage('churchAccounts', []);
      logAction('PURGE_ALL_FINANCE', 'Church Finance', 'Purged all financial records and accounts to start completely afresh');
    } else {
      setChurchAccounts((prev) => {
        const sourceAccounts = prev.length > 0 ? prev : sampleChurchAccounts;
        const zeroed = sourceAccounts.map((acc) => ({
          ...acc,
          current_balance: 0.00,
          updated_at: new Date().toISOString(),
        }));
        saveToStorage('churchAccounts', zeroed);
        return zeroed;
      });
      logAction('RESET_FINANCE_DATA', 'Church Finance', 'Cleared all transactions and reset treasury account balances to GH₵ 0.00');
    }

    return { success: true, message: 'Finance records cleared. You can now start afresh with a clean financial slate.' };
  };

  // CAMPAIGNS
  const addCampaign = (data: Omit<PledgeCampaign, 'id'>): PledgeCampaign =>
    addCampaignRecord(data, setCampaigns, logAction, dbSyncUpsert);

  const updateCampaign = (id: string, updates: Partial<PledgeCampaign>) => {
    updateCampaignRecord(id, updates, setCampaigns, logAction, dbSyncUpsert);
  };

  const deleteCampaign = (id: string) => {
    deleteCampaignRecord(id, campaigns, setCampaigns, logAction, dbSyncDelete);
  };

  // PLEDGES
  const createPledge = (
    data: Omit<PledgeRecord, 'id' | 'balance' | 'status' | 'created_at'>
  ): PledgeRecord => createPledgeRecord(data, members, setPledges, logAction, dbSyncUpsert);

  const updatePledge = (id: string, updates: Partial<PledgeRecord>) => {
    updatePledgeRecord(id, updates, setPledges, logAction, dbSyncUpsert);
  };

  const deletePledge = (id: string) => {
    deletePledgeRecord(id, pledges, setPledges, logAction, dbSyncDelete);
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
    recordPledgePaymentRecord(
      pledgeId,
      amount,
      pledges,
      setPledges,
      logAction,
      dbSyncUpsert,
      (data) => recordGiving(data),
      paymentDetails
    );
  };

  // MINISTRIES & SMALL GROUPS
  const addMinistry = (data: Omit<Ministry, 'id' | 'member_count'>): Ministry =>
    addMinistryRecord(data, setMinistries, logAction, dbSyncUpsert);

  const updateMinistry = (id: string, updates: Partial<Ministry>) => {
    updateMinistryRecord(id, updates, setMinistries, logAction, dbSyncUpsert);
  };

  const deleteMinistry = (id: string) => {
    deleteMinistryRecord(id, ministries, setMinistries, setMembers, logAction, dbSyncUpsert, dbSyncDelete);
  };

  const assignMemberToMinistry = (
    memberId: string,
    ministryId: string,
    ministryName: string,
    role?: string
  ) => {
    assignMemberToMinistryRecord(memberId, ministryId, ministryName, role, setMembers, logAction, dbSyncUpsert);
  };

  const removeMemberFromMinistry = (memberId: string) => {
    removeMemberFromMinistryRecord(memberId, setMembers, logAction, dbSyncUpsert);
  };

  const addSmallGroup = (data: Omit<SmallGroup, 'id' | 'member_count'>): SmallGroup =>
    addSmallGroupRecord(data, setSmallGroups, logAction, dbSyncUpsert);

  // EVENTS
  const createEvent = (data: Omit<ChurchEvent, 'id'>): ChurchEvent =>
    createEventRecord(data, setEvents, logAction, dbSyncUpsert);

  const updateEvent = (id: string, updates: Partial<ChurchEvent>) => {
    updateEventRecord(id, updates, setEvents, logAction, dbSyncUpsert);
  };

  const deleteEvent = (id: string) => {
    deleteEventRecord(id, events, setEvents, logAction, dbSyncDelete);
  };

  const addEventAttendee = (
    eventId: string,
    attendee: { name: string; phone?: string; email?: string; member_id?: string; role?: string }
  ) => {
    addEventAttendeeRecord(eventId, attendee, setEvents, logAction, dbSyncUpsert);
  };

  const removeEventAttendee = (eventId: string, attendeeId: string) => {
    removeEventAttendeeRecord(eventId, attendeeId, setEvents, dbSyncUpsert);
  };

  const toggleAttendeeCheckIn = (eventId: string, attendeeId: string) => {
    toggleAttendeeCheckInRecord(eventId, attendeeId, setEvents, dbSyncUpsert);
  };

  // PASTORAL CARE & PRAYER REQUESTS
  const addPastoralCare = (
    data: Omit<PastoralCareRecord, 'id' | 'created_at'>
  ): PastoralCareRecord =>
    addPastoralCareRecord(data, members, setPastoralCare, logAction, dbSyncUpsert);

  const addPrayerRequest = (
    data: Omit<PrayerRequest, 'id' | 'created_at'>
  ): PrayerRequest => addPrayerRequestRecord(data, setPrayerRequests, logAction, dbSyncUpsert);

  const updatePrayerStatus = (
    id: string,
    status: PrayerRequest['status'],
    testimony?: string
  ) => {
    updatePrayerStatusRecord(id, status, testimony, setPrayerRequests, logAction, dbSyncUpsert);
  };

  const updatePastoralCareLog = (id: string, updates: Partial<PastoralCareRecord>) => {
    updatePastoralCareLogRecord(id, updates, setPastoralCare, logAction, dbSyncUpsert);
  };

  const deletePastoralCareLog = (id: string) => {
    deletePastoralCareLogRecord(id, setPastoralCare, logAction, dbSyncDelete);
  };

  const deletePrayerRequest = (id: string) => {
    deletePrayerRequestRecord(id, setPrayerRequests, logAction, dbSyncDelete);
  };

  // HOME & HOSPITAL VISITATIONS
  const addPastoralVisitation = (
    data: Omit<PastoralVisitationRecord, 'id' | 'created_at'>
  ): PastoralVisitationRecord =>
    addPastoralVisitationRecord(data, setPastoralVisitations, logAction, dbSyncUpsert);

  const updatePastoralVisitation = (
    id: string,
    updates: Partial<PastoralVisitationRecord>
  ) => {
    updatePastoralVisitationRecord(id, updates, setPastoralVisitations, logAction, dbSyncUpsert);
  };

  const deletePastoralVisitation = (id: string) => {
    deletePastoralVisitationRecord(id, setPastoralVisitations, logAction, dbSyncDelete);
  };

  // COUNSELING SESSIONS
  const addCounselingSession = (
    session: Omit<PastoralCounselingSession, 'id' | 'created_at'>
  ): PastoralCounselingSession =>
    addCounselingSessionRecord(session, setCounselingSessions, logAction, dbSyncUpsert);

  const updateCounselingSession = (
    id: string,
    updates: Partial<PastoralCounselingSession>
  ) => {
    updateCounselingSessionRecord(id, updates, setCounselingSessions, logAction, dbSyncUpsert);
  };

  const deleteCounselingSession = (id: string) => {
    deleteCounselingSessionRecord(id, setCounselingSessions, logAction, dbSyncDelete);
  };

  // INTERCESSORY PRAYER WATCH SLOTS
  const addIntercessorySlot = (
    slot: Omit<IntercessoryWatchSlot, 'id' | 'created_at'>
  ): IntercessoryWatchSlot =>
    addIntercessorySlotRecord(slot, setIntercessorySlots, logAction, dbSyncUpsert);

  const updateIntercessorySlot = (
    id: string,
    updates: Partial<IntercessoryWatchSlot>
  ) => {
    updateIntercessorySlotRecord(id, updates, setIntercessorySlots, logAction, dbSyncUpsert);
  };

  const deleteIntercessorySlot = (id: string) => {
    deleteIntercessorySlotRecord(id, setIntercessorySlots, logAction, dbSyncDelete);
  };

  // COMMUNICATION
  const sendSMSMessage = (
    data: Omit<CommunicationRecord, 'id' | 'sent_at'>
  ): CommunicationRecord =>
    sendSMSMessageRecord(
      {
        ...data,
        created_by: `${currentUser.first_name} ${currentUser.last_name}`,
      },
      setCommunications,
      logAction,
      dbSyncUpsert
    );

  // WELFARE & BENEVOLENCE
  const recordWelfareContribution = (
    data: Omit<WelfareContribution, 'id' | 'created_at'>
  ): WelfareContribution =>
    recordWelfareContributionRecord(data, setWelfareContributions, logAction, dbSyncUpsert);

  const deleteWelfareContribution = (id: string) => {
    deleteWelfareContributionRecord(id, welfareContributions, setWelfareContributions, logAction, dbSyncDelete);
  };

  const submitWelfareClaim = (
    data: Omit<WelfareClaim, 'id' | 'claim_number' | 'created_at'>
  ): WelfareClaim => submitWelfareClaimRecord(data, welfareClaims, setWelfareClaims, logAction, dbSyncUpsert);

  const updateWelfareClaim = (id: string, updates: Partial<WelfareClaim>) => {
    updateWelfareClaimRecord(id, updates, setWelfareClaims, logAction, dbSyncUpsert);
  };

  const deleteWelfareClaim = (id: string) => {
    deleteWelfareClaimRecord(id, welfareClaims, setWelfareClaims, logAction, dbSyncDelete);
  };

  const disburseWelfareClaim = (
    id: string,
    details: {
      disbursement_method: PaymentMethod;
      disbursement_channel?: string;
      disbursement_voucher_no: string;
      amount_approved: number;
      amount_paid?: number;
      pastoral_notes?: string;
      finance_account_id?: string;
      finance_account_name?: string;
      sync_with_church_finance?: boolean;
    }
  ) => {
    const claim = welfareClaims.find((c) => c.id === id);
    const amountToDisburse = details.amount_paid !== undefined ? details.amount_paid : details.amount_approved;

    disburseWelfareClaimRecord(
      id,
      {
        ...details,
        recorded_by: `${currentUser.first_name} ${currentUser.last_name}`,
      },
      setWelfareClaims,
      logAction,
      dbSyncUpsert
    );

    // If sync with Church Finance is enabled, record as institutional Church Finance expense
    if (details.sync_with_church_finance && amountToDisburse > 0 && claim) {
      const today = new Date().toISOString().split('T')[0];
      const accountName = details.finance_account_name || 'Main Operating Account';

      const newExpenseRecord: ChurchFinanceRecord = {
        id: `fin-welfare-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transaction_type: 'disbursement',
        account_id: details.finance_account_id,
        account_name: accountName,
        category: 'Benevolence & Welfare',
        title: `Welfare Grant: ${claim.member_name} (${claim.category.replace('_', ' ')})`,
        recipient_or_vendor: claim.member_name,
        amount: amountToDisburse,
        currency: 'GHS',
        date: today,
        payment_method: details.disbursement_method,
        reference_no: details.disbursement_voucher_no,
        department: 'Welfare & Pastoral Care',
        description: `Benevolence voucher ${details.disbursement_voucher_no} disbursed for ${claim.title}. ${details.pastoral_notes || ''}`,
        notes: `Beneficiary phone: ${claim.member_phone || 'N/A'}. Claim Ref: ${claim.claim_number}`,
        approved_by: `${currentUser.first_name} ${currentUser.last_name}`,
        recorded_by: `${currentUser.first_name} ${currentUser.last_name}`,
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setChurchFinances((prev) => [newExpenseRecord, ...prev]);
      if (dbSyncUpsert) {
        dbSyncUpsert('church_finances', newExpenseRecord);
      }

      // Debit account if account_id is present
      if (details.finance_account_id) {
        setChurchAccounts((prev) =>
          prev.map((acc) => {
            if (acc.id === details.finance_account_id) {
              const updatedAcc = {
                ...acc,
                current_balance: Math.max(0, acc.current_balance - amountToDisburse),
                updated_at: new Date().toISOString(),
              };
              if (dbSyncUpsert) {
                dbSyncUpsert('church_accounts', updatedAcc);
              }
              return updatedAcc;
            }
            return acc;
          })
        );
      }

      // Update Welfare department budget if present
      setDepartmentBudgets((prevBudgets) =>
        prevBudgets.map((b) => {
          if (b.department.toLowerCase().includes('welfare') || b.department.toLowerCase().includes('benevolence')) {
            return {
              ...b,
              spent_amount: b.spent_amount + amountToDisburse,
              updated_at: new Date().toISOString(),
            };
          }
          return b;
        })
      );

      logAction(
        'RECORD_CHURCH_EXPENSE',
        'Church Finance',
        `Disbursed welfare benevolence of GH₵ ${amountToDisburse.toFixed(2)} from ${accountName} to ${claim.member_name} (Voucher ${details.disbursement_voucher_no})`,
        newExpenseRecord.id
      );
    }
  };

  // CHILDREN'S MINISTRY SAFETY & PICKUP TAGS
  const checkInChild = (
    data: Omit<ChildCheckInRecord, 'id' | 'security_code' | 'created_at' | 'status'> & { security_code?: string }
  ): ChildCheckInRecord => {
    const randomCode = data.security_code || `GWCC-K${Math.floor(100 + Math.random() * 900)}`;
    const newRecord: ChildCheckInRecord = {
      ...data,
      id: `chk-child-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      security_code: randomCode,
      status: 'checked_in',
      created_at: new Date().toISOString(),
    };
    setChildCheckIns((prev) => [newRecord, ...prev]);
    logAction(
      'CHILD_CHECK_IN',
      'Attendance',
      `Checked in ${data.child_name} into ${data.class_room} (Security Code: ${randomCode})`,
      newRecord.id
    );
    return newRecord;
  };

  const checkOutChild = (
    id: string,
    details: { checked_out_to_person: string; verified_by_leader: string }
  ) => {
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setChildCheckIns((prev) =>
      prev.map((ch) => {
        if (ch.id === id) {
          const updated: ChildCheckInRecord = {
            ...ch,
            status: 'checked_out',
            check_out_time: nowTime,
            checked_out_to_person: details.checked_out_to_person,
            verified_by_leader: details.verified_by_leader,
          };
          logAction(
            'CHILD_CHECK_OUT',
            'Attendance',
            `Safely checked out ${ch.child_name} to ${details.checked_out_to_person} (Verified by ${details.verified_by_leader})`,
            id
          );
          return updated;
        }
        return ch;
      })
    );
  };

  const summonChildParent = (id: string, notes?: string) => {
    setChildCheckIns((prev) =>
      prev.map((ch) => {
        if (ch.id === id) {
          const updated: ChildCheckInRecord = {
            ...ch,
            emergency_parent_called: true,
            emergency_call_notes: notes || 'Parent summoned to Sunday School',
          };
          logAction(
            'SUMMON_CHILD_PARENT',
            'Attendance',
            `Triggered emergency summon to parent ${ch.parent_name} (${ch.parent_phone}) for child ${ch.child_name}`,
            id
          );
          return updated;
        }
        return ch;
      })
    );
  };

  const deleteChildCheckIn = (id: string) => {
    setChildCheckIns((prev) => prev.filter((c) => c.id !== id));
  };

  // CHURCH ASSETS & INVENTORY
  const addAsset = (
    data: Omit<ChurchAsset, 'id' | 'created_at'>
  ): ChurchAsset => addAssetRecord(data, setAssets, logAction);

  const updateAsset = (id: string, updates: Partial<ChurchAsset>) => {
    updateAssetRecord(id, updates, setAssets, logAction);
  };

  const deleteAsset = (id: string) => {
    deleteAssetRecord(id, assets, setAssets, logAction);
  };

  const addAssetMaintenanceLog = (
    assetId: string,
    logData: Omit<AssetMaintenanceLog, 'id'>
  ) => {
    addAssetMaintenanceLogRecord(assetId, logData, setAssets, logAction);
  };

  // MULTI-DEPARTMENT DUTY ROSTER
  const addRosterAssignment = (
    data: Omit<RosterAssignment, 'id' | 'created_at'>
  ): RosterAssignment => {
    const created = addRosterAssignmentRecord(data, setRosterAssignments, logAction);
    try {
      fetch('/api/roster/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ROSTER_ASSIGNED',
          memberId: created.member_id,
          memberName: created.member_name,
          dutyId: created.id,
          serviceName: created.service_name,
          date: created.date,
          department: created.department,
          roleTitle: created.role_title,
          reportTime: created.report_time,
          notes: created.notes,
        }),
      }).catch(() => {});
    } catch {}
    return created;
  };

  const updateRosterAssignment = (
    id: string,
    updates: Partial<RosterAssignment>,
    fallbackAssignment?: RosterAssignment
  ) => {
    updateRosterAssignmentRecord(id, updates, setRosterAssignments, logAction, fallbackAssignment);
    try {
      const target = rosterAssignments.find((a) => a.id === id) || fallbackAssignment;
      if (target) {
        const type =
          updates.status === 'confirmed'
            ? 'ROSTER_CONFIRMED'
            : updates.status === 'substituted'
            ? 'ROSTER_SUBSTITUTED'
            : 'ROSTER_UPDATED';

        fetch('/api/roster/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            memberId: target.member_id,
            memberName: target.member_name,
            dutyId: target.id,
            serviceName: target.service_name,
            date: target.date,
            department: target.department,
            roleTitle: target.role_title,
            reportTime: target.report_time,
            notes: updates.notes || target.notes,
          }),
        }).catch(() => {});
      }
    } catch {}
  };

  const deleteRosterAssignment = (id: string) => {
    deleteRosterAssignmentRecord(id, rosterAssignments, setRosterAssignments, logAction);
  };

  const batchAddOrUpdateRosterAssignments = (
    records: Omit<RosterAssignment, 'id' | 'created_at'>[]
  ) => {
    batchAddOrUpdateRosterAssignmentsRecord(records, setRosterAssignments, logAction);
  };

  // Automated Roster Conflict Detection
  const rosterConflicts = React.useMemo<RosterConflict[]>(() => {
    return buildRosterConflictsRecord(rosterAssignments);
  }, [rosterAssignments]);

  // FOUNDATION SCHOOL & DISCIPLESHIP
  const createFoundationCohort = (
    data: Omit<FoundationCohort, 'id' | 'created_at'>
  ): FoundationCohort => createFoundationCohortRecord(data, setFoundationCohorts, logAction);

  const updateFoundationCohort = (id: string, updates: Partial<FoundationCohort>) => {
    updateFoundationCohortRecord(id, updates, setFoundationCohorts, logAction);
  };

  const enrollMemberInFoundationSchool = (
    data: Omit<FoundationStudent, 'id' | 'created_at'>
  ): FoundationStudent =>
    enrollMemberInFoundationSchoolRecord(data, setFoundationStudents, logAction);

  const updateFoundationStudent = (id: string, updates: Partial<FoundationStudent>) => {
    updateFoundationStudentRecord(id, updates, setFoundationStudents, logAction);
  };

  const toggleFoundationModule = (studentId: string, moduleNumber: number) => {
    toggleFoundationModuleRecord(studentId, moduleNumber, setFoundationStudents, logAction);
  };

  const graduateFoundationStudent = (studentId: string, certificateNo?: string) => {
    graduateFoundationStudentRecord(studentId, certificateNo, setFoundationStudents, setMembers, logAction);
  };

  // RESET
  const resetToSampleData = () => {
    resetToSampleDataState(
      {
        setSettings,
        setMembers,
        setVisitors,
        setServices,
        setAttendance,
        setHeadcounts,
        setGiving,
        setCampaigns,
        setPledges,
        setExpenses,
        setChurchAccounts,
        setChurchFinances,
        setDepartmentBudgets,
        setMinistries,
        setSmallGroups,
        setEvents,
        setPastoralCare,
        setPrayerRequests,
        setCommunications,
        setAuditLogs,
        setWelfareContributions,
        setWelfareClaims,
        setChildCheckIns,
        setAssets,
        setRosterAssignments,
        setFoundationCohorts,
        setFoundationStudents,
        setPastoralVisitations,
        setCounselingSessions,
        setIntercessorySlots,
      },
      saveToStorage,
      logAction
    );
  };

  const contextValue = React.useMemo<ChurchDataContextType>(
    () => ({
      settings,
      updateSettings,
      members,
      addMember,
      updateMember,
      bulkUpdateMembers,
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
      voidGiving,
      expenses,
      recordExpense,
      updateExpense,
      deleteExpense,
      churchAccounts,
      addChurchAccount,
      updateChurchAccount,
      deleteChurchAccount,
      churchFinances,
      recordChurchFinance,
      updateChurchFinance,
      deleteChurchFinance,
      voidChurchFinance,
      transferBetweenAccounts,
      departmentBudgets,
      addDepartmentBudget,
      updateDepartmentBudget,
      resetChurchFinanceData,
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
      addPastoralCareLog: (record: Omit<PastoralCareRecord, 'id' | 'created_at'>) =>
        addPastoralCareLogRecord(record, members, setPastoralCare, logAction, dbSyncUpsert),
      updatePastoralCareLog,
      deletePastoralCareLog,
      prayerRequests,
      addPrayerRequest,
      updatePrayerStatus,
      deletePrayerRequest,
      pastoralVisitations,
      addPastoralVisitation,
      updatePastoralVisitation,
      deletePastoralVisitation,
      counselingSessions,
      addCounselingSession,
      updateCounselingSession,
      deleteCounselingSession,
      intercessorySlots,
      addIntercessorySlot,
      updateIntercessorySlot,
      deleteIntercessorySlot,
      communications,
      sendSMSMessage,
      auditLogs,
      logAction,
      welfareContributions,
      recordWelfareContribution,
      deleteWelfareContribution,
      welfareClaims,
      submitWelfareClaim,
      updateWelfareClaim,
      deleteWelfareClaim,
      disburseWelfareClaim,
      childCheckIns,
      checkInChild,
      checkOutChild,
      summonChildParent,
      deleteChildCheckIn,
      assets,
      addAsset,
      updateAsset,
      deleteAsset,
      addAssetMaintenanceLog,
      rosterAssignments,
      addRosterAssignment,
      updateRosterAssignment,
      deleteRosterAssignment,
      batchAddOrUpdateRosterAssignments,
      rosterConflicts,
      foundationCohorts,
      createFoundationCohort,
      updateFoundationCohort,
      foundationStudents,
      enrollMemberInFoundationSchool,
      updateFoundationStudent,
      toggleFoundationModule,
      graduateFoundationStudent,
      isSupabaseConfigured: isSupabaseConfigured(),
      supabaseStatus,
      supabaseError,
      lastSyncTime,
      supabaseConfig,
      connectSupabase,
      disconnectSupabase,
      pushToSupabase,
      pullFromSupabase,
      clearSupabaseError,
      retryRosterSync,
      isRefreshing,
      lastRefreshedAt,
      refreshData,
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
      churchAccounts,
      churchFinances,
      departmentBudgets,
      campaigns,
      pledges,
      ministries,
      smallGroups,
      events,
      pastoralCare,
      prayerRequests,
      communications,
      auditLogs,
      welfareContributions,
      welfareClaims,
      childCheckIns,
      assets,
      rosterAssignments,
      rosterConflicts,
      foundationCohorts,
      foundationStudents,
      pastoralVisitations,
      counselingSessions,
      intercessorySlots,
      supabaseStatus,
      supabaseError,
      lastSyncTime,
      supabaseConfig,
      clearSupabaseError,
      retryRosterSync,
      isRefreshing,
      lastRefreshedAt,
      refreshData,
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
