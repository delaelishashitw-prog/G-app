import {
  Member,
  Visitor,
  ChurchService,
  AttendanceRecord,
  HeadcountRecord,
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
  UserProfile,
} from '../types/database.types';

export const initialSettings: ChurchSettings = {
  church_name: 'Church Management System',
  branch_name: 'Main Branch',
  short_name: 'CMS',
  senior_pastor: 'Senior Pastor',
  general_secretary: 'General Secretary',
  logo_url: '/assets/logo.png',
  location: 'City, Country',
  address: 'Main Street, City',
  gps_address: 'GPS-0000',
  phone: '+000 000 0000',
  email: 'admin@example.org',
  currency: 'USD',
  currency_symbol: '$',
  timezone: 'UTC',
};

export const sampleUsers: UserProfile[] = [];
export const sampleServices: ChurchService[] = [];
export const sampleMinistries: Ministry[] = [];
export const sampleSmallGroups: SmallGroup[] = [];
export const sampleMembers: Member[] = [];
export const sampleVisitors: Visitor[] = [];
export const sampleAttendance: AttendanceRecord[] = [];
export const sampleHeadcounts: HeadcountRecord[] = [];
export const sampleGiving: GivingRecord[] = [];
export const sampleCampaigns: PledgeCampaign[] = [];
export const samplePledges: PledgeRecord[] = [];
export const sampleExpenses: ExpenseRecord[] = [];
export const sampleEvents: ChurchEvent[] = [];
export const samplePastoralCare: PastoralCareRecord[] = [];
export const samplePrayerRequests: PrayerRequest[] = [];
export const sampleCommunications: CommunicationRecord[] = [];
export const sampleAuditLogs: AuditLog[] = [];
