import { withSyncTransaction, hasPendingChanges } from '../lib/supabase';
import { createPickupToken, findPickup } from '../lib/childSafety';
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
  WelfareEvent,
  WelfareEventContribution,
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
import { initialSettings } from '../lib/initialData';
import type {DraftInput} from '../lib/communicationUtils';
import { attendanceSessionError } from '../features/attendance/attendanceInsights';
import { useAuth } from './AuthContext';
import {
  isSupabaseConfigured,
  getStoredSupabaseConfig,
  getSupabaseClient,
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
  SYNC_TABLES,
  mergePendingRecords,
  flushSyncOutbox,
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
  saveCommunicationDraft as saveCommunicationDraftRecord,
  archiveCommunicationDraft as archiveCommunicationDraftRecord,
} from '../features/communications/communicationStore';
import {
  deleteWelfareClaim as deleteWelfareClaimRecord,
  deleteWelfareContribution as deleteWelfareContributionRecord,
  disburseWelfareClaim as disburseWelfareClaimRecord,
  recordWelfareContribution as recordWelfareContributionRecord,
  submitWelfareClaim as submitWelfareClaimRecord,
  updateWelfareClaim as updateWelfareClaimRecord,
  createWelfareEvent as createWelfareEventRecord,
  updateWelfareEvent as updateWelfareEventRecord,
  closeWelfareEvent as closeWelfareEventRecord,
  deleteWelfareEvent as deleteWelfareEventRecord,
  recordEventContribution as recordEventContributionRecord,
  updateEventContribution as updateEventContributionRecord,
  deleteEventContribution as deleteEventContributionRecord,
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
  registerVisitorAndCheckIn: (data: Omit<Visitor, 'id' | 'created_at' | 'updated_at'>, serviceId: string, date: string) => Visitor;
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
  saveCommunicationDraft: (record: DraftInput) => Promise<CommunicationRecord>;
  archiveCommunicationDraft: (id:string,archived:boolean) => Promise<CommunicationRecord>;

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

  // Welfare Contribution Events
  welfareEvents: WelfareEvent[];
  createWelfareEvent: (event: Omit<WelfareEvent, 'id' | 'created_at' | 'updated_at'>) => WelfareEvent;
  updateWelfareEvent: (id: string, updates: Partial<WelfareEvent>) => WelfareEvent | undefined;
  closeWelfareEvent: (id: string) => WelfareEvent | undefined;
  deleteWelfareEvent: (id: string, force?: boolean) => { success: boolean; message: string };
  clearAllWelfareEvents: () => { success: boolean; message: string };
  welfareEventContributions: WelfareEventContribution[];
  recordEventContribution: (
    data: Omit<WelfareEventContribution, 'id' | 'created_at' | 'updated_at'>,
    options?: {
      forceDuplicateConfirmation?: boolean;
      linkToChurchFinance?: boolean;
      financeAccountId?: string;
      financeAccountName?: string;
    }
  ) => { success: boolean; contribution?: WelfareEventContribution; error?: string; isDuplicateWarning?: boolean };
  updateEventContribution: (id: string, updates: Partial<WelfareEventContribution>) => void;
  deleteEventContribution: (id: string) => void;

  // Children's Ministry Safety & Pickup Tags
  childCheckIns: ChildCheckInRecord[];
  checkInChild: (
    record: Omit<ChildCheckInRecord, 'id' | 'security_code' | 'created_at' | 'status'> & { security_code?: string }
  ) => Promise<ChildCheckInRecord>;
  checkOutChild: (
    id: string,
    details: { checked_out_to_person: string; verified_by_leader: string }
  ) => Promise<void>;
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
  const { currentUser, isAuthenticated, canAccess } = useAuth();
  const isInitialMount = React.useRef(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  const [settings, setSettings] = useState<ChurchSettings>(initialSettings);
  const [members, setMembers] = useState<Member[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [services, setServices] = useState<ChurchService[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [headcounts, setHeadcounts] = useState<HeadcountRecord[]>([]);
  const [giving, setGiving] = useState<GivingRecord[]>([]);
  const [campaigns, setCampaigns] = useState<PledgeCampaign[]>([]);
  const [pledges, setPledges] = useState<PledgeRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);

  const [churchAccounts, setChurchAccounts] = useState<ChurchAccount[]>([]);

  const [churchFinances, setChurchFinances] = useState<ChurchFinanceRecord[]>([]);

  const [departmentBudgets, setDepartmentBudgets] = useState<DepartmentBudget[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [pastoralCare, setPastoralCare] = useState<PastoralCareRecord[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [communications, setCommunications] = useState<CommunicationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [welfareContributions, setWelfareContributions] = useState<WelfareContribution[]>([]);

  const [welfareClaims, setWelfareClaims] = useState<WelfareClaim[]>([]);

  const [welfareEvents, setWelfareEvents] = useState<WelfareEvent[]>([]);

  const [welfareEventContributions, setWelfareEventContributions] = useState<WelfareEventContribution[]>([]);

  const [childCheckIns, setChildCheckIns] = useState<ChildCheckInRecord[]>([]);

  const [assets, setAssets] = useState<ChurchAsset[]>([]);

  const [rosterAssignments, setRosterAssignments] = useState<RosterAssignment[]>([]);

  const [foundationCohorts, setFoundationCohorts] = useState<FoundationCohort[]>([]);

  const [foundationStudents, setFoundationStudents] = useState<FoundationStudent[]>([]);

  const [pastoralVisitations, setPastoralVisitations] = useState<PastoralVisitationRecord[]>([]);

  const [counselingSessions, setCounselingSessions] = useState<PastoralCounselingSession[]>([]);

  const [intercessorySlots, setIntercessorySlots] = useState<IntercessoryWatchSlot[]>([]);

  const [dataOwner,setDataOwner]=useState('');
  const pledgesRef=React.useRef(pledges);pledgesRef.current=pledges;
  const commitPledges:React.Dispatch<React.SetStateAction<PledgeRecord[]>>=action=>{const next=typeof action==='function'?action(pledgesRef.current):action;pledgesRef.current=next;setPledges(next);};
  const givingRef=React.useRef(giving);givingRef.current=giving;
  const commitGiving:React.Dispatch<React.SetStateAction<GivingRecord[]>>=action=>{const next=typeof action==='function'?action(givingRef.current):action;givingRef.current=next;setGiving(next);};
  const financeStateRef=React.useRef({finances:churchFinances,accounts:churchAccounts,budgets:departmentBudgets});
  financeStateRef.current={finances:churchFinances,accounts:churchAccounts,budgets:departmentBudgets};
  const commitFinances:React.Dispatch<React.SetStateAction<ChurchFinanceRecord[]>>=action=>{
    const next=typeof action==='function'?action(financeStateRef.current.finances):action;
    financeStateRef.current.finances=next;setChurchFinances(next);
  };
  const commitAccounts:React.Dispatch<React.SetStateAction<ChurchAccount[]>>=action=>{
    const next=typeof action==='function'?action(financeStateRef.current.accounts):action;
    financeStateRef.current.accounts=next;setChurchAccounts(next);
  };
  const commitBudgets:React.Dispatch<React.SetStateAction<DepartmentBudget[]>>=action=>{
    const next=typeof action==='function'?action(financeStateRef.current.budgets):action;
    financeStateRef.current.budgets=next;setDepartmentBudgets(next);
  };

  const [supabaseConfig, setSupabaseConfig] = useState(getStoredSupabaseConfig());
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>('disconnected');
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const dataSetters: Record<string, React.Dispatch<React.SetStateAction<any[]>>> = {
    members: setMembers,
    visitors: setVisitors,
    services: setServices,
    attendance: setAttendance,
    headcounts: setHeadcounts,
    giving: setGiving,
    campaigns: setCampaigns,
    pledges: setPledges,
    expenses: setExpenses,
    churchAccounts: setChurchAccounts,
    churchFinances: setChurchFinances,
    departmentBudgets: setDepartmentBudgets,
    ministries: setMinistries,
    smallGroups: setSmallGroups,
    events: setEvents,
    pastoralCare: setPastoralCare,
    prayerRequests: setPrayerRequests,
    communications: setCommunications,
    auditLogs: setAuditLogs,
    welfareContributions: setWelfareContributions,
    welfareClaims: setWelfareClaims,
    welfareEvents: setWelfareEvents,
    welfareEventContributions: setWelfareEventContributions,
    childCheckIns: setChildCheckIns,
    assets: setAssets,
    rosterAssignments: setRosterAssignments,
    foundationCohorts: setFoundationCohorts,
    foundationStudents: setFoundationStudents,
    pastoralVisitations: setPastoralVisitations,
    counselingSessions: setCounselingSessions,
    intercessorySlots: setIntercessorySlots
  };
  const currentData = { members, visitors, services, attendance, headcounts, giving, campaigns, pledges, expenses, churchAccounts, churchFinances, departmentBudgets, ministries, smallGroups, events, pastoralCare, prayerRequests, communications, auditLogs, welfareContributions, welfareClaims, welfareEvents, welfareEventContributions, childCheckIns, assets, rosterAssignments, foundationCohorts, foundationStudents, pastoralVisitations, counselingSessions, intercessorySlots };
  const currentDataRef=React.useRef(currentData); currentDataRef.current=currentData;
  const documentBaseline=React.useRef<Record<string,any[]>>({});
  const incomingDocuments=React.useRef<Record<string,any[]>>({});
  const setterRef=React.useRef(dataSetters); setterRef.current=dataSetters;

  const applyData=useCallback((data:Partial<ChurchAllData>)=>{
    for(const {key} of SYNC_TABLES) {
      if(key==='settings') { if(data.settings) setSettings(normalizeSettings(data.settings,initialSettings)); continue; }
      const rows=(data as any)[key];
      if(Array.isArray(rows)) { incomingDocuments.current[key]=rows; setterRef.current[key]?.(rows); }
    }
  },[]);

  const clearSupabaseError=useCallback(()=>setSupabaseError(null),[]);
  const retryRosterSync=useCallback(async()=>{
    const status=await flushSyncOutbox();setSupabaseError(status.error || null);setSupabaseStatus(status.success?'connected':'error');
  },[]);
  const connectSupabase=useCallback(async(url:string,key:string)=>connectSupabaseRecord(url,key,setSupabaseStatus,setSupabaseError,setSupabaseConfig),[]);
  const disconnectSupabase=useCallback(()=>disconnectSupabaseRecord(setSupabaseConfig,setSupabaseStatus,setSupabaseError),[]);

  const refreshData=useCallback(async():Promise<{success:boolean;source:'supabase'|'local';message:string}>=>{
    if(!isAuthenticated) return {success:false,source:'local',message:'Please sign in.'};
    setIsRefreshing(true);
    try {
      if(typeof navigator!=='undefined' && !navigator.onLine) return {success:true,source:'local',message:'Offline. Your pending records remain on this device.'};
      await flushSyncOutbox();
      const result=await pullAllDataFromSupabase();
      applyData(result.data);
      if(!result.success) {setSupabaseStatus('error');setSupabaseError(result.errors.join('; '));return {success:false,source:'supabase',message:result.errors.join('; ')};}
      const now=new Date();setLastRefreshedAt(now);setLastSyncTime(now.toISOString());setSupabaseStatus('connected');setSupabaseError(null);
      return {success:true,source:'supabase',message:'Church records refreshed; unsent local changes preserved.'};
    } finally {setIsRefreshing(false);}
  },[isAuthenticated,currentUser.id,applyData]);
  useEffect(()=>{const reload=()=>void refreshData();window.addEventListener('gwcc-reload-cloud',reload);return()=>window.removeEventListener('gwcc-reload-cloud',reload);},[refreshData]);
  const pullFromSupabase=useCallback(async()=>{
    const result=await refreshData();return {success:result.success,errors:result.success?[]:[result.message]};
  },[refreshData]);
  const pushToSupabase=useCallback(async(onProgress?:(step:string,percent:number)=>void)=>{
    if(!isAuthenticated || !canAccess('settings')) return {success:false,summary:{},errors:['Administrator authorization is required.']};
    const result=await pushAllDataToSupabase({settings,...currentDataRef.current} as ChurchAllData,onProgress);
    setSupabaseStatus(result.success?'connected':'error');setSupabaseError(result.errors.join('; ') || null);return result;
  },[isAuthenticated,currentUser.id,currentUser.role,settings]);

  useEffect(()=>{
    // Session changes always clear the previous identity's in-memory records first.
    documentBaseline.current={};incomingDocuments.current={};setDataOwner('');
    for(const setter of Object.values(setterRef.current)) setter([]);
    setSettings(initialSettings);
    if(!isAuthenticated) {setSupabaseStatus('disconnected');return;}
    const local:Partial<ChurchAllData>={};
    for(const {key,table} of SYNC_TABLES) {
      if(key==='settings') {local.settings=mergePendingRecords('settings',[{id:'gwcc_global_settings',...loadFromStorage('settings',initialSettings)}])[0];continue;}
      (local as any)[key]=table==='communications'&&!canAccess('communication')?[]:mergePendingRecords(table,loadFromStorage(key,[]));
    }
    applyData(local);setDataOwner(`${currentUser.id}:${currentUser.role}`);
    let alive=true;
    const hydrate=async()=>{
      setSupabaseStatus('syncing');await flushSyncOutbox();
      const result=await pullAllDataFromSupabase();if(!alive)return;
      applyData(result.data);setSupabaseStatus(result.success?'connected':'error');setSupabaseError(result.errors.join('; ')||null);
    };
    void hydrate();
    return()=>{alive=false;};
  },[isAuthenticated,currentUser.id,currentUser.role,applyData]);

  useEffect(()=>{
    let alive=true;
    const update=(event:Event)=>{
      const {owner,records}=(event as CustomEvent).detail || {};
      if(!isAuthenticated || owner!==currentUser.id) return;
      const patches:Partial<ChurchAllData>={};
      for(const {table,key} of SYNC_TABLES) {
        const items=(records || []).filter((item:any)=>item.table===table);if(!items.length)continue;
        if(key==='settings') {patches.settings=items.at(-1).record;continue;}
        const map=new Map((currentDataRef.current as any)[key]?.map((row:any)=>[row.id,row]) || []);
        for(const item of items) {if(item.deleted)map.delete(item.id);else if(item.record)map.set(item.record.id,item.record);}
        (patches as any)[key]=mergePendingRecords(table,[...map.values()]);
      }
      applyData(patches);
      // Account balances are owned by the database ledger trigger. Re-read after acknowledgment.
      if((records || []).some((item:any)=>item.table==='church_finances')) {
        const client = getSupabaseClient();
        client?.from('church_accounts').select('*').order('id').then(({data,error})=>{
          if(alive && !error && data && !hasPendingChanges('church_finances')) applyData({churchAccounts:data});
        });
      }
    };
    window.addEventListener('gwcc-sync-records',update);return()=>{alive=false;window.removeEventListener('gwcc-sync-records',update);};
  },[isAuthenticated,currentUser.id,applyData]);

  useEffect(()=>{
    if(!isAuthenticated || dataOwner!==`${currentUser.id}:${currentUser.role}`) return;
    saveToStorage('settings',settings);
    for(const [key,rows] of Object.entries(currentData)) saveToStorage(key,rows);
  },[isAuthenticated,currentUser.id,currentUser.role,dataOwner,settings,members, visitors, services, attendance, headcounts, giving, campaigns, pledges, expenses, churchAccounts, churchFinances, departmentBudgets, ministries, smallGroups, events, pastoralCare, prayerRequests, communications, auditLogs, welfareContributions, welfareClaims, welfareEvents, welfareEventContributions, childCheckIns, assets, rosterAssignments, foundationCohorts, foundationStudents, pastoralVisitations, counselingSessions, intercessorySlots]);

  // Modules previously stored only on one device now use the same durable outbox.
  useEffect(()=>{
    if(!isAuthenticated || dataOwner!==`${currentUser.id}:${currentUser.role}` || currentUser.role==='member')return;
    for(const key of ['assets', 'departmentBudgets', 'rosterAssignments', 'foundationCohorts', 'foundationStudents', 'pastoralVisitations', 'counselingSessions', 'intercessorySlots']) {
      const table=SYNC_TABLES.find(item=>item.key===key)?.table;if(!table)continue;
      const after=(currentData as any)[key] || [];
      if(incomingDocuments.current[key]) {
        if(JSON.stringify(incomingDocuments.current[key])!==JSON.stringify(after))continue;
        documentBaseline.current[key]=after;delete incomingDocuments.current[key];continue;
      }
      const before=new Map((documentBaseline.current[key] || []).map(row=>[row.id,row]));
      for(const row of after) {if(JSON.stringify(before.get(row.id))!==JSON.stringify(row)) void dbSyncUpsert(table,row);before.delete(row.id);}
      for(const id of before.keys()) void dbSyncDelete(table,id);
      documentBaseline.current[key]=after;
    }
  },[isAuthenticated,currentUser.id,currentUser.role,dataOwner,childCheckIns, assets, departmentBudgets, rosterAssignments, foundationCohorts, foundationStudents, pastoralVisitations, counselingSessions, intercessorySlots]);

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
  const generateMemberId = () => `PENDING-${crypto.randomUUID()}`;
  const generateTitheNumber = () => `PENDING-${crypto.randomUUID()}`;

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
  const requireAttendanceAccess = () => {
    if (!isAuthenticated || !canAccess('attendance')) throw new Error('Attendance staff access is required.');
  };
  const createService = (data: Omit<ChurchService, 'id'>): ChurchService =>
    createServiceRecord(data, setServices, logAction, dbSyncUpsert);

  const updateService = (id: string, updates: Partial<ChurchService>) => {
    updateServiceRecord(id, updates, setServices, logAction, dbSyncUpsert, services);
  };

  const deleteService = (id: string) => {
    if ([...attendance, ...headcounts, ...giving, ...rosterAssignments].some(record => record.service_id === id)) {
      throw new Error('This service has history. Deactivate it instead of deleting it.');
    }
    deleteServiceRecord(id, setServices, logAction, dbSyncDelete);
  };

  const recordAttendance = (
    serviceId: string,
    personType: 'member' | 'visitor',
    personId: string,
    method: 'manual' | 'search' | 'qr_code' = 'manual',
    customDate?: string
  ): { success: boolean; message: string } => {
    if (!isAuthenticated || !canAccess('attendance')) return { success: false, message: 'Attendance staff access is required.' };
    return recordAttendanceRecord(
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
  };

  const registerVisitorAndCheckIn = (data: Omit<Visitor, 'id' | 'created_at' | 'updated_at'>, serviceId: string, date: string): Visitor => {
    requireAttendanceAccess();
    if (!canAccess('visitors')) throw new Error('Visitor registration access is required.');
    const validationError = attendanceSessionError(services.find(service => service.id === serviceId), date);
    if (validationError) throw new Error(validationError);
    return withSyncTransaction(() => {
      const visitor = addVisitor(data);
      const result = recordAttendanceRecord(serviceId, 'visitor', visitor.id, members, [visitor, ...visitors], attendance, setAttendance, services, logAction, dbSyncUpsert, 'manual', date);
      if (!result.success) throw new Error(result.message);
      return visitor;
    });
  };

  const batchRecordAttendance = (
    serviceId: string,
    date: string,
    items: Array<{ personType: 'member' | 'visitor'; personId: string; method?: 'manual' | 'search' | 'qr_code' }>
  ): { added: number; skipped: number } => {
    requireAttendanceAccess();
    return withSyncTransaction(() => batchRecordAttendanceRecord(
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
    ));
  };

  const recordHeadcount = (data: Omit<HeadcountRecord, 'id' | 'created_at'>): HeadcountRecord => {
    requireAttendanceAccess();
    const validationError = attendanceSessionError(services.find(service => service.id === data.service_id), data.date);
    if (validationError) throw new Error(validationError);
    return recordHeadcountRecord(data, headcounts, setHeadcounts, logAction, dbSyncUpsert);
  };

  const updateHeadcount = (id: string, updates: Partial<HeadcountRecord>) => {
    requireAttendanceAccess();
    const existing = headcounts.find(record => record.id === id);
    const validationError = attendanceSessionError(services.find(service => service.id === (updates.service_id || existing?.service_id)), updates.date ?? existing?.date ?? '');
    if (validationError) throw new Error(validationError);
    updateHeadcountRecord(id, updates, setHeadcounts, logAction, dbSyncUpsert, headcounts);
  };

  const deleteHeadcount = (id: string) => {
    requireAttendanceAccess();
    deleteHeadcountRecord(id, setHeadcounts, logAction, dbSyncDelete);
  };

  const deleteAttendanceRecord = (id: string) => {
    requireAttendanceAccess();
    const target = attendance.find(row => row.id === id);
    if (!target) return;
    const ids = attendance.filter(row => row.service_id === target.service_id && row.date === target.date && row.status === 'present' &&
      ((target.member_id && row.member_id === target.member_id) || (target.visitor_id && row.visitor_id === target.visitor_id))).map(row => row.id);
    withSyncTransaction(() => ids.forEach(recordId => deleteAttendanceRecordRecord(recordId, setAttendance, logAction, dbSyncDelete)));
  };

  // FINANCE & GIVING
  const recordGiving = (data:Omit<GivingRecord,'id'|'created_at'>):GivingRecord=>withSyncTransaction(()=>{
    if(!isAuthenticated || !canAccess('giving'))throw new Error('Finance staff access is required.');
    if(!Number.isFinite(data.amount)||data.amount<=0)throw new Error('Enter a finite positive amount.');
    const pledge=data.pledge_id?pledgesRef.current.find(row=>row.id===data.pledge_id):null;
    if(data.pledge_id && (!pledge||data.amount>pledge.balance))throw new Error('The amount exceeds the remaining pledge balance.');
    const record=recordGivingRecord(data,members,commitGiving,logAction,dbSyncUpsert);
    if(pledge){
      const amount_paid=pledge.amount_paid+data.amount,balance=pledge.amount_pledged-amount_paid;
      const updated={...pledge,amount_paid,balance,status:(balance===0?'completed':'partially_paid') as PledgeRecord['status'],updated_at:new Date().toISOString()};
      commitPledges(prev=>prev.map(row=>row.id===pledge.id?updated:row));void dbSyncUpsert('pledges',updated);
    }
    return record;
  });

  const updateGiving = (id: string, updates: Partial<GivingRecord>) => {
    updateGivingRecord(id, updates, members, setGiving, logAction, dbSyncUpsert);
  };

  const deleteGiving = (id: string) => {
    voidGivingRecord(id,'Removed by the finance office',`${currentUser.first_name} ${currentUser.last_name}`,setGiving,logAction,dbSyncUpsert);
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
    recordChurchFinanceRecord(data, commitFinances, commitAccounts, commitBudgets, logAction, dbSyncUpsert, financeStateRef.current);

  const updateChurchFinance = (id: string, updates: Partial<ChurchFinanceRecord>) => {
    updateChurchFinanceRecord(id, updates, commitFinances, commitAccounts, commitBudgets, logAction, dbSyncUpsert, financeStateRef.current);
  };

  const deleteChurchFinance = (id: string) => {
    deleteChurchFinanceRecord(id, commitFinances, commitAccounts, commitBudgets, logAction, dbSyncDelete, dbSyncUpsert, financeStateRef.current);
  };

  const voidChurchFinance = (id: string, reason: string) => {
    const userSignature = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Finance Secretariat';
    voidChurchFinanceRecord(id, reason, userSignature, commitFinances, commitAccounts, commitBudgets, logAction, dbSyncUpsert, financeStateRef.current);
  };

  const transferBetweenAccounts = (fromAccountId: string, toAccountId: string, amount: number, notes?: string) =>
    transferBetweenAccountsRecord(fromAccountId, toAccountId, amount, notes, commitAccounts, commitFinances, logAction, dbSyncUpsert, financeStateRef.current);

  const addDepartmentBudget = (data: Omit<DepartmentBudget, 'id' | 'created_at' | 'updated_at'>): DepartmentBudget =>
    addDepartmentBudgetRecord(data, setDepartmentBudgets, logAction);

  const updateDepartmentBudget = (id: string, updates: Partial<DepartmentBudget>) => {
    updateDepartmentBudgetRecord(id, updates, setDepartmentBudgets, logAction);
  };

  const resetChurchFinanceData = (_mode: 'reset_balances' | 'wipe_all' = 'reset_balances') => ({
    success:false,message:'Financial history is preserved. Void incorrect receipts or record an adjustment instead of clearing balances.'
  });

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
  ): PledgeRecord => createPledgeRecord(data, members, commitPledges, logAction, dbSyncUpsert);

  const updatePledge = (id: string, updates: Partial<PledgeRecord>) => {
    updatePledgeRecord(id, updates, commitPledges, logAction, dbSyncUpsert);
  };

  const deletePledge = (id: string) => {
    deletePledgeRecord(id, pledgesRef.current, commitPledges, logAction, dbSyncDelete);
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
    withSyncTransaction(()=>recordPledgePaymentRecord(
      pledgeId,
      amount,
      pledgesRef.current,
      commitPledges,
      logAction,
      dbSyncUpsert,
      (data) => recordGiving(data),
      paymentDetails
    ));
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
  const saveCommunicationDraft = (data:DraftInput):Promise<CommunicationRecord> => {
    if(!canAccess('communication'))throw new Error('Your account cannot manage communication drafts.');
    return saveCommunicationDraftRecord({...data,created_by:currentUser.id},currentDataRef.current.communications,setCommunications,logAction,dbSyncUpsert);
  };
  const archiveCommunicationDraft = (id:string,archived:boolean):Promise<CommunicationRecord> => {
    if(!canAccess('communication'))throw new Error('Your account cannot manage communication drafts.');
    return archiveCommunicationDraftRecord(id,archived,currentDataRef.current.communications,setCommunications,logAction,dbSyncUpsert);
  };

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
    if(welfareClaims.some(row=>row.id===id && (row.amount_disbursed||0)>0))throw new Error('A claim with payout history cannot be deleted.');
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
    const claim=welfareClaims.find(row=>row.id===id);
    if(!claim || !['approved','disbursed'].includes(claim.status))throw new Error('Approve the claim before recording a payment.');
    const amount=details.amount_paid??details.amount_approved;
    const remaining=(claim.amount_approved||0)-(claim.amount_disbursed||0);
    if(!Number.isFinite(amount)||amount<=0||amount>remaining)throw new Error('Enter a payment within the remaining approved amount.');
    if(!details.finance_account_id)throw new Error('Select a church holding account for the payout.');
    const actor=`${currentUser.first_name} ${currentUser.last_name}`;
    withSyncTransaction(()=>{
    const receipt=recordChurchFinance({transaction_type:'disbursement',account_id:details.finance_account_id,account_name:details.finance_account_name||'Welfare Account',
      category:'Benevolence & Welfare',title:`Welfare Grant: ${claim.member_name}`,recipient_or_vendor:claim.member_name,amount,currency:'GHS',date:new Date().toISOString().slice(0,10),
      payment_method:details.disbursement_method,reference_no:details.disbursement_voucher_no,department:'Welfare & Benevolence',recorded_by:actor,status:'completed'});
    disburseWelfareClaimRecord(id,{...details,recorded_by:actor,finance_transaction_id:receipt.id},setWelfareClaims,logAction,dbSyncUpsert,welfareClaims);
    });
  };

  // WELFARE CONTRIBUTION EVENTS
  const createWelfareEvent = (
    data: Omit<WelfareEvent, 'id' | 'created_at' | 'updated_at'>
  ): WelfareEvent =>
    createWelfareEventRecord(data, setWelfareEvents, logAction, dbSyncUpsert);

  const updateWelfareEvent = (id: string, updates: Partial<WelfareEvent>): WelfareEvent | undefined =>
    updateWelfareEventRecord(id, updates, setWelfareEvents, logAction, dbSyncUpsert);

  const closeWelfareEvent = (id: string): WelfareEvent | undefined =>
    closeWelfareEventRecord(
      id,
      `${currentUser.first_name} ${currentUser.last_name}`,
      setWelfareEvents,
      logAction,
      dbSyncUpsert
    );

  const deleteWelfareEvent = (id: string, force?: boolean): { success: boolean; message: string } =>
    deleteWelfareEventRecord(
      id,
      welfareEvents,
      welfareEventContributions,
      setWelfareEvents,
      logAction,
      dbSyncDelete,
      force,
      setWelfareEventContributions
    );

  const clearAllWelfareEvents = () => ({success:false,message:'Receipt history is preserved. Close or cancel welfare events instead of clearing them.'});

  const recordEventContribution = (
    data: Omit<WelfareEventContribution, 'id' | 'created_at' | 'updated_at'>,
    options?: {
      forceDuplicateConfirmation?: boolean;
      linkToChurchFinance?: boolean;
      financeAccountId?: string;
      financeAccountName?: string;
    }
  ) => withSyncTransaction(()=>
    recordEventContributionRecord(
      data,
      welfareEvents,
      welfareEventContributions,
      setWelfareEventContributions,
      logAction,
      dbSyncUpsert,
      {
        ...options,
        setChurchFinances:commitFinances,
        setChurchAccounts:commitAccounts,
        state:financeStateRef.current,
      }
    ));

  const updateEventContribution = (id: string, updates: Partial<WelfareEventContribution>) => {
    withSyncTransaction(()=>updateEventContributionRecord(
      id,
      updates,
      `${currentUser.first_name} ${currentUser.last_name}`,
      setWelfareEventContributions,
      logAction,
      dbSyncUpsert,
      {contributions:welfareEventContributions,events:welfareEvents,state:financeStateRef.current,setChurchFinances:commitFinances,setChurchAccounts:commitAccounts}
    ));
  };

  const deleteEventContribution = (id: string) => {
    withSyncTransaction(()=>deleteEventContributionRecord(
      id,
      welfareEventContributions,
      `${currentUser.first_name} ${currentUser.last_name}`,
      setWelfareEventContributions,
      logAction,
      dbSyncDelete,
      {contributions:welfareEventContributions,events:welfareEvents,state:financeStateRef.current,setChurchFinances:commitFinances,setChurchAccounts:commitAccounts},
      dbSyncUpsert
    ));
  };

  // CHILDREN'S MINISTRY SAFETY & PICKUP TAGS
  const checkInChild = async (
    data: Omit<ChildCheckInRecord, 'id' | 'security_code' | 'created_at' | 'status'> & { security_code?: string }
  ): Promise<ChildCheckInRecord> => {
    if(!isAuthenticated || !canAccess('attendance'))throw new Error('Attendance staff access is required.');
    const newRecord:ChildCheckInRecord={...data,id:crypto.randomUUID(),security_code:createPickupToken(childCheckIns),
      checked_in_by:currentUser.id,status:'checked_in',created_at:new Date().toISOString()};
    await dbSyncUpsert('child_check_ins',newRecord);
    const result=await flushSyncOutbox();
    if(!result.success)throw new Error(result.error||'Check-in is pending. Refresh after synchronization before printing a tag.');
    setChildCheckIns(prev=>[newRecord,...prev.filter(row=>row.id!==newRecord.id)]);
    return newRecord;
  };
  const checkOutChild = async (id:string,details:{checked_out_to_person:string;verified_by_leader:string}) => {
    if(!isAuthenticated || !canAccess('attendance'))throw new Error('Attendance staff access is required.');
    const current=childCheckIns.find(row=>row.id===id);
    if(!current)throw new Error('Refresh check-in records before releasing this child.');
    findPickup(childCheckIns,current.security_code,details.checked_out_to_person);
    const updated={...current,status:'checked_out' as const,checked_out_to_person:details.checked_out_to_person.trim(),
      verified_by_leader:currentUser.id,check_out_time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})};
    await dbSyncUpsert('child_check_ins',updated);
    const result=await flushSyncOutbox();
    if(!result.success)throw new Error(result.error||'Pickup has not been confirmed by the server.');
    setChildCheckIns(prev=>prev.map(row=>row.id===id?updated:row));
  };

  const summonChildParent=(id:string,notes?:string)=>{
    const record=childCheckIns.find(row=>row.id===id);if(!record)throw new Error('Check-in not found.');
    const updated={...record,emergency_parent_called:true,emergency_call_notes:notes||'Parent contact requested; staff must call directly.'};
    setChildCheckIns(prev=>prev.map(row=>row.id===id?updated:row));void dbSyncUpsert('child_check_ins',updated);
  };

  const deleteChildCheckIn = (_id: string) => { throw new Error('Child check-in history is preserved.'); };

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
    return created;
  };

  const updateRosterAssignment = (
    id: string,
    updates: Partial<RosterAssignment>,
    fallbackAssignment?: RosterAssignment
  ) => {
    updateRosterAssignmentRecord(id, updates, setRosterAssignments, logAction, fallbackAssignment);
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
    throw new Error('Sample-data reset is disabled for operational accounts.');
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
      registerVisitorAndCheckIn,
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
      saveCommunicationDraft,
      archiveCommunicationDraft,
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
      welfareEvents,
      createWelfareEvent,
      updateWelfareEvent,
      closeWelfareEvent,
      deleteWelfareEvent,
      clearAllWelfareEvents,
      welfareEventContributions,
      recordEventContribution,
      updateEventContribution,
      deleteEventContribution,
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
      welfareEvents,
      welfareEventContributions,
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
      headcounts,
      currentUser.id,
      currentUser.role,
      isAuthenticated,
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
