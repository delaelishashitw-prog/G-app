import {writeFinance as writeFinancePlan, type FinanceStage} from '../features/finance/durableFinance';
import {planAccountChange,planBudgetChange} from '../lib/ledgerUtils';
import {sanitizeRecordForSupabase} from '../lib/supabase';
import { saveAsset as saveAssetRecord, removeAsset as removeAssetRecord, saveMaintenance, graduateStudent, type OperationWriter } from '../features/operations/durableOperations';
import {validateCellReport,type CellMeetingReport} from '../lib/cellReports';
import { validateWelfareFundReceipt, WELFARE_FUND_READ_ROLES, WELFARE_FUND_WRITE_ROLES, WELFARE_FUND_VOID_ROLES, type WelfareFundInput } from '../features/welfare/welfareFund';
import { withSyncTransaction, hasPendingChanges } from '../lib/supabase';
import { saveChildCheckIn, saveChildCheckout, type ChildInput } from '../features/attendance/childCheckInStore';
import { pendingSyncRecords } from '../lib/supabase';
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
  WelfareFundReceipt,
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
  dbSyncUpsertBatch,
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
  voidGiving as voidGivingRecord,
  recordExpense as recordExpenseRecord,
  recordGiving as recordGivingRecord,
  updateExpense as updateExpenseRecord,
  updateGiving as updateGivingRecord,
  addChurchAccount as addChurchAccountRecord,
  updateChurchAccount as updateChurchAccountRecord,
  recordChurchFinance as recordChurchFinanceRecord,
  updateChurchFinance as updateChurchFinanceRecord,
  voidChurchFinance as voidChurchFinanceRecord,
  transferBetweenAccounts as transferBetweenAccountsRecord,
  addDepartmentBudget as addDepartmentBudgetRecord,
  updateDepartmentBudget as updateDepartmentBudgetRecord,
} from '../features/finance/financeStore';
import { PLEDGE_WRITE_ROLES, buildPledgePayment, requireConfirmedPledge, validateCampaign, validatePledge, type PledgeInput, type PledgePaymentInput, type PledgePaymentResult } from '../features/pledges/pledgeStore';
import { preserveEvent, requireConfirmedEvent } from '../features/events/eventStore';
import { canEditMembers, canArchiveMembers, foundationEnrollmentId } from '../features/members/memberRules';
import {pendingSyncDelete,pendingSyncRecord,pendingMemberRecord,preservePendingSync,sanitizeMemberForSupabase} from '../lib/supabase';
import { memberForRole } from '../lib/memberPrivacy';
import { EVENT_WRITE_ROLES } from '../features/events/eventRules';
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
  addRosterAssignment as addRosterAssignmentRecord,
  batchAddOrUpdateRosterAssignments as batchAddOrUpdateRosterAssignmentsRecord,
  buildRosterConflicts as buildRosterConflictsRecord,
  createFoundationCohort as createFoundationCohortRecord,
  deleteRosterAssignment as deleteRosterAssignmentRecord,
  enrollMemberInFoundationSchool as enrollMemberInFoundationSchoolRecord,
  toggleFoundationModule as toggleFoundationModuleRecord,
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
  addMember: (member: Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'>, requestId?:string) => Promise<Member>;
  updateMember: (id: string, updates: Partial<Member>, expectedVersion?: string) => Promise<Member>;
  bulkUpdateMembers: (memberIds: string[], updates: Partial<Member>) => Promise<Member[]>;
  archiveMember: (id: string, expectedVersion?: string) => Promise<Member>;
  unarchiveMember: (id: string, expectedVersion?: string) => Promise<Member>;
  getMember: (id: string) => Member | undefined;

  // Visitors
  visitors: Visitor[];
  addVisitor: (visitor: Omit<Visitor, 'id' | 'created_at' | 'updated_at'>) => Visitor;
  updateVisitor: (id: string, updates: Partial<Visitor>) => void;
  deleteVisitor: (id: string) => void;
  convertVisitorToMember: (visitorId: string) => Promise<Member | undefined>;

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
  recordGiving: (record: Omit<GivingRecord, 'id' | 'created_at'>,requestId?:string) => Promise<GivingRecord>;
  recordGivingBatch: (records:Array<Omit<GivingRecord,'id'|'created_at'>&{id:string}>)=>Promise<GivingRecord[]>;
  updateGiving: (id: string, updates: Partial<GivingRecord>) => Promise<void>;
  deleteGiving: (id: string) => Promise<void>;
  voidGiving: (id: string, reason: string) => Promise<void>;
  expenses: ExpenseRecord[];
  recordExpense: (record: Omit<ExpenseRecord, 'id' | 'created_at'>) => ExpenseRecord;
  updateExpense: (id: string, updates: Partial<ExpenseRecord>) => void;
  deleteExpense: (id: string) => void;

  // Dedicated Church Finance & Accounts
  churchAccounts: ChurchAccount[];
  addChurchAccount: (account: Omit<ChurchAccount, 'id' | 'created_at' | 'updated_at'>,requestId?:string) => Promise<ChurchAccount>;
  updateChurchAccount: (id: string, updates: Partial<ChurchAccount>) => Promise<void>;
  deleteChurchAccount: (id: string) => Promise<void>;
  churchFinances: ChurchFinanceRecord[];
  recordChurchFinance: (record: Omit<ChurchFinanceRecord, 'id' | 'created_at' | 'updated_at'>,requestId?:string) => Promise<ChurchFinanceRecord>;
  updateChurchFinance: (id: string, updates: Partial<ChurchFinanceRecord>) => Promise<void>;
  deleteChurchFinance: (id: string) => Promise<void>;
  voidChurchFinance: (id: string, reason: string) => Promise<void>;
  transferBetweenAccounts: (fromAccountId: string, toAccountId: string, amount: number, notes?: string,requestId?:string) => Promise<{ success: boolean; message: string }>;
  departmentBudgets: DepartmentBudget[];
  updateDepartmentBudget: (id: string, updates: Partial<DepartmentBudget>) => void;
  addDepartmentBudget: (budget: Omit<DepartmentBudget, 'id' | 'created_at' | 'updated_at'>) => DepartmentBudget;
  resetChurchFinanceData: (mode?: 'reset_balances' | 'wipe_all') => { success: boolean; message: string };

  // Pledges
  campaigns: PledgeCampaign[];
  addCampaign: (campaign: PledgeCampaign) => Promise<PledgeCampaign>;
  updateCampaign: (id: string, updates: Partial<PledgeCampaign>, expectedVersion?: string) => Promise<PledgeCampaign>;
  deleteCampaign: (id: string, expectedVersion?: string) => Promise<void>;
  pledges: PledgeRecord[];
  createPledge: (pledge: PledgeInput, initial?: {amount:number; details:PledgePaymentInput}) => Promise<PledgeRecord>;
  addPledge: (pledge: PledgeInput, initial?: {amount:number; details:PledgePaymentInput}) => Promise<PledgeRecord>;
  updatePledge: (id: string, updates: Partial<PledgeRecord>, expectedVersion?: string) => Promise<PledgeRecord>;
  deletePledge: (id: string, expectedVersion?: string) => Promise<void>;
  recordPledgePayment: (pledgeId: string, amount: number, paymentDetails: PledgePaymentInput) => Promise<PledgePaymentResult>;
  voidPledgePayment: (pledgeId: string, paymentId: string, reason: string, expectedVersion?: string) => Promise<void>;

  // Ministries & Small Groups
  ministries: Ministry[];
  addMinistry: (ministry: Omit<Ministry, 'id' | 'member_count'>) => Ministry;
  updateMinistry: (id: string, updates: Partial<Ministry>) => void;
  deleteMinistry: (id: string) => void;
  assignMemberToMinistry: (memberId: string, ministryId: string, ministryName: string, role?: string) => void;
  removeMemberFromMinistry: (memberId: string) => void;
  smallGroups: SmallGroup[];
  cellMeetingReports: CellMeetingReport[];
  recordCellMeetingReport: (report:CellMeetingReport)=>Promise<void>;
  addSmallGroup: (group: Omit<SmallGroup, 'id' | 'member_count'>) => SmallGroup;

  // Events
  events: ChurchEvent[];
  createEvent: (event: Omit<ChurchEvent, 'id'> & { id: string }) => Promise<ChurchEvent>;
  updateEvent: (id: string, updates: Partial<ChurchEvent>, expectedVersion?: string) => Promise<ChurchEvent>;
  deleteEvent: (id: string) => Promise<void>;
  addEventAttendee: (
    eventId: string,
    attendee: { name: string; phone?: string; email?: string; member_id?: string; role?: string }
  ) => Promise<ChurchEvent>;
  removeEventAttendee: (eventId: string, attendeeId: string) => Promise<ChurchEvent>;
  toggleAttendeeCheckIn: (eventId: string, attendeeId: string) => Promise<ChurchEvent>;

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
  welfareFundReceipts: WelfareFundReceipt[];
  recordWelfareFundReceipt: (record: WelfareFundInput) => Promise<void>;
  voidWelfareFundReceipt: (id: string, reason: string) => Promise<void>;
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
    record: ChildInput, requestId?: string
  ) => Promise<ChildCheckInRecord>;
  checkOutChild: (
    id: string,
    details: { checked_out_to_person: string; verified_by_leader: string }
  ) => Promise<void>;
  summonChildParent: (id: string, notes?: string) => void;
  deleteChildCheckIn: (id: string) => void;

  // Church Assets & Equipment Inventory
  assets: ChurchAsset[];
  addAsset: (asset: Omit<ChurchAsset, 'id' | 'created_at'>, requestId: string) => Promise<ChurchAsset>;
  updateAsset: (id: string, updates: Partial<ChurchAsset>, expectedVersion?:string) => Promise<ChurchAsset>;
  deleteAsset: (id: string) => Promise<void>;
  addAssetMaintenanceLog: (assetId: string, log: Omit<AssetMaintenanceLog, 'id'>, requestId: string, expectedVersion?:string) => Promise<ChurchAsset>;

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
  bulkEnrollMembersInFoundationSchool: (cohortId:string,memberIds:string[]) => Promise<number>;
  updateFoundationStudent: (id: string, updates: Partial<FoundationStudent>) => void;
  toggleFoundationModule: (studentId: string, moduleNumber: number) => void;
  graduateFoundationStudent: (studentId: string, certificateNo?: string) => Promise<FoundationStudent>;

  // Supabase Integration State & Actions
  isSupabaseConfigured: boolean;
  supabaseStatus: SupabaseStatus;
  supabaseError: string | null;
  lastSyncTime: string | null;
  supabaseConfig: { url: string; anonKey: string; source: 'env' | 'storage' | 'default' | 'none' };
  connectSupabase: (url: string, key: string) => Promise<{ success: boolean; message: string; tablesStatus?: 'ready' | 'tables_missing' }>;
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
  const fundIdentity = `${isAuthenticated}:${currentUser.id}:${currentUser.role}`;
  const fundIdentityRef = React.useRef(fundIdentity); fundIdentityRef.current = fundIdentity;
  const eventSavesInFlight = React.useRef(new Set<string>());
  const pledgeSavesInFlight = React.useRef(new Set<string>());
  const fundSavesInFlight = React.useRef(new Set<string>());
  const childSavesInFlight = React.useRef(new Set<string>());
  const financeSaveInFlight=React.useRef(new Set<string>());
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
  const [cellMeetingReports,setCellMeetingReports]=useState<CellMeetingReport[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [pastoralCare, setPastoralCare] = useState<PastoralCareRecord[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [communications, setCommunications] = useState<CommunicationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [welfareContributions, setWelfareContributions] = useState<WelfareContribution[]>([]);
  const [welfareFundReceipts, setWelfareFundReceipts] = useState<WelfareFundReceipt[]>([]);

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
  const membersRef=React.useRef(members);membersRef.current=members;
  const commitMembers:React.Dispatch<React.SetStateAction<Member[]>>=action=>{const next=(typeof action==='function'?action(membersRef.current):action).map(row=>memberForRole(row,currentUser.role));membersRef.current=next;setMembers(next);};
  const memberIdentity=`${isAuthenticated}:${currentUser.id}:${currentUser.role}`;
  const memberIdentityRef=React.useRef(memberIdentity);memberIdentityRef.current=memberIdentity;
  const memberWrites=React.useRef(new Set<string>());
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
    members: commitMembers,
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
    cellMeetingReports:setCellMeetingReports,
    events: setEvents,
    pastoralCare: setPastoralCare,
    prayerRequests: setPrayerRequests,
    communications: setCommunications,
    auditLogs: setAuditLogs,
    welfareContributions: setWelfareContributions,
    welfareFundReceipts: setWelfareFundReceipts,
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
  const currentData = { members, visitors, services, attendance, headcounts, giving, campaigns, pledges, expenses, churchAccounts, churchFinances, departmentBudgets, ministries, smallGroups, cellMeetingReports, events, pastoralCare, prayerRequests, communications, auditLogs, welfareContributions, welfareFundReceipts, welfareClaims, welfareEvents, welfareEventContributions, childCheckIns, assets, rosterAssignments, foundationCohorts, foundationStudents, pastoralVisitations, counselingSessions, intercessorySlots };
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
      if(!isSupabaseConfigured()) {
        setSupabaseStatus('disconnected');
        return {success:true,source:'local',message:'Local mode active. Connect Supabase in Settings to sync across devices.'};
      }
      await flushSyncOutbox();
      const result=await pullAllDataFromSupabase();
      applyData(result.data);
      if(!result.success) {setSupabaseStatus('error');setSupabaseError(result.errors.join('; '));return {success:false,source:'supabase',message:result.errors.join('; ')};}
      const now=new Date();setLastRefreshedAt(now);setLastSyncTime(now.toISOString());setSupabaseStatus('connected');setSupabaseError(null);
      window.dispatchEvent(new Event('gwcc-refresh-follow-ups'));
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
      if(currentUser.role==='member' && table==='events'){local.events=[];continue;}
      if(table==='cell_meeting_reports'&&!['super_admin','senior_pastor','administrator','pastor'].includes(currentUser.role)){local.cellMeetingReports=[];continue;}
      if(table==='welfare_fund_receipts'&&!WELFARE_FUND_READ_ROLES.includes(currentUser.role)){local.welfareFundReceipts=[];continue;}
      (local as any)[key]=table==='communications'&&!canAccess('communication')?[]:mergePendingRecords(table,loadFromStorage(key,[]));
    }
    applyData(local);setDataOwner(`${currentUser.id}:${currentUser.role}`);
    let alive=true;
    const hydrate=async()=>{
      if(!isSupabaseConfigured()){setSupabaseStatus('disconnected');return;}
      setSupabaseStatus('syncing');await flushSyncOutbox();
      if(!alive)return;
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
  },[isAuthenticated,currentUser.id,currentUser.role,dataOwner,settings,members, visitors, services, attendance, headcounts, giving, campaigns, pledges, expenses, churchAccounts, churchFinances, departmentBudgets, ministries, smallGroups, cellMeetingReports, events, pastoralCare, prayerRequests, communications, auditLogs, welfareContributions, welfareFundReceipts, welfareClaims, welfareEvents, welfareEventContributions, childCheckIns, assets, rosterAssignments, foundationCohorts, foundationStudents, pastoralVisitations, counselingSessions, intercessorySlots]);

  // Modules previously stored only on one device now use the same durable outbox.
  useEffect(()=>{
    if(!isAuthenticated || dataOwner!==`${currentUser.id}:${currentUser.role}` || currentUser.role==='member')return;
    for(const key of ['departmentBudgets', 'rosterAssignments', 'foundationCohorts', 'foundationStudents', 'pastoralVisitations', 'counselingSessions', 'intercessorySlots']) {
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

  // MEMBER OPERATIONS
  const memberWriter = () => ({members:membersRef.current,setMembers:commitMembers,persist:dbSyncUpsertBatch,
    pending:pendingMemberRecord,retryPending:preservePendingSync,normalize:(row:Member)=>sanitizeMemberForSupabase(memberForRole(row,currentUser.role)),
    isCurrent:()=>memberIdentityRef.current===memberIdentity,log:logAction});
  const writeMembers = async <T,>(ids:string[],archive:boolean,work:()=>Promise<T>):Promise<T> => {
    if(!isAuthenticated || !canEditMembers(currentUser.role) || (archive && !canArchiveMembers(currentUser.role)))
      throw new Error(archive?'Member archive authorization is required.':'Member editing authorization is required.');
    const locks=[...new Set(ids)].map(id=>`${memberIdentity}:${id}`);
    if(locks.some(key=>memberWrites.current.has(key)))throw new Error('A selected member is already being saved.');
    locks.forEach(key=>memberWrites.current.add(key));
    try{return await work();}finally{locks.forEach(key=>memberWrites.current.delete(key));}
  };
  const addMember = (data: Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'>,requestId?:string) =>
    writeMembers(['new'],false,()=>addMemberRecord({...data,is_archived:false,auth_user_id:undefined},memberWriter(),requestId));
  const updateMember = (id:string,updates:Partial<Member>,expectedVersion?:string) => {
    const previous=membersRef.current.find(row=>row.id===id);
    const archiveChange=updates.is_archived!==undefined && Boolean(updates.is_archived)!==Boolean(previous?.is_archived);
    return writeMembers([id],archiveChange,()=>updateMemberRecord(id,updates,memberWriter(),expectedVersion));
  };
  const bulkUpdateMembers = (ids:string[],updates:Partial<Member>) =>
    writeMembers(ids,updates.is_archived!==undefined,()=>bulkUpdateMembersRecord(ids,updates,memberWriter()));
  const archiveMember = (id:string,version?:string) =>
    writeMembers([id],true,()=>archiveMemberRecord(id,memberWriter(),version));
  const unarchiveMember = (id:string,version?:string) =>
    writeMembers([id],true,()=>unarchiveMemberRecord(id,memberWriter(),version));

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

  const convertVisitorToMember = async (visitorId: string): Promise<Member | undefined> => {
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

    const newMember = await addMember(newMemberData,`visitor-${visitor.id}`);

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

  // Stage financial changes separately until device admission has committed.
  const persistFinance=async<T,>(module:'giving'|'finance',plan:(stage:FinanceStage)=>T):Promise<T>=>{
    if(!isAuthenticated || !canAccess(module))throw new Error('Finance staff access is required.');
    const identity=memberIdentity;
    if(financeSaveInFlight.current.has(identity))throw new Error('Another financial entry is being preserved. Try again in a moment.');
    financeSaveInFlight.current.add(identity);
    try{return await writeFinancePlan(givingRef.current,financeStateRef.current,plan,{
      persist:dbSyncUpsertBatch,retry:preservePendingSync,pending:pendingSyncRecord,normalize:sanitizeRecordForSupabase,
      current:()=>memberIdentityRef.current===identity,log:logAction,
      apply:changes=>{
        for(const {table,record} of changes){
          if(table==='giving')commitGiving(previous=>[record as GivingRecord,...previous.filter(row=>row.id!==record.id)]);
          if(table==='church_accounts')commitAccounts(previous=>[record as ChurchAccount,...previous.filter(row=>row.id!==record.id)]);
          if(table==='church_finances'){
            const previous=financeStateRef.current.finances.find(row=>row.id===record.id),next=record as ChurchFinanceRecord;
            const accounts=planAccountChange(financeStateRef.current.accounts,previous,next);
            const budgets=planBudgetChange(financeStateRef.current.budgets,previous,next);
            commitAccounts(accounts);commitBudgets(budgets);
            commitFinances(rows=>[next,...rows.filter(row=>row.id!==next.id)]);
          }
        }
      },
    });}finally{financeSaveInFlight.current.delete(identity);}
  };
  const recordGiving = (data:Omit<GivingRecord,'id'|'created_at'>,requestId:string=crypto.randomUUID()):Promise<GivingRecord>=>persistFinance('giving',stage=>{
    if(!Number.isFinite(data.amount)||data.amount<=0)throw new Error('Enter a finite positive amount.');
    if(data.pledge_id)throw new Error('Record linked payments through the pledge payment form.');
    return recordGivingRecord(data,members,stage.setGiving,stage.log,stage.sync,requestId);
  });
  const recordGivingBatch=(records:Array<Omit<GivingRecord,'id'|'created_at'>&{id:string}>):Promise<GivingRecord[]>=>persistFinance('giving',stage=>records.map(({id,...data})=>{
    if(data.pledge_id || !Number.isFinite(data.amount) || data.amount<=0)throw new Error('Batch entries require positive giving amounts without a pledge link.');
    return recordGivingRecord(data,members,stage.setGiving,stage.log,stage.sync,id);
  }));
  const updateGiving = (id:string,updates:Partial<GivingRecord>)=>persistFinance('giving',stage=>{
    if(givingRef.current.find(row=>row.id===id)?.pledge_id)throw new Error('Correct this payment from its pledge payment history.');
    updateGivingRecord(id,updates,members,stage.setGiving,stage.log,stage.sync);
  });
  const voidGiving = (id:string,reason:string)=>persistFinance('giving',stage=>{
    if(!reason.trim())throw new Error('Enter a reason for voiding this giving receipt.');
    if(givingRef.current.find(row=>row.id===id)?.pledge_id)throw new Error('Void this payment from its pledge payment history.');
    voidGivingRecord(id,reason,`${currentUser.first_name} ${currentUser.last_name}`,stage.setGiving,stage.log,stage.sync);
  });
  const deleteGiving=(id:string)=>voidGiving(id,'Removed by the finance office');

  const recordExpense = (data: Omit<ExpenseRecord, 'id' | 'created_at'>): ExpenseRecord =>
    recordExpenseRecord(data, setExpenses, logAction, dbSyncUpsert);

  const updateExpense = (id: string, updates: Partial<ExpenseRecord>) => {
    updateExpenseRecord(id, updates, setExpenses, logAction, dbSyncUpsert);
  };

  const deleteExpense = (id: string) => {
    deleteExpenseRecord(id, setExpenses, logAction, dbSyncDelete);
  };

  // DEDICATED CHURCH ACCOUNTS & FINANCES
  const addChurchAccount = (data:Omit<ChurchAccount,'id'|'created_at'|'updated_at'>,requestId:string=crypto.randomUUID()):Promise<ChurchAccount>=>
    persistFinance('finance',stage=>addChurchAccountRecord(data,stage.setAccounts,stage.log,stage.sync,requestId));
  const updateChurchAccount=(id:string,updates:Partial<ChurchAccount>)=>
    persistFinance('finance',stage=>updateChurchAccountRecord(id,updates,stage.setAccounts,stage.log,stage.sync));
  const deleteChurchAccount = async(id:string) => {
    if(!isAuthenticated || !canAccess('finance'))throw new Error('Finance staff access is required.');
    const identity=memberIdentity;
    const result=await dbSyncDelete('church_accounts',id);
    if(!result.durable)throw new Error(result.error||'The account deletion could not be preserved. Keep this page open and retry.');
    if(memberIdentityRef.current!==identity)throw new Error('The signed-in account changed.');
    commitAccounts(rows=>rows.filter(row=>row.id!==id));
    logAction('DELETE_CHURCH_ACCOUNT','Church Finance','Queued account deletion',id);
  };
  const recordChurchFinance=(data:Omit<ChurchFinanceRecord,'id'|'created_at'|'updated_at'>,requestId:string=crypto.randomUUID()):Promise<ChurchFinanceRecord>=>
    persistFinance('finance',stage=>recordChurchFinanceRecord(data,stage.setFinances,stage.setAccounts,stage.setBudgets,stage.log,stage.sync,stage.state,requestId));
  const updateChurchFinance=(id:string,updates:Partial<ChurchFinanceRecord>)=>
    persistFinance('finance',stage=>updateChurchFinanceRecord(id,updates,stage.setFinances,stage.setAccounts,stage.setBudgets,stage.log,stage.sync,stage.state));
  const voidChurchFinance=(id:string,reason:string)=>
    persistFinance('finance',stage=>voidChurchFinanceRecord(id,reason,`${currentUser.first_name} ${currentUser.last_name}`,stage.setFinances,stage.setAccounts,stage.setBudgets,stage.log,stage.sync,stage.state));
  const deleteChurchFinance=(id:string)=>voidChurchFinance(id,'Removed by the finance office');
  const transferBetweenAccounts=(fromId:string,toId:string,amount:number,notes?:string,requestId?:string)=>
    persistFinance('finance',stage=>transferBetweenAccountsRecord(fromId,toId,amount,notes,stage.setAccounts,stage.setFinances,stage.log,stage.sync,stage.state,requestId));

  const addDepartmentBudget = (data: Omit<DepartmentBudget, 'id' | 'created_at' | 'updated_at'>): DepartmentBudget =>
    addDepartmentBudgetRecord(data, setDepartmentBudgets, logAction);

  const updateDepartmentBudget = (id: string, updates: Partial<DepartmentBudget>) => {
    updateDepartmentBudgetRecord(id, updates, setDepartmentBudgets, logAction);
  };

  const resetChurchFinanceData = (_mode: 'reset_balances' | 'wipe_all' = 'reset_balances') => ({
    success:false,message:'Financial history is preserved. Void incorrect receipts or record an adjustment instead of clearing balances.'
  });

  // Pledge writes enter durable storage as one versioned, owner-scoped batch.
  const preservePledgeBatch = async (
    key: string,
    records: Array<{ table: string; record: unknown }>,
    apply: () => void,
  ) => {
    if (!isAuthenticated || !PLEDGE_WRITE_ROLES.includes(currentUser.role))
      throw new Error("Finance staff access is required.");
    const identity = fundIdentity,
      lock = `${identity}:${key}`;
    if (pledgeSavesInFlight.current.has(lock))
      throw new Error("This record is already being saved.");
    pledgeSavesInFlight.current.add(lock);
    try {
      const result = await dbSyncUpsertBatch(records);
      if (!result.durable)
        throw new Error(
          result.error ||
            "This device could not preserve the change. Keep the form open and retry.",
        );
      if (fundIdentityRef.current !== identity)
        throw new Error(
          "The signed-in account changed. This change remains with its original account.",
        );
      apply();
    } finally {
      pledgeSavesInFlight.current.delete(lock);
    }
  };
  const saveCampaign = async (
    row: PledgeCampaign,
    previous?: PledgeCampaign,
  ) => {
    validateCampaign(row);
    const pending = { ...row, _sync_status: "pending" as const };
    await preservePledgeBatch(
      `campaign:${row.id}`,
      [
        {
          table: "pledge_campaigns",
          record: { ...row, _expected_updated_at: previous?.updated_at },
        },
      ],
      () => {
        const rows = [
          pending,
          ...currentDataRef.current.campaigns.filter(
            (item) => item.id !== row.id,
          ),
        ];
        currentDataRef.current.campaigns = rows;
        setCampaigns(rows);
      },
    );
    return pending;
  };
  const addCampaign = async (data: PledgeCampaign) => {
    if (currentDataRef.current.campaigns.some((row) => row.id === data.id))
      throw new Error("This campaign is already saved. Check pending changes.");
    return saveCampaign({ ...data, created_at: new Date().toISOString() });
  };
  const updateCampaign = async (
    id: string,
    updates: Partial<PledgeCampaign>,
    expectedVersion?: string,
  ) => {
    const row = requireConfirmedPledge(
      currentDataRef.current.campaigns.find((item) => item.id === id),
      expectedVersion,
    );
    return saveCampaign(
      { ...row, ...updates, id, updated_at: row.updated_at },
      row,
    );
  };
  const deletePledgeRecord = async (
    table: "pledges" | "pledge_campaigns",
    id: string,
    version: string,
  ) => {
    if (!isAuthenticated || !PLEDGE_WRITE_ROLES.includes(currentUser.role))
      throw new Error("Finance staff access is required.");
    const identity = fundIdentity,
      result = await dbSyncDelete(table, id, version);
    if (!result.durable)
      throw new Error(
        result.error || "This device could not preserve the change.",
      );
    if (fundIdentityRef.current !== identity)
      throw new Error("The signed-in account changed.");
  };
  const deleteCampaign = async (id: string, expectedVersion?: string) => {
    const row = requireConfirmedPledge(
      currentDataRef.current.campaigns.find((item) => item.id === id),
      expectedVersion,
    );
    if (pledgesRef.current.some((item) => item.campaign_id === id))
      throw new Error(
        "This campaign has pledges. Turn off its Active status to archive it.",
      );
    await deletePledgeRecord("pledge_campaigns", id, row.updated_at!);
    const rows = currentDataRef.current.campaigns.filter(
      (item) => item.id !== id,
    );
    currentDataRef.current.campaigns = rows;
    setCampaigns(rows);
  };
  const savePledge = async (
    row: PledgeRecord,
    previous?: PledgeRecord,
    gift?: GivingRecord,
  ) => {
    validatePledge(row);
    const pending = { ...row, _sync_status: "pending" as const };
    const records: Array<{ table: string; record: unknown }> = [
      {
        table: "pledges",
        record: { ...row, _expected_updated_at: previous?.updated_at },
      },
    ];
    if (gift) records.push({ table: "giving", record: gift });
    await preservePledgeBatch(`pledge:${row.id}`, records, () => {
      commitPledges((prev) => [
        pending,
        ...prev.filter((item) => item.id !== row.id),
      ]);
      // Linked Giving appears after the server confirms both parts of the payment.
    });
    return pending;
  };
  const createPledge = async (
    data: PledgeInput,
    initial?: { amount: number; details: PledgePaymentInput },
  ) => {
    if (pledgesRef.current.some((row) => row.id === data.id))
      throw new Error("This pledge is already saved. Check pending changes.");
    const person = currentDataRef.current.members.find(
      (row) => row.id === data.member_id,
    );
    const campaign = currentDataRef.current.campaigns.find(
      (row) => row.id === data.campaign_id,
    );
    if (
      !person ||
      person.is_archived ||
      ["deceased", "transferred"].includes(person.status)
    )
      throw new Error("Select an active saved member.");
    if (!campaign?.is_active || campaign._sync_status)
      throw new Error("Select an active campaign confirmed by the cloud.");
    if (data.amount_paid !== 0)
      throw new Error("Record collections as payment receipts.");
    const row: PledgeRecord = {
      ...data,
      member_name: `${person.first_name} ${person.last_name}`.trim(),
      member_phone: person.phone,
      campaign_name: campaign.name,
      amount_paid: 0,
      balance: data.amount_pledged,
      status: "active",
      payments: [],
      created_at: new Date().toISOString(),
    };
    const payment = initial
      ? buildPledgePayment(row, initial.amount, initial.details)
      : undefined;
    return savePledge(payment?.pledge || row, undefined, payment?.giving);
  };
  const updatePledge = async (
    id: string,
    updates: Partial<PledgeRecord>,
    expectedVersion?: string,
  ) => {
    const row = requireConfirmedPledge(
      pledgesRef.current.find((item) => item.id === id),
      expectedVersion,
    );
    if (
      updates.amount_paid !== undefined ||
      updates.payments ||
      updates.legacy_paid_amount !== undefined
    )
      throw new Error("Use payment history to correct collections.");
    return savePledge(
      {
        ...row,
        ...updates,
        id,
        amount_paid: row.amount_paid,
        updated_at: row.updated_at,
      },
      row,
    );
  };
  const deletePledge = async (id: string, expectedVersion?: string) => {
    const row = requireConfirmedPledge(
      pledgesRef.current.find((item) => item.id === id),
      expectedVersion,
    );
    if (row.amount_paid > 0 || row.payments?.length)
      throw new Error("Pledges with payment history cannot be deleted.");
    await deletePledgeRecord("pledges", id, row.updated_at!);
    commitPledges((prev) => prev.filter((item) => item.id !== id));
  };
  const recordPledgePayment = async (
    pledgeId: string,
    amount: number,
    input: PledgePaymentInput,
  ): Promise<PledgePaymentResult> => {
    const existing = pledgesRef.current.find((row) => row.id === pledgeId),
      prior = existing?.payments?.find((row) => row.id === input.id);
    if (prior && existing) {
      if (
        prior.amount !== amount ||
        (prior.date !== input.date && Boolean(input.date)) ||
        prior.payment_method !== (input.method || "cash") ||
        (prior.payment_channel || "") !== (input.channel || "") ||
        (prior.transaction_reference || "") !== (input.reference || "") ||
        (prior.notes || "") !== (input.notes || "") ||
        prior.sync_with_giving !== Boolean(input.syncWithGiving)
      )
        throw new Error(
          "This receipt ID was already used with different payment details.",
        );
      return {
        pledge: existing,
        payment: prior,
        giving: givingRef.current.find((row) => row.id === prior.giving_id),
      };
    }
    const row = requireConfirmedPledge(existing, input.expectedVersion),
      result = buildPledgePayment(row, amount, input);
    result.pledge = await savePledge(result.pledge, row, result.giving);
    return result;
  };
  const voidPledgePayment = async (
    pledgeId: string,
    paymentId: string,
    reason: string,
    expectedVersion?: string,
  ) => {
    const row = requireConfirmedPledge(
        pledgesRef.current.find((item) => item.id === pledgeId),
        expectedVersion,
      ),
      payment = row.payments?.find((item) => item.id === paymentId);
    if (!payment || payment.status !== "completed" || !payment.recorded_at)
      throw new Error("Select a confirmed payment to void.");
    if (reason.trim().length < 5 || reason.trim().length > 1000)
      throw new Error("Enter a void reason in 5–1,000 characters.");
    const record = {
      ...row,
      payments: row.payments!.map((item) =>
        item.id === paymentId
          ? { ...item, status: "voided" as const, void_reason: reason.trim() }
          : item,
      ),
    };
    const records: Array<{ table: string; record: unknown }> = [
      {
        table: "pledges",
        record: { ...record, _expected_updated_at: row.updated_at },
      },
    ];
    if (payment.giving_id) {
      const gift = requireConfirmedPledge(
        givingRef.current.find((item) => item.id === payment.giving_id),
      );
      records.push({
        table: "giving",
        record: {
          ...gift,
          status: "voided",
          void_reason: reason.trim(),
          voided_by: currentUser.id,
          _expected_updated_at: gift.updated_at,
        },
      });
    }
    await preservePledgeBatch(`pledge:${row.id}`, records, () =>
      commitPledges((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...record, _sync_status: "pending" } : item,
        ),
      ),
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

  const recordCellMeetingReport=async(report:CellMeetingReport)=>{
    if(!isAuthenticated||!['super_admin','senior_pastor','administrator','pastor'].includes(currentUser.role))throw new Error('Cell reporting staff access is required.');
    validateCellReport(report);
    if(!currentDataRef.current.smallGroups.some(group=>group.id===report.group_id))throw new Error('Select a saved cell group.');
    if(currentDataRef.current.cellMeetingReports.some(row=>row.id===report.id))return;
    const saved={...report,created_at:new Date().toISOString(),recorded_by_id:currentUser.id,recorded_by:`${currentUser.first_name} ${currentUser.last_name}`};
    const result=await dbSyncUpsert('cell_meeting_reports',saved);
    if(!result.durable)throw new Error(result.error||'This device could not preserve the report. Keep the form open and retry.');
    setCellMeetingReports(prev=>[{...saved,_sync_status:'pending'},...prev.filter(row=>row.id!==saved.id)]);
  };

  const addSmallGroup = (data: Omit<SmallGroup, 'id' | 'member_count'>): SmallGroup =>
    addSmallGroupRecord(data, setSmallGroups, logAction, dbSyncUpsert);

  // EVENTS: one versioned change at a time; never show a change before durable admission.
  const requireEventWriter = () => {
    if (!isAuthenticated || !EVENT_WRITE_ROLES.includes(currentUser.role)) throw new Error('Event management access is required.');
  };
  const saveEvent = async (record: ChurchEvent, existing?: ChurchEvent) => {
    requireEventWriter();
    const identity = fundIdentity, key = `${identity}:${record.id}`;
    if (eventSavesInFlight.current.has(key)) throw new Error('This event is already being saved.');
    eventSavesInFlight.current.add(key);
    try {
      const saved = await preserveEvent(record, existing, dbSyncUpsert);
      if (fundIdentityRef.current !== identity) throw new Error('The signed-in account changed. This change remains with its original account.');
      const rows = [saved, ...currentDataRef.current.events.filter(row => row.id !== saved.id)];
      currentDataRef.current.events = rows; setEvents(rows);
      return saved;
    } finally { eventSavesInFlight.current.delete(key); }
  };
  const createEvent = async (data: Omit<ChurchEvent, 'id'> & { id: string }) => {
    if (currentDataRef.current.events.some(row => row.id === data.id)) throw new Error('This program already exists. Check Events and pending changes.');
    return saveEvent({ ...data, created_at: new Date().toISOString(), registration_count: 0, attendees: [] });
  };
  const updateEvent = async (id: string, updates: Partial<ChurchEvent>, expectedVersion?: string) => {
    const existing = requireConfirmedEvent(currentDataRef.current.events.find(row => row.id === id));
    if (expectedVersion && expectedVersion !== existing.updated_at) throw new Error('This event changed while the form was open. Close and reopen it before editing.');
    return saveEvent({ ...existing, ...updates, id, updated_at: existing.updated_at }, existing);
  };
  const deleteEvent = async (id: string) => {
    requireEventWriter();
    const row = requireConfirmedEvent(currentDataRef.current.events.find(event => event.id === id));
    if (row.attendees?.length || row.registration_count) throw new Error('Events with registrations must be cancelled, not deleted.');
    // Cancellation keeps event history and can be recovered through the existing outbox.
    await updateEvent(id, { status: 'cancelled' });
  };
  const addEventAttendee = async (eventId: string, attendee: { name: string; phone?: string; email?: string; member_id?: string; role?: string }) => {
    const row = requireConfirmedEvent(currentDataRef.current.events.find(event => event.id === eventId));
    if (['cancelled', 'completed'].includes(row.status)) throw new Error('Registration is closed for this event.');
    const person = attendee.member_id ? currentDataRef.current.members.find(member => member.id === attendee.member_id || member.member_id === attendee.member_id) : undefined;
    if (attendee.member_id && (!person || person.is_archived || ['deceased','transferred'].includes(person.status))) throw new Error('Select an active saved member.');
    if (person && row.attendees?.some(entry => entry.member_id === person.id || entry.member_id === person.member_id)) throw new Error('This member is already registered.');
    const attendees = [...(row.attendees || []), { ...attendee, id: crypto.randomUUID(), registered_at: new Date().toISOString(), checked_in: false }];
    return updateEvent(eventId, { attendees, registration_count: attendees.length });
  };
  const removeEventAttendee = async (eventId: string, attendeeId: string) => {
    const row = requireConfirmedEvent(currentDataRef.current.events.find(event => event.id === eventId));
    if (row.attendees?.find(person => person.id === attendeeId)?.checked_in) throw new Error('A checked-in person cannot be removed. Correct the check-in first if it was entered in error.');
    const attendees = (row.attendees || []).filter(person => person.id !== attendeeId);
    return updateEvent(eventId, { attendees, registration_count: attendees.length });
  };
  const toggleAttendeeCheckIn = async (eventId: string, attendeeId: string) => {
    const row = requireConfirmedEvent(currentDataRef.current.events.find(event => event.id === eventId));
    if (row.status === 'cancelled') throw new Error('Check-in is closed for a cancelled event.');
    const attendees = (row.attendees || []).map(person => person.id === attendeeId ? { ...person, checked_in: !person.checked_in } : person);
    return updateEvent(eventId, { attendees });
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
  const saveFundReceipt = async (record: WelfareFundReceipt, expected?: string) => {
    const identity = fundIdentity, key = `${identity}:${record.id}`;
    if (fundSavesInFlight.current.has(key)) throw new Error('This receipt is already being saved.');
    fundSavesInFlight.current.add(key);
    try {
      const result = await dbSyncUpsert('welfare_fund_receipts', { ...record, ...(expected ? { _expected_updated_at: expected } : {}) });
      if (!result.durable) throw new Error(result.error || 'This device could not preserve the receipt. Keep the form open and retry.');
      if (fundIdentityRef.current !== identity) throw new Error('The signed-in account changed. The pending receipt remains with its original account.');
      const rows = [{ ...record, _sync_status: 'pending' as const }, ...currentDataRef.current.welfareFundReceipts.filter(row => row.id !== record.id)];
      currentDataRef.current.welfareFundReceipts = rows;
      setWelfareFundReceipts(rows);
    } finally { fundSavesInFlight.current.delete(key); }
  };
  const recordWelfareFundReceipt = async (input: WelfareFundInput) => {
    if (!isAuthenticated || !WELFARE_FUND_WRITE_ROLES.includes(currentUser.role)) throw new Error('Finance staff access is required to add welfare funds.');
    validateWelfareFundReceipt(input);
    const existing = currentDataRef.current.welfareFundReceipts.find(row => row.id === input.id);
    if (existing) {
      if (existing.status !== 'active' || (['amount', 'date', 'source', 'reference_no', 'notes'] as const).some(field => existing[field] !== (typeof input[field] === 'string' ? (input[field] as string).trim() : input[field]))) {
        throw new Error('This receipt ID already has different data. Check Fund Receipts and pending changes.');
      }
      return;
    }
    if (currentDataRef.current.welfareFundReceipts.some(row => row.reference_no.toLowerCase() === input.reference_no.trim().toLowerCase())) throw new Error('This reference already has a receipt. Check Fund Receipts before adding it again.');
    await saveFundReceipt({ ...input, reference_no: input.reference_no.trim(), notes: input.notes.trim(), status: 'active' });
  };
  const voidWelfareFundReceipt = async (id: string, reason: string) => {
    if (!isAuthenticated || !WELFARE_FUND_VOID_ROLES.includes(currentUser.role)) throw new Error('A senior pastor or super administrator must void welfare fund receipts.');
    const row = currentDataRef.current.welfareFundReceipts.find(receipt => receipt.id === id);
    if (!row) throw new Error('This receipt is unavailable. Refresh the welfare page.');
    if (row.status === 'voided') return;
    if (row._sync_status === 'pending' || !row.updated_at) throw new Error('Wait for cloud confirmation before voiding this receipt.');
    if (reason.trim().length < 5 || reason.trim().length > 1000) throw new Error('Enter a void reason in 5–1,000 characters.');
    await saveFundReceipt({ ...row, status: 'voided', void_reason: reason.trim() }, row.updated_at);
  };

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
    const pending=churchFinances.filter(row=>row.welfare_claim_id===id&&['requested','approved'].includes(row.approval_state||'')).reduce((sum,row)=>sum+row.amount,0);
    if(amount+pending>remaining)throw new Error('Open payment requests already cover this claim amount. Review them in Church Finance.');
    recordChurchFinance({transaction_type:'disbursement',account_id:details.finance_account_id,account_name:details.finance_account_name||'Welfare Account',
      category:'Benevolence & Welfare',title:`Welfare Grant: ${claim.member_name}`,recipient_or_vendor:claim.member_name,amount,currency:'GHS',date:new Date().toISOString().slice(0,10),
      payment_method:details.disbursement_method,reference_no:details.disbursement_voucher_no,department:'Welfare & Benevolence',welfare_claim_id:id,notes:details.pastoral_notes,status:'pending'});
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
  const childWriter = () => {
    const identity=memberIdentity;
    return {pending:()=>pendingSyncRecords('child_check_ins') as unknown as ChildCheckInRecord[],
      persist:(record:ChildCheckInRecord)=>dbSyncUpsert('child_check_ins',record),retry:preservePendingSync,
      flush:flushSyncOutbox,current:()=>memberIdentityRef.current===identity};
  };
  const withChildSave=async<T,>(id:string,work:()=>Promise<T>):Promise<T>=>{
    if(!isAuthenticated || !canAccess('attendance'))throw new Error('Attendance staff access is required.');
    const key=`${memberIdentity}:${id}`;
    if(childSavesInFlight.current.has(key))throw new Error('This child safety change is already being submitted.');
    childSavesInFlight.current.add(key);try{return await work();}finally{childSavesInFlight.current.delete(key);}
  };
  const checkInChild = async (data:ChildInput,requestId:string=crypto.randomUUID()):Promise<ChildCheckInRecord> => withChildSave(requestId,async()=>{
    const newRecord=await saveChildCheckIn({...data,checked_in_by:currentUser.id},requestId,childCheckIns,childWriter());
    setChildCheckIns(prev=>[newRecord,...prev.filter(row=>row.id!==newRecord.id)]);
    return newRecord;
  });
  const checkOutChild = async (id:string,details:{checked_out_to_person:string;verified_by_leader:string}) => withChildSave(id,async()=>{
    const current=childCheckIns.find(row=>row.id===id);
    if(!current)throw new Error('Refresh check-in records before releasing this child.');
    const updated=await saveChildCheckout(current,details.checked_out_to_person,currentUser.id,childCheckIns,childWriter());
    setChildCheckIns(prev=>prev.map(row=>row.id===id?updated:row));
  });

  const summonChildParent=(id:string,notes?:string)=>{
    const record=childCheckIns.find(row=>row.id===id);if(!record)throw new Error('Check-in not found.');
    const updated={...record,emergency_parent_called:true,emergency_call_notes:notes||'Parent contact requested; staff must call directly.'};
    setChildCheckIns(prev=>prev.map(row=>row.id===id?updated:row));void dbSyncUpsert('child_check_ins',updated);
  };

  const deleteChildCheckIn = (_id: string) => { throw new Error('Child check-in history is preserved.'); };

  // Publish state only after the exact operation has been durably admitted.
  const operationWriter = (): OperationWriter => {
    const identity = memberIdentity;
    return {
      persist: dbSyncUpsertBatch, remove: dbSyncDelete,
      pending: pendingSyncRecord as OperationWriter['pending'], pendingDelete: pendingSyncDelete,
      retry: preservePendingSync, current: () => memberIdentityRef.current === identity,
      log: logAction,
      apply: (table, rows, removedId) => {
        const key = table === 'foundation_students' ? 'foundationStudents' : table;
        if (key === 'members') { commitMembers(previous => {
          const changed = new Map(rows.map(row => [row.id, row]));
          return previous.map(row => (changed.get(row.id) || row) as Member);
        }); return; }
        const previous = (currentDataRef.current as any)[key] || [];
        const changed = new Map(rows.map(row => [row.id, row]));
        const next = [...rows.filter(row => !previous.some((old:any) => old.id === row.id)),
          ...previous.filter((row:any) => row.id !== removedId).map((row:any) => changed.get(row.id) || row)];
        incomingDocuments.current[key] = next;
        (currentDataRef.current as any)[key] = next;
        setterRef.current[key]?.(next);
      },
    };
  };
  const operationWrites = React.useRef(new Set<string>());
  const writeAsset = async <T,>(id:string, work:()=>Promise<T>):Promise<T> => {
    if(!isAuthenticated || !['super_admin','senior_pastor','administrator'].includes(currentUser.role)) throw new Error('Inventory editing authorization is required.');
    const key = `${memberIdentity}:asset:${id}`;
    if(operationWrites.current.has(key)) throw new Error('This asset is already being saved.');
    operationWrites.current.add(key);
    try { return await work(); } finally { operationWrites.current.delete(key); }
  };
  const addAsset = (data:Omit<ChurchAsset,'id'|'created_at'>,requestId:string) =>
    writeAsset(requestId,()=>saveAssetRecord(data,currentDataRef.current.assets,operationWriter(),requestId,true));
  const updateAsset = (id:string,updates:Partial<ChurchAsset>,expectedVersion?:string) =>
    writeAsset(id,()=>saveAssetRecord(updates,currentDataRef.current.assets,operationWriter(),id,false,expectedVersion));
  const deleteAsset = (id:string) => writeAsset(id,()=>removeAssetRecord(id,currentDataRef.current.assets,operationWriter()));
  const addAssetMaintenanceLog = (assetId:string,data:Omit<AssetMaintenanceLog,'id'>,requestId:string,expectedVersion?:string) =>
    writeAsset(assetId,()=>saveMaintenance(assetId,data,currentDataRef.current.assets,operationWriter(),requestId,expectedVersion));

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

  const bulkEnrollMembersInFoundationSchool = (cohortId:string,ids:string[]) => writeMembers(ids,false,async()=>{
    const cohort=foundationCohorts.find(row=>row.id===cohortId);
    if(!cohort)throw new Error('Select an available Foundation School cohort.');
    const students=currentDataRef.current.foundationStudents;
    const rows:FoundationStudent[]=await Promise.all([...new Set(ids)].filter(id=>!students.some(row=>row.member_id===id&&row.cohort_id===cohortId&&row._sync_status!=='pending')).map(async id=>{
      const member=membersRef.current.find(row=>row.id===id);
      if(!member || member.is_archived || member._sync_status==='pending')throw new Error('Select confirmed, unarchived members for enrollment.');
      return {id:await foundationEnrollmentId(cohort.id,member.id),cohort_id:cohort.id,cohort_name:cohort.name,member_id:member.id,
        member_name:`${member.first_name} ${member.last_name}`,member_phone:member.phone,
        enrollment_date:new Date().toISOString().slice(0,10),completed_modules:[],water_baptism_status:Boolean(member.baptism_status),
        water_baptism_date:member.baptism_date,status:'in_progress',created_at:new Date().toISOString()};
    }));
    if(!rows.length)return 0;
    if(memberIdentityRef.current!==memberIdentity)throw new Error('The signed-in account changed. Reopen the member directory.');
    const retained=rows.map(row=>pendingSyncRecord('foundation_students',row.id));
    if(retained.some(Boolean)&&retained.some(row=>!row))throw new Error('Some enrollments are already awaiting confirmation. Use Retry sync before changing the selection.');
    const result=retained.some(Boolean)?await preservePendingSync():await dbSyncUpsertBatch(rows.map(record=>({table:'foundation_students',record})));
    if(!result.durable)throw new Error(result.error || 'The enrollments could not be preserved. Keep the selection and retry.');
    if(memberIdentityRef.current!==memberIdentity)throw new Error('The account changed. Enrollments remain with their original account.');
    const admitted=retained.some(Boolean)?retained as unknown as FoundationStudent[]:rows;
    const idsAdded=new Set(admitted.map(row=>row.id));
    const next=[...admitted.map(row=>({...row,_sync_status:'pending' as const})),...currentDataRef.current.foundationStudents.filter(row=>!idsAdded.has(row.id))];
    incomingDocuments.current.foundationStudents=next;setFoundationStudents(next);
    logAction('BULK_ENROLL_FOUNDATION','Members',`Queued ${rows.length} member enrollments in ${cohort.name}`);
    return rows.length;
  });

  const updateFoundationStudent = (id: string, updates: Partial<FoundationStudent>) => {
    updateFoundationStudentRecord(id, updates, setFoundationStudents, logAction);
  };

  const toggleFoundationModule = (studentId: string, moduleNumber: number) => {
    toggleFoundationModuleRecord(studentId, moduleNumber, setFoundationStudents, logAction);
  };

  const graduateFoundationStudent = (studentId: string, certificateNo?: string) => {
    const student=currentDataRef.current.foundationStudents.find(row=>row.id===studentId);
    if(!student) return Promise.reject(new Error('Student record not found. Refresh before graduating.'));
    return writeMembers([student.member_id],false,()=>graduateStudent(studentId,certificateNo,
      currentDataRef.current.foundationStudents,membersRef.current,operationWriter(),sanitizeMemberForSupabase));
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
      recordGivingBatch,
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
      voidPledgePayment,
      ministries,
      addMinistry,
      updateMinistry,
      deleteMinistry,
      assignMemberToMinistry,
      removeMemberFromMinistry,
      smallGroups,
      cellMeetingReports,
      addSmallGroup,
      recordCellMeetingReport,
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
      welfareFundReceipts,
      recordWelfareFundReceipt,
      voidWelfareFundReceipt,
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
      bulkEnrollMembersInFoundationSchool,
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
      cellMeetingReports,
      events,
      pastoralCare,
      prayerRequests,
      communications,
      auditLogs,
      welfareContributions,
      welfareFundReceipts,
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
