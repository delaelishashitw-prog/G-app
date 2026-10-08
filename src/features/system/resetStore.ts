import type { Dispatch, SetStateAction } from 'react';
import type {
  AuditLog,
  ChildCheckInRecord,
  ChurchAsset,
  ChurchEvent,
  ChurchService,
  ChurchSettings,
  CommunicationRecord,
  ExpenseRecord,
  FoundationCohort,
  FoundationStudent,
  GivingRecord,
  HeadcountRecord,
  IntercessoryWatchSlot,
  Member,
  Ministry,
  PastoralCareRecord,
  PastoralCounselingSession,
  PastoralVisitationRecord,
  PrayerRequest,
  PledgeCampaign,
  PledgeRecord,
  RosterAssignment,
  SmallGroup,
  Visitor,
  WelfareClaim,
  WelfareContribution,
} from '../../types/database.types';
import {
  initialSettings,
  sampleAssets,
  sampleAttendance,
  sampleAuditLogs,
  sampleCampaigns,
  sampleChildCheckIns,
  sampleCommunications,
  sampleEvents,
  sampleExpenses,
  sampleFoundationCohorts,
  sampleFoundationStudents,
  sampleGiving,
  sampleHeadcounts,
  sampleIntercessoryWatchSlots,
  sampleMembers,
  sampleMinistries,
  samplePastoralCare,
  samplePastoralCounselingSessions,
  samplePastoralVisitations,
  samplePrayerRequests,
  samplePledges,
  sampleRosterAssignments,
  sampleServices,
  sampleSmallGroups,
  sampleVisitors,
  sampleWelfareClaims,
  sampleWelfareContributions,
} from '../../lib/initialData';

export type ResetStateSetters = {
  setSettings: Dispatch<SetStateAction<ChurchSettings>>;
  setMembers: Dispatch<SetStateAction<Member[]>>;
  setVisitors: Dispatch<SetStateAction<Visitor[]>>;
  setServices: Dispatch<SetStateAction<ChurchService[]>>;
  setAttendance: Dispatch<SetStateAction<any[]>>;
  setHeadcounts: Dispatch<SetStateAction<HeadcountRecord[]>>;
  setGiving: Dispatch<SetStateAction<GivingRecord[]>>;
  setCampaigns: Dispatch<SetStateAction<PledgeCampaign[]>>;
  setPledges: Dispatch<SetStateAction<PledgeRecord[]>>;
  setExpenses: Dispatch<SetStateAction<ExpenseRecord[]>>;
  setMinistries: Dispatch<SetStateAction<Ministry[]>>;
  setSmallGroups: Dispatch<SetStateAction<SmallGroup[]>>;
  setEvents: Dispatch<SetStateAction<ChurchEvent[]>>;
  setPastoralCare: Dispatch<SetStateAction<PastoralCareRecord[]>>;
  setPrayerRequests: Dispatch<SetStateAction<PrayerRequest[]>>;
  setCommunications: Dispatch<SetStateAction<CommunicationRecord[]>>;
  setAuditLogs: Dispatch<SetStateAction<AuditLog[]>>;
  setWelfareContributions: Dispatch<SetStateAction<WelfareContribution[]>>;
  setWelfareClaims: Dispatch<SetStateAction<WelfareClaim[]>>;
  setChildCheckIns: Dispatch<SetStateAction<ChildCheckInRecord[]>>;
  setAssets: Dispatch<SetStateAction<ChurchAsset[]>>;
  setRosterAssignments: Dispatch<SetStateAction<RosterAssignment[]>>;
  setFoundationCohorts: Dispatch<SetStateAction<FoundationCohort[]>>;
  setFoundationStudents: Dispatch<SetStateAction<FoundationStudent[]>>;
  setPastoralVisitations: Dispatch<SetStateAction<PastoralVisitationRecord[]>>;
  setCounselingSessions: Dispatch<SetStateAction<PastoralCounselingSession[]>>;
  setIntercessorySlots: Dispatch<SetStateAction<IntercessoryWatchSlot[]>>;
};

export function resetToSampleDataState(
  setters: ResetStateSetters,
  saveToStorage: <T>(key: string, data: T) => void,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  const {
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
  } = setters;

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
  setWelfareContributions(sampleWelfareContributions);
  setWelfareClaims(sampleWelfareClaims);
  setChildCheckIns(sampleChildCheckIns);
  setAssets(sampleAssets);
  setRosterAssignments(sampleRosterAssignments);
  setFoundationCohorts(sampleFoundationCohorts);
  setFoundationStudents(sampleFoundationStudents);
  setPastoralVisitations(samplePastoralVisitations);
  setCounselingSessions(samplePastoralCounselingSessions);
  setIntercessorySlots(sampleIntercessoryWatchSlots);

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
  saveToStorage('welfareContributions', sampleWelfareContributions);
  saveToStorage('welfareClaims', sampleWelfareClaims);
  saveToStorage('childCheckIns', sampleChildCheckIns);
  saveToStorage('assets', sampleAssets);
  saveToStorage('rosterAssignments', sampleRosterAssignments);
  saveToStorage('foundationCohorts', sampleFoundationCohorts);
  saveToStorage('foundationStudents', sampleFoundationStudents);
  saveToStorage('pastoralVisitations', samplePastoralVisitations);
  saveToStorage('counselingSessions', samplePastoralCounselingSessions);
  saveToStorage('intercessorySlots', sampleIntercessoryWatchSlots);

  logAction('RESET_SAMPLE_DATA', 'System', 'Populated Greater Works City Church sample data');
}
