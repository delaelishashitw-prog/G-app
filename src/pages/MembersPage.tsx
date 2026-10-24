import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  FileText,
  Clock,
  Heart,
  Coins,
  CheckCircle,
  X,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  List,
  MessageSquare,
  Crown,
  Sparkles,
  UserCheck,
  UserX,
  CheckCircle2,
  Award,
  Cake,
  ArrowUpDown,
  Check,
  QrCode,
  Share2,
  BarChart2,
  PieChart as PieChartIcon,
  RefreshCw,
  GraduationCap,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Member, GenderType, MembershipStatus } from '../types/database.types';
import { MemberProfileView } from '../components/MemberProfileView';
import { ProfilePhotoUpload } from '../components/ProfilePhotoUpload';
import { RecordMemberGivingModal } from '../components/members/RecordMemberGivingModal';
import { MemberIdCardModal } from '../components/members/MemberIdCardModal';
import { AddEditMemberModal } from '../components/members/AddEditMemberModal';
import { ArchiveMemberModal } from '../components/members/ArchiveMemberModal';
import { MemberDemographicsSection } from '../components/members/MemberDemographicsSection';
import { FoundationSchoolModal } from '../components/discipleship/FoundationSchoolModal';
import { BulkMemberOperationsModal } from '../components/members/BulkMemberOperationsModal';
import { PrintDirectoryModal } from '../components/members/PrintDirectoryModal';
import { BatchArchiveMembersModal } from '../components/members/BatchArchiveMembersModal';
import { buildCsv } from '../lib/financeViewUtils';
import { canEditMembers, canArchiveMembers, memberMatchesSearch, memberDirectoryPage, memberDirectoryPageSize, MEMBER_SAVE_NOTICE } from '../features/members/memberRules';
import {
  clusterHouseholds,
  buildFamilyBlessingWhatsAppUrl,
  areSpouseMatch,
  getMemberAgeGroup,
} from '../lib/familyUtils';

export const MemberAvatar: React.FC<{
  photoUrl?: string;
  firstName: string;
  lastName: string;
  className?: string;
  fallbackClassName?: string;
}> = ({ photoUrl, firstName, lastName, className = '', fallbackClassName = '' }) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [photoUrl]);

  if (photoUrl && !hasError) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        onError={() => setHasError(true)}
        className={className}
      />
    );
  }

  return (
    <div className={fallbackClassName}>
      {(firstName?.[0] || 'M').toUpperCase()}
      {(lastName?.[0] || 'C').toUpperCase()}
    </div>
  );
};

export const MembersPage: React.FC = () => {
  const {
    members,
    ministries,
    smallGroups,
    addMember,
    updateMember,
    bulkUpdateMembers,
    archiveMember,
    unarchiveMember,
    giving,
    attendance,
    pledges,
    settings,
    isRefreshing,
    lastRefreshedAt,
    refreshData,
    foundationCohorts,
    createFoundationCohort,
    updateFoundationCohort,
    foundationStudents,
    enrollMemberInFoundationSchool,
    bulkEnrollMembersInFoundationSchool,
    updateFoundationStudent,
    toggleFoundationModule,
    graduateFoundationStudent,
  } = useChurchData();
  const { canAccess, currentRole } = useAuth();
  const { success, error, warning, info } = useToast();

  const handleRefresh = async () => {
    const res = await refreshData();
    if (res.success) {
      success('Members Directory Refreshed', res.message);
    } else {
      warning('Refresh Warning', res.message);
    }
  };
  const location = useLocation();
  const navigate = useNavigate();
  const { memberId } = useParams<{ memberId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Role Permissions
  const canGive =
    canAccess('giving') ||
    currentRole === 'super_admin' ||
    currentRole === 'senior_pastor' ||
    currentRole === 'finance_officer';

  const canArchive = canArchiveMembers(currentRole);

  const canExportSensitive =
    currentRole === 'super_admin' ||
    currentRole === 'senior_pastor' ||
    currentRole === 'administrator';

  const canManageMembers = canAccess('members') && canEditMembers(currentRole);

  // Initialize filters from URL or default
  const urlQ = searchParams.get('q') || '';
  const urlStatus = searchParams.get('status') || 'all';
  const urlMinistry = searchParams.get('ministry') || 'all';
  const urlCell = searchParams.get('cell') || 'all';
  const urlGender = searchParams.get('gender') || 'all';
  const urlPage = memberDirectoryPage(searchParams.get('page'));
  const urlView = (searchParams.get('view') as 'cards' | 'table' | 'families') || null;

  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'families'>(() => {
    if (urlView === 'cards' || urlView === 'table' || urlView === 'families') {
      return urlView;
    }
    try {
      const stored = localStorage.getItem('gwcc_member_view_mode');
      return stored === 'table' || stored === 'families' ? stored : 'cards';
    } catch {
      return 'cards';
    }
  });

  const handleSetViewMode = (mode: 'cards' | 'table' | 'families') => {
    setViewMode(mode);
    try {
      localStorage.setItem('gwcc_member_view_mode', mode);
    } catch {
      // storage quota or disabled
    }
  };

  // Search & Filter state
  const [searchInput, setSearchInput] = useState(urlQ);
  const [searchTerm, setSearchTerm] = useState(urlQ);
  const [statusFilter, setStatusFilter] = useState<string>(urlStatus);
  const [ministryFilter, setMinistryFilter] = useState<string>(urlMinistry);
  const [smallGroupFilter, setSmallGroupFilter] = useState<string>(urlCell);
  const [genderFilter, setGenderFilter] = useState<string>(urlGender);
  const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'member-id' | 'date-joined' | 'tithe-number'>('name-asc');
  const [birthdayFilterActive, setBirthdayFilterActive] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('gwcc_member_page_size');
      return memberDirectoryPageSize(stored);
    } catch {
      return 24;
    }
  });

  const handleSetPageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    try {
      localStorage.setItem('gwcc_member_page_size', String(size));
    } catch {}
  };

  // Debounce search input to eliminate typing latency
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync state to URL search parameters for link sharing & persistence
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (searchTerm.trim()) params.set('q', searchTerm.trim()); else params.delete('q');
    if (statusFilter !== 'all') params.set('status', statusFilter); else params.delete('status');
    if (ministryFilter !== 'all') params.set('ministry', ministryFilter); else params.delete('ministry');
    if (smallGroupFilter !== 'all') params.set('cell', smallGroupFilter); else params.delete('cell');
    if (genderFilter !== 'all') params.set('gender', genderFilter); else params.delete('gender');
    if (currentPage > 1) params.set('page', String(currentPage)); else params.delete('page');
    if (viewMode !== 'cards') params.set('view', viewMode); else params.delete('view');
    setSearchParams(params, { replace: true });
  }, [searchTerm, statusFilter, ministryFilter, smallGroupFilter, genderFilter, currentPage, viewMode]);

  // Multi-select batch state
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());

  // Preserve the page from a shared link; only later filter changes reset it.
  const filterKey = JSON.stringify([searchTerm, statusFilter, ministryFilter, smallGroupFilter, genderFilter, birthdayFilterActive, sortOrder]);
  const previousFilterKey = React.useRef(filterKey);
  React.useEffect(() => {
    if (previousFilterKey.current !== filterKey) {
      previousFilterKey.current = filterKey;
      setCurrentPage(1);
      setBatchSelectedIds(new Set());
    }
  }, [filterKey]);

  // Selected Member & Modals
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMemberForGiving, setSelectedMemberForGiving] = useState<Member | null>(null);
  const [selectedMemberForIdCard, setSelectedMemberForIdCard] = useState<Member | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberToArchive, setMemberToArchive] = useState<Member | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isFoundationSchoolOpen, setIsFoundationSchoolOpen] = useState(false);
  const [isBulkOperationsOpen, setIsBulkOperationsOpen] = useState(false);
  const [isBatchArchiveOpen, setIsBatchArchiveOpen] = useState(false);
  const [isPrintDirectoryOpen, setIsPrintDirectoryOpen] = useState(false);

  // Demographics Visual Dashboard collapsible state
  const [isDemographicsOpen, setIsDemographicsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('gwcc_member_demographics_open');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleDemographics = () => {
    setIsDemographicsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gwcc_member_demographics_open', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleApplyDemographicFilter = (
    filterType: 'gender' | 'status' | 'age_group' | 'baptism',
    value: string
  ) => {
    if (filterType === 'gender') {
      setGenderFilter(value);
      success(`Filtered by gender: ${value === 'female' ? 'Female' : 'Male'}`);
    } else if (filterType === 'status') {
      setStatusFilter(value);
      success(`Filtered members by status: ${value.replace('_', ' ')}`);
    } else if (filterType === 'age_group') {
      setSearchTerm(value);
      success(`Filtered by demographic group: ${value}`);
    }
  };

  // Detect members celebrating birthdays in the current month
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });

  const birthdayCelebrants = useMemo(() => {
    return members.filter((m) => {
      if (m.is_archived || !m.date_of_birth) return false;
      const parts = m.date_of_birth.split('-');
      if (parts.length >= 2) {
        const birthMonth = parseInt(parts[1], 10);
        return birthMonth === currentMonth;
      }
      return false;
    });
  }, [members, currentMonth]);

  // Status Category dynamic count statistics
  const statusCounts = useMemo(() => {
    const nonArchived = members.filter((m) => !m.is_archived);
    return {
      all: nonArchived.length,
      active: nonArchived.filter((m) => m.status === 'active').length,
      inactive: nonArchived.filter((m) => m.status === 'inactive').length,
      new_convert: nonArchived.filter((m) => m.status === 'new_convert' || m.status === 'new_member').length,
      leader: nonArchived.filter((m) => m.status === 'leader' || Boolean(m.leadership_position)).length,
      pending_baptism: nonArchived.filter((m) => !m.baptism_status).length,
      birthdays: birthdayCelebrants.length,
      unassigned_cell: nonArchived.filter((m) => !m.small_group_id).length,
      archived: members.filter((m) => m.is_archived).length,
    };
  }, [members, birthdayCelebrants.length]);

  // Sync selectedMember with URL route param (/members/:memberId) or search param (?id=...)
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = memberId || params.get('id');
    if (targetId) {
      const found = members.find((m) => m.id === targetId || m.member_id === targetId);
      if (found) {
        setSelectedMember(found);
      }
    } else {
      setSelectedMember(null);
    }

    if (params.get('tab') === 'discipleship' || params.get('tab') === 'foundation' || params.get('view') === 'foundation') {
      setIsFoundationSchoolOpen(true);
    }
  }, [memberId, location.search, members]);

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    navigate({
      pathname: `/members/${member.id}`,
      search: location.search,
    });
  };

  const handleBackToList = () => {
    setSelectedMember(null);
    navigate({
      pathname: '/members',
      search: location.search,
    });
  };

  const handleConfirmArchiveMember = async () => {
    if (!memberToArchive) return;
    setIsArchiving(true);
    try {
      if (!canArchive) return;
      await archiveMember(memberToArchive.id, memberToArchive.updated_at);
      info('Archive saved', MEMBER_SAVE_NOTICE);
      setMemberToArchive(null);
    } catch (err: any) {
      error(err?.message || 'Failed to archive member');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestoreMember = async (m: Member) => {
    if (!canArchive) return;
    try {
      await unarchiveMember(m.id, m.updated_at);
      info('Restore saved', MEMBER_SAVE_NOTICE);
    } catch (err) { error((err as Error).message || 'This member could not be restored.'); }
  };

  const handleBatchArchive = () => {
    if (canArchive && selectedMembers.length) setIsBatchArchiveOpen(true);
  };

  const handleBulkUpdate = async (memberIds: string[], updates: Partial<Member>) => {
    if (!canManageMembers) throw new Error('Member editing authorization is required.');
    const allowed = new Set(selectedMembers.map(member => member.id));
    if (memberIds.some(id => !allowed.has(id))) throw new Error('The selection changed. Review the selected members again.');
    await bulkUpdateMembers(memberIds, updates);
    info('Member changes saved', MEMBER_SAVE_NOTICE);
  };

  const handleBulkEnrollInCohort = async (cohortId:string,cohortName:string,selectedMemberList:Member[]) => {
    if(!canManageMembers)throw new Error('Member editing authorization is required.');
    const allowed=new Set(selectedMembers.map(member=>member.id));
    if(selectedMemberList.some(member=>!allowed.has(member.id)))throw new Error('The selection changed. Review the selected members again.');
    const count=await bulkEnrollMembersInFoundationSchool(cohortId,selectedMemberList.map(member=>member.id));
    info(count ? 'Enrollments saved' : 'Already enrolled',count ? MEMBER_SAVE_NOTICE : `The selected members are already enrolled in ${cohortName}.`);
  };

  // Filtered and Sorted members
  const filteredMembers = useMemo(() => {
    let result = members.filter((m) => {
      if (statusFilter === 'archived') {
        if (!m.is_archived) return false;
      } else {
        if (m.is_archived) return false;
      }

      // Birthday Filter
      if (birthdayFilterActive) {
        if (!m.date_of_birth) return false;
        const parts = m.date_of_birth.split('-');
        if (parts.length >= 2 && parseInt(parts[1], 10) !== currentMonth) return false;
      }

      const matchesSearch = memberMatchesSearch(m, searchTerm);

      // Status
      let matchesStatus = true;
      if (statusFilter === 'all' || statusFilter === 'archived') {
        matchesStatus = true;
      } else if (statusFilter === 'leader') {
        matchesStatus = m.status === 'leader' || Boolean(m.leadership_position);
      } else if (statusFilter === 'new_convert') {
        matchesStatus = m.status === 'new_convert' || m.status === 'new_member';
      } else if (statusFilter === 'pending_baptism') {
        matchesStatus = !m.baptism_status;
      } else if (statusFilter === 'unassigned_cell') {
        matchesStatus = !m.small_group_id;
      } else {
        matchesStatus = m.status === statusFilter;
      }

      const matchesMinistry = ministryFilter === 'all' || m.ministry_id === ministryFilter;
      const matchesSmallGroup = smallGroupFilter === 'all' || m.small_group_id === smallGroupFilter;
      const matchesGender = genderFilter === 'all' || m.gender === genderFilter;

      return matchesSearch && matchesStatus && matchesMinistry && matchesSmallGroup && matchesGender;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortOrder === 'name-asc') {
        return a.first_name.localeCompare(b.first_name);
      }
      if (sortOrder === 'name-desc') {
        return b.first_name.localeCompare(a.first_name);
      }
      if (sortOrder === 'member-id') {
        return a.member_id.localeCompare(b.member_id);
      }
      if (sortOrder === 'date-joined') {
        return new Date(b.membership_date).getTime() - new Date(a.membership_date).getTime();
      }
      if (sortOrder === 'tithe-number') {
        return (a.tithe_number || 'ZZZ').localeCompare(b.tithe_number || 'ZZZ');
      }
      return 0;
    });

    return result;
  }, [
    members,
    searchTerm,
    statusFilter,
    ministryFilter,
    smallGroupFilter,
    genderFilter,
    sortOrder,
    birthdayFilterActive,
    currentMonth,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const selectedMembers = useMemo(() => filteredMembers.filter(member => batchSelectedIds.has(member.id)), [filteredMembers, batchSelectedIds]);
  React.useEffect(() => {
    const ids = new Set(filteredMembers.map(member => member.id));
    setBatchSelectedIds(previous => {
      const next = new Set([...previous].filter(id => ids.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [filteredMembers]);
  React.useEffect(() => {
    if (members.length && !isRefreshing && currentPage > totalPages) setCurrentPage(totalPages);
  }, [members.length, isRefreshing, totalPages, currentPage]);

  // Paginated slice for cards and table views
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  // Cluster members into Household & Family Units
  const households = useMemo(() => {
    return clusterHouseholds(filteredMembers);
  }, [filteredMembers]);

  const multiMemberHouseholdsCount = useMemo(() => {
    return households.filter((h) => h.totalMembers > 1).length;
  }, [households]);

  const marriedHouseholdsCount = useMemo(() => {
    return households.filter((h) => h.hasMarriedCouple).length;
  }, [households]);

  // Batch toggle
  const toggleSelectMember = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(batchSelectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBatchSelectedIds(next);
  };

  const handleSelectAllVisible = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setBatchSelectedIds(new Set());
    } else {
      setBatchSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  // Export to CSV
  const handleExportCSV = (selectedOnly = false) => {
    const listToExport = selectedOnly
      ? selectedMembers
      : filteredMembers;

    if (listToExport.length === 0) {
      error('No members to export.');
      return;
    }

    const headers = [
      'Member ID',
      'Tithe Number',
      'First Name',
      'Middle Name',
      'Last Name',
      'Gender',
      'Phone',
      'Alt Phone',
      'Email',
      'Date Joined GWCC',
      'Membership Status',
      'Ministry Fellowship',
      'Small Group (Cell)',
      'Leadership Office',
      'Date of Birth',
      'Marital Status',
      'Spouse Name',
      'Number of Children',
      'Ghana Card / National ID',
      'Hometown',
      'Region of Origin',
      'Residential Address',
      'Nearest Landmark',
      'GhanaPost GPS',
      'City',
      'Occupation',
      'Employer',
      'Water Baptism',
      'Holy Spirit Baptism',
      'Foundation School',
      'Spiritual Gifts',
      'Talents & Skills',
      'Emergency Contact',
      'Emergency Phone',
      'Cloud Confirmation',
    ];

    const rows = listToExport.map((m) => [
      m.member_id,
      m.tithe_number || '',
      m.first_name,
      m.middle_name || '',
      m.last_name,
      m.gender,
      m.phone,
      m.alternative_phone || '',
      m.email || '',
      m.membership_date || m.date_joined || '',
      m.status,
      m.ministry_name || '',
      m.small_group_name || '',
      m.leadership_position || '',
      m.date_of_birth || '',
      m.marital_status || 'single',
      m.spouse_name || '',
      m.number_of_children ?? '',
      canExportSensitive
        ? (m.national_id || '')
        : (m.national_id ? `${m.national_id.slice(0, 4)}••••${m.national_id.slice(-2)}` : ''),
      m.hometown || '',
      m.region_of_origin || '',
      m.residential_address || '',
      m.landmark || '',
      m.gps_address || '',
      m.city,
      m.occupation || '',
      m.employer || '',
      m.baptism_status ? 'Yes' : 'No',
      m.holy_spirit_baptism ? 'Yes' : 'No',
      m.membership_class_completed ? 'Yes' : 'No',
      m.spiritual_gifts || '',
      m.talents_skills || '',
      m.emergency_name ? `${m.emergency_name} (${m.emergency_relationship || 'Contact'})` : '',
      m.emergency_phone || '',
      m._sync_status === 'pending' ? 'Awaiting cloud confirmation' : 'Confirmed',
    ]);

    const csvContent = buildCsv([headers, ...rows]);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GWCC_Members_Registry_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    success(`Exported ${listToExport.length} member records to Excel.`);
  };

  const openCreateModal = () => {
    if (!canManageMembers) return;
    setEditingMember(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (member: Member) => {
    if (!canManageMembers || member._sync_status === 'pending') return;
    setEditingMember(member);
    setIsAddModalOpen(true);
  };

  const handleSaveMember = async (memberData: Partial<Member>) => {
    if (!canManageMembers) throw new Error('Member editing authorization is required.');
    if (!memberData.first_name?.trim() || !memberData.last_name?.trim() || !memberData.phone?.trim()) {
      throw new Error('Please provide first name, last name, and phone number.');
    }

    const selectedMin = ministries.find((m) => m.id === memberData.ministry_id);
    const selectedGrp = smallGroups.find((g) => g.id === memberData.small_group_id);

    const dateJoined = memberData.membership_date || memberData.date_joined || new Date().toISOString().split('T')[0];

    if (editingMember) {
      const updatedPayload: Partial<Member> = {
        ...memberData,
        membership_date: dateJoined,
        date_joined: dateJoined,
        ministry_name: selectedMin ? selectedMin.name : memberData.ministry_name,
        small_group_name: selectedGrp ? selectedGrp.name : memberData.small_group_name,
      };
      const saved = await updateMember(editingMember.id, updatedPayload, editingMember.updated_at);
      if (selectedMember && selectedMember.id === editingMember.id) {
        setSelectedMember(saved);
      }
      info('Member changes saved', MEMBER_SAVE_NOTICE);
    } else {
      const created = await addMember({
        first_name: memberData.first_name!.trim(),
        middle_name: memberData.middle_name?.trim(),
        last_name: memberData.last_name!.trim(),
        gender: (memberData.gender as GenderType) || 'male',
        marital_status: memberData.marital_status || 'single',
        nationality: memberData.nationality || 'Ghanaian',
        national_id: memberData.national_id?.trim(),
        hometown: memberData.hometown?.trim(),
        region_of_origin: memberData.region_of_origin || 'Greater Accra',
        spouse_name: memberData.spouse_name?.trim(),
        spouse_is_member: Boolean(memberData.spouse_is_member),
        wedding_anniversary: memberData.wedding_anniversary,
        number_of_children: memberData.number_of_children ?? 0,
        phone: memberData.phone!.trim(),
        alternative_phone: memberData.alternative_phone?.trim(),
        preferred_communication: memberData.preferred_communication || 'whatsapp',
        email: memberData.email?.trim(),
        residential_address: memberData.residential_address?.trim(),
        landmark: memberData.landmark?.trim(),
        city: memberData.city || 'Accra',
        region: memberData.region || 'Greater Accra',
        gps_address: memberData.gps_address?.trim(),
        profile_photo_url: memberData.profile_photo_url || undefined,
        status: (memberData.status as MembershipStatus) || 'active',
        membership_date: dateJoined,
        date_joined: dateJoined,
        first_visit_date: memberData.first_visit_date,
        tithe_number: memberData.tithe_number?.trim() || undefined,
        date_of_birth: memberData.date_of_birth,
        occupation: memberData.occupation?.trim(),
        employer: memberData.employer?.trim(),
        education: memberData.education,
        baptism_status: Boolean(memberData.baptism_status),
        baptism_date: memberData.baptism_date,
        baptized_by: memberData.baptized_by?.trim(),
        salvation_status: Boolean(memberData.salvation_status),
        salvation_date: memberData.salvation_date,
        holy_spirit_baptism: Boolean(memberData.holy_spirit_baptism),
        holy_spirit_baptism_date: memberData.holy_spirit_baptism_date,
        membership_class_completed: Boolean(memberData.membership_class_completed),
        right_hand_of_fellowship_date: memberData.right_hand_of_fellowship_date,
        previous_church: memberData.previous_church?.trim(),
        ministry_id: memberData.ministry_id,
        ministry_name: selectedMin ? selectedMin.name : undefined,
        small_group_id: memberData.small_group_id,
        small_group_name: selectedGrp ? selectedGrp.name : undefined,
        leadership_position: memberData.leadership_position?.trim(),
        spiritual_gifts: memberData.spiritual_gifts?.trim(),
        talents_skills: memberData.talents_skills?.trim(),
        emergency_name: memberData.emergency_name?.trim(),
        emergency_phone: memberData.emergency_phone?.trim(),
        emergency_alt_phone: memberData.emergency_alt_phone?.trim(),
        emergency_relationship: memberData.emergency_relationship?.trim(),
        notes: memberData.notes?.trim(),
        is_archived: false,
      }, memberData.id);
      handleSelectMember(created);
      info('Member registration saved', `${MEMBER_SAVE_NOTICE} The official member and tithe numbers will appear after confirmation.`);
    }

    setIsAddModalOpen(false);
  };

  // Status Badge Helper
  const renderStatusBadge = (member: Member, size: 'sm' | 'md' = 'sm') => {
    if (member._sync_status === 'pending') return <span role="status" className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900">Awaiting cloud confirmation</span>;
    if (member.is_archived) return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">Archived</span>;
    const isLeader = member.status === 'leader' || Boolean(member.leadership_position);

    if (member.status === 'leader' || (statusFilter === 'leader' && isLeader)) {
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-200/80 shadow-2xs ${
            size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          }`}
          title={member.leadership_position ? `Leader: ${member.leadership_position}` : 'Church Leader'}
        >
          <Crown className={size === 'sm' ? 'w-2.5 h-2.5 text-purple-700' : 'w-3 h-3 text-purple-700'} />
          <span>Leader</span>
        </span>
      );
    }

    if (member.status === 'new_convert') {
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-full bg-sky-100 text-sky-900 border border-sky-200/80 shadow-2xs ${
            size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          }`}
        >
          <Sparkles className={size === 'sm' ? 'w-2.5 h-2.5 text-sky-600' : 'w-3 h-3 text-sky-600'} />
          <span>New Convert</span>
        </span>
      );
    }

    if (member.status === 'inactive') {
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-200/80 shadow-2xs ${
            size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          }`}
        >
          <UserX className={size === 'sm' ? 'w-2.5 h-2.5 text-amber-700' : 'w-3 h-3 text-amber-700'} />
          <span>Inactive</span>
        </span>
      );
    }

    if (member.status === 'new_member') {
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-full bg-blue-100 text-blue-900 border border-blue-200/80 shadow-2xs ${
            size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          }`}
        >
          <Sparkles className={size === 'sm' ? 'w-2.5 h-2.5 text-blue-600' : 'w-3 h-3 text-blue-600'} />
          <span>New Member</span>
        </span>
      );
    }

    if (member.status === 'active') {
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200/80 shadow-2xs ${
            size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
          }`}
        >
          <CheckCircle2 className={size === 'sm' ? 'w-2.5 h-2.5 text-emerald-700' : 'w-3 h-3 text-emerald-700'} />
          <span>Active</span>
        </span>
      );
    }

    return (
      <span
        className={`font-bold rounded-full capitalize bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs ${
          size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
        }`}
      >
        {member.status.replace('_', ' ')}
      </span>
    );
  };

  // Accessible Pagination Bar Controls
  const renderPaginationControls = () => {
    if (filteredMembers.length <= pageSize && currentPage === 1) {
      return null;
    }

    const startItem = filteredMembers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, filteredMembers.length);

    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <span>
            Showing <strong className="text-slate-800">{startItem}</strong> to{' '}
            <strong className="text-slate-800">{endItem}</strong> of{' '}
            <strong className="text-slate-800">{filteredMembers.length}</strong> members
          </span>

          <span className="text-slate-300">•</span>

          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handleSetPageSize(Number(e.target.value))}
              className="py-1 px-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(1)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 font-bold text-slate-700">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {selectedMember ? (
        <MemberProfileView
          member={selectedMember}
          onBack={handleBackToList}
          onEdit={openEditModal}
          renderStatusBadge={renderStatusBadge}
          onSelectMember={handleSelectMember}
        />
      ) : (
        <>
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <Users className="w-7 h-7 text-teal-700" />
                Member Directory & Profiles
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Active congregation registry for {settings.church_name || 'the church'}{settings.branch_name ? `, ${settings.branch_name}` : ''}
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2.5">
              {/* View Mode Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  onClick={() => handleSetViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    viewMode === 'cards'
                      ? 'bg-white text-teal-900 shadow-xs border border-slate-200/80 font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-teal-600" />
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => handleSetViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    viewMode === 'table'
                      ? 'bg-white text-teal-900 shadow-xs border border-slate-200/80 font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Table Spreadsheet View"
                >
                  <List className="w-3.5 h-3.5 text-teal-600" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => handleSetViewMode('families')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    viewMode === 'families'
                      ? 'bg-white text-teal-900 shadow-xs border border-slate-200/80 font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Families & Households Grouping"
                >
                  <Users className="w-3.5 h-3.5 text-teal-600" />
                  <span>Families ({multiMemberHouseholdsCount})</span>
                </button>
              </div>

              {/* Demographics Dashboard Toggle Button */}
              <button
                type="button"
                onClick={handleToggleDemographics}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs ${
                  isDemographicsOpen
                    ? 'bg-teal-900 text-white border-teal-900 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
                title={isDemographicsOpen ? 'Collapse demographic visual analytics' : 'Expand demographic visual analytics'}
              >
                <BarChart2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Demographics</span>
              </button>

              {/* Discipleship & Foundation School Button */}
              <button
                type="button"
                onClick={() => setIsFoundationSchoolOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-950 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title="Foundation School & Believers Discipleship Academy"
              >
                <GraduationCap className="w-4 h-4 text-emerald-700" />
                <span>Foundation School</span>
                {foundationStudents.filter((s) => s.status === 'in_progress' || s.status === 'ready_for_baptism').length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-700 text-white">
                    {foundationStudents.filter((s) => s.status === 'in_progress' || s.status === 'ready_for_baptism').length}
                  </span>
                )}
              </button>

              {/* Print Directory Button */}
              <button
                type="button"
                onClick={() => setIsPrintDirectoryOpen(true)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title="Print Official Congregational Membership Directory"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Print Directory</span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-60"
                title={`Refresh Members Directory • Last updated: ${lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              <button
                onClick={() => handleExportCSV(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                title="Download CSV formatted for Microsoft Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Export Excel</span>
              </button>

              {canManageMembers && (<button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-teal-700/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Member</span>
              </button>)}
            </div>
          </div>

          {/* VISUAL DEMOGRAPHICS & ANALYTICS DASHBOARD */}
          <MemberDemographicsSection
            members={members}
            filteredMembers={filteredMembers}
            onApplyFilter={handleApplyDemographicFilter}
            isOpen={isDemographicsOpen}
            onToggleOpen={handleToggleDemographics}
          />

          {/* Birthday Celebrations Banner (if celebrants exist this month) */}
          {birthdayCelebrants.length > 0 && (
            <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 p-4 rounded-2xl border border-pink-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-pink-500/20 animate-bounce">
                  <Cake className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-pink-950 flex items-center gap-2">
                    {currentMonthName} Birthday Celebrations ({birthdayCelebrants.length} Members)
                    <span className="text-[10px] bg-pink-200/70 text-pink-900 font-extrabold px-2 py-0.5 rounded-full">
                      {settings.branch_name || settings.church_name || 'Church Family'}
                    </span>
                  </h4>
                  <p className="text-xs text-pink-900/80 mt-0.5">
                    {birthdayCelebrants.map((b) => `${b.first_name} ${b.last_name}`).slice(0, 4).join(', ')}
                    {birthdayCelebrants.length > 4 ? ` and ${birthdayCelebrants.length - 4} others` : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setBirthdayFilterActive(!birthdayFilterActive)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  birthdayFilterActive
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'bg-white hover:bg-pink-100 text-pink-700 border border-pink-300'
                }`}
              >
                <Cake className="w-3.5 h-3.5" />
                <span>{birthdayFilterActive ? 'Show All Members' : 'Filter Celebrants'}</span>
              </button>
            </div>
          )}

          {/* Filter Toolbar & Status Categorization System */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            {/* Quick Status Category Filter Chips */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Filter by Status:
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* All */}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setBirthdayFilterActive(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                    statusFilter === 'all' && !birthdayFilterActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>All</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      statusFilter === 'all' && !birthdayFilterActive
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-700'
                    }`}
                  >
                    {statusCounts.all}
                  </span>
                </button>

                {/* Active */}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('active');
                    setBirthdayFilterActive(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                    statusFilter === 'active'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700">
                    {statusCounts.active}
                  </span>
                </button>

                {/* Leaders */}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('leader');
                    setBirthdayFilterActive(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                    statusFilter === 'leader'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Leaders</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700">
                    {statusCounts.leader}
                  </span>
                </button>

                {/* New Converts */}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('new_convert');
                    setBirthdayFilterActive(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                    statusFilter === 'new_convert'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>New Converts</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700">
                    {statusCounts.new_convert}
                  </span>
                </button>

                {/* Pending Baptism */}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('pending_baptism');
                    setBirthdayFilterActive(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                    statusFilter === 'pending_baptism'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending Baptism</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700">
                    {statusCounts.pending_baptism}
                  </span>
                </button>

                {/* Unassigned Cell */}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('unassigned_cell');
                    setBirthdayFilterActive(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                    statusFilter === 'unassigned_cell'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>No Cell Group</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700">
                    {statusCounts.unassigned_cell}
                  </span>
                </button>

                {/* Archived */}
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('archived');
                    setBirthdayFilterActive(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                    statusFilter === 'archived'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                  }`}
                  title="View archived member profiles"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archived</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700">
                    {statusCounts.archived}
                  </span>
                </button>
              </div>
            </div>

            {/* Search, Sorting, and Secondary Select Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Search bar with instant clear */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search name, GWCC-ID, Tithe #, phone, GPS..."
                  className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchTerm('');
                    }}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Order */}
              <div>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-slate-700 font-medium"
                >
                  <option value="name-asc">Sort: Name (A to Z)</option>
                  <option value="name-desc">Sort: Name (Z to A)</option>
                  <option value="member-id">Sort: Member ID</option>
                  <option value="date-joined">Sort: Date Joined (Newest)</option>
                  <option value="tithe-number">Sort: Tithe Number</option>
                </select>
              </div>

              {/* Ministry Filter */}
              <div>
                <select
                  value={ministryFilter}
                  onChange={(e) => setMinistryFilter(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-slate-700 font-medium"
                >
                  <option value="all">All Ministries</option>
                  {ministries.map((min) => (
                    <option key={min.id} value={min.id}>
                      {min.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cell Group / Fellowship Filter */}
              <div>
                <select
                  value={smallGroupFilter}
                  onChange={(e) => setSmallGroupFilter(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-slate-700 font-medium"
                >
                  <option value="all">All Cell Groups</option>
                  {smallGroups.map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      {grp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender Filter */}
              <div>
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-slate-700 font-medium"
                >
                  <option value="all">All Genders</option>
                  <option value="male">Men / Male</option>
                  <option value="female">Women / Female</option>
                </select>
              </div>
            </div>

            {/* Filter Summary Count & Select All */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="font-bold text-teal-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {selectedMembers.length === filteredMembers.length && filteredMembers.length > 0
                      ? 'Deselect All'
                      : `Select all matching (${filteredMembers.length})`}
                  </span>
                </button>
                <span className="text-slate-300">•</span>
                <span>
                  Showing <strong className="font-mono tabular-nums">{filteredMembers.length}</strong> of{' '}
                  <strong className="font-mono tabular-nums">{members.length}</strong> members
                </span>
                {birthdayFilterActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-800 border border-pink-200">
                    🎂 {currentMonthName} Celebrants
                  </span>
                )}
              </div>

              {(searchInput || searchTerm || statusFilter !== 'all' || ministryFilter !== 'all' || smallGroupFilter !== 'all' || genderFilter !== 'all' || birthdayFilterActive) && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearchTerm('');
                    setStatusFilter('all');
                    setMinistryFilter('all');
                    setSmallGroupFilter('all');
                    setGenderFilter('all');
                    setBirthdayFilterActive(false);
                    setCurrentPage(1);
                  }}
                  className="text-teal-700 hover:underline font-semibold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Floating Multi-Select Action Bar (appears when 1+ members selected) */}
          {selectedMembers.length > 0 && (
            <div className="sticky top-20 z-20 bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-500 text-white font-bold flex items-center justify-center text-xs">
                  {selectedMembers.length}
                </span>
                <span className="font-bold text-xs">
                  {selectedMembers.length} Member{selectedMembers.length > 1 ? 's' : ''} Selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                {canManageMembers && (
                  <button
                    onClick={() => setIsBulkOperationsOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    title="Batch assign ministry, cell group, status, or Foundation School"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Bulk Operations ({selectedMembers.length})</span>
                  </button>
                )}

                <button
                  onClick={() => setIsPrintDirectoryOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
                  title="Print directory of selected members"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-300" />
                  <span>Print Selected</span>
                </button>

                {canArchive && (
                  <button
                    onClick={handleBatchArchive}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    title="Archive selected members"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive Selected ({selectedMembers.length})</span>
                  </button>
                )}

                <button
                  onClick={() => handleExportCSV(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition border border-slate-700"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Selected Excel</span>
                </button>

                <button
                  onClick={() => setBatchSelectedIds(new Set())}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold transition"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* MEMBERS DISPLAY: CARDS VIEW OR TABLE VIEW */}
          {filteredMembers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-3 border border-teal-200">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No members found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No member profiles match your current search query or filter criteria. Try adjusting your parameters.
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            /* CARD VIEW GRID */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedMembers.map((member) => {
                const ministry = ministries.find((m) => m.id === member.ministry_id);
                const smallGroup = smallGroups.find((g) => g.id === member.small_group_id);
                const isSelected = batchSelectedIds.has(member.id);

                return (
                  <div
                    key={member.id}
                    role="article" aria-label={`${member.first_name} ${member.last_name}`}
                    onClick={() => handleSelectMember(member)}
                    className={`bg-white rounded-2xl border p-5 shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                      isSelected
                        ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20 shadow-md'
                        : 'border-slate-200 hover:border-teal-400 hover:shadow-md'
                    }`}
                  >
                    {/* Top Bar: Checkbox, Member ID & Status Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${member.first_name} ${member.last_name}`}
                            checked={isSelected}
                            onClick={(e) => toggleSelectMember(member.id, e)}
                            onChange={() => {}}
                            className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500 cursor-pointer"
                          />
                          <span className="font-mono text-[11px] font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                            {member.member_id}
                          </span>
                        </div>
                        {renderStatusBadge(member, 'sm')}
                      </div>

                      {/* Member Avatar & Names */}
                      <div className="flex items-center gap-3.5 mb-3">
                        <div className="relative shrink-0">
                          {member.profile_photo_url ? (
                            <img
                              src={member.profile_photo_url}
                              alt={`${member.first_name} ${member.last_name}`}
                              className="w-13 h-13 rounded-2xl object-cover border-2 border-teal-500/20 shadow-xs"
                            />
                          ) : (
                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-teal-800 to-emerald-700 text-white font-bold text-base flex items-center justify-center shadow-xs border-2 border-teal-500/20">
                              {member.first_name[0]}
                              {member.last_name[0]}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-2xs ${
                              member.gender === 'male' ? 'bg-sky-600' : 'bg-pink-500'
                            }`}
                            title={member.gender === 'male' ? 'Male' : 'Female'}
                          >
                            {member.gender === 'male' ? 'M' : 'F'}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-slate-900 group-hover:text-teal-700 transition truncate leading-snug">
                            {member.first_name} {member.middle_name ? `${member.middle_name} ` : ''}{member.last_name}
                          </h3>
                          {member.tithe_number ? (
                            <div className="flex items-center gap-1 text-[11px] text-amber-800 font-medium mt-0.5">
                              <Coins className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="font-mono font-semibold">Tithe #{member.tithe_number}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 block mt-0.5">Member</span>
                          )}
                          <span className="text-[10px] text-slate-500 capitalize block truncate">
                            {member.marital_status || 'Single'} • {member.occupation || 'Member'}
                          </span>
                        </div>
                      </div>

                      {/* Demographic & Contact Details */}
                      <div className="space-y-1.5 py-3 border-y border-slate-100 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <a
                            href={`tel:${member.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 truncate text-slate-700 hover:text-teal-700 font-medium transition font-mono text-[11px]"
                          >
                            <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>{member.phone}</span>
                          </a>

                          {canGive && (<button disabled={member._sync_status === 'pending'}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMemberForGiving(member);
                            }}
                            className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition"
                            title="Record Tithe/Giving for this member"
                          >
                            + Give
                          </button>)}
                        </div>

                        {member.gps_address ? (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <a
                              href={`https://ghanapostgps.com/map/#${member.gps_address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-[10px] font-semibold text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 hover:underline truncate"
                            >
                              {member.gps_address}
                            </a>
                          </div>
                        ) : member.residential_address ? (
                          <div className="flex items-center gap-1.5 text-slate-500 truncate text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{member.residential_address}</span>
                          </div>
                        ) : null}

                        {/* Date Joined & Ministry Tag */}
                        <div className="pt-1 flex items-center justify-between gap-1 flex-wrap text-[10px]">
                          <span className="flex items-center gap-1 font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Joined: {member.membership_date || member.date_joined || 'Foundation'}</span>
                          </span>
                          {(ministry || member.ministry_name) && (
                            <span className="font-semibold text-teal-900 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/50 truncate max-w-[130px]">
                              {ministry?.name || member.ministry_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div
                      className="mt-3 pt-2 flex items-center justify-between text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleSelectMember(member)}
                        className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1 group/btn transition"
                      >
                        <span>View Profile</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedMemberForIdCard(member)}
                          className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                          title="View Membership ID Card"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        {canManageMembers && (<button disabled={member._sync_status === 'pending'}
                          onClick={() => openEditModal(member)}
                          className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                          title="Edit Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>)}
                        {canArchive && (member.is_archived ? (
                          <button
                            disabled={member._sync_status === 'pending'} onClick={() => void handleRestoreMember(member)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="Restore member to active congregation"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            disabled={member._sync_status === 'pending'} onClick={() => setMemberToArchive(member)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Archive Member"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'table' ? (
            /* TABLE VIEW */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    <tr>
                      <th className="py-3.5 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                          onChange={handleSelectAllVisible}
                          className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-4">Member Info</th>
                      <th className="py-3.5 px-4">Member ID & Tithe #</th>
                      <th className="py-3.5 px-4">Date Joined</th>
                      <th className="py-3.5 px-4">Contact Details</th>
                      <th className="py-3.5 px-4">Ministry / Cell</th>
                      <th className="py-3.5 px-4">GhanaPost GPS</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedMembers.map((member) => {
                      const isSelected = batchSelectedIds.has(member.id);

                      return (
                        <tr
                          key={member.id}
                          className={`hover:bg-slate-50/80 transition cursor-pointer group ${
                            isSelected ? 'bg-teal-50/30' : ''
                          }`}
                          onClick={() => handleSelectMember(member)}
                        >
                          <td className="py-3 px-4 text-center" onClick={(e) => toggleSelectMember(member.id, e)}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${member.first_name} ${member.last_name}`}
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500 cursor-pointer"
                            />
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {member.profile_photo_url ? (
                                <img
                                  src={member.profile_photo_url}
                                  alt={member.first_name}
                                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                                  {member.first_name[0]}
                                  {member.last_name[0]}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-slate-900 group-hover:text-teal-700 transition">
                                  {member.first_name} {member.middle_name ? `${member.middle_name} ` : ''}
                                  {member.last_name}
                                </span>
                                <div className="text-xs text-slate-400 capitalize">
                                  {member.gender} • {member.marital_status || 'single'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200 w-fit">
                                {member.member_id}
                              </span>
                              {member.tithe_number && (
                                <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200 w-fit">
                                  Tithe #{member.tithe_number}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-xs">
                              <span className="font-semibold text-slate-800 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                {member.membership_date || member.date_joined || 'Foundation'}
                              </span>
                              {member.national_id && (
                                <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                                  {canExportSensitive ? member.national_id : member.national_id.replace(/\d{4}-\d$/i, '••••-•')}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {member.phone}
                              </div>
                              {member.email && (
                                <div className="flex items-center gap-1.5 text-slate-500 truncate max-w-[180px]">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  {member.email}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-xs">
                              <p className="font-semibold text-slate-800">
                                {member.ministry_name || 'None'}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {member.small_group_name || 'No Cell Group'}
                              </p>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {member.gps_address ? (
                              <span className="font-mono text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1 w-fit">
                                <MapPin className="w-3 h-3" />
                                {member.gps_address}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {renderStatusBadge(member, 'sm')}
                          </td>

                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {canGive && (<button disabled={member._sync_status === 'pending'}
                                onClick={() => setSelectedMemberForGiving(member)}
                                className="px-2 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition border border-emerald-200"
                                title="Record Tithe/Giving"
                              >
                                + Give
                              </button>)}
                              <button
                                onClick={() => setSelectedMemberForIdCard(member)}
                                className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition"
                                title="Membership Card"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                              {canManageMembers && (<button disabled={member._sync_status === 'pending'}
                                onClick={() => openEditModal(member)}
                                className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition"
                                title="Edit Details"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>)}
                              {canArchive && (member.is_archived ? (
                                <button
                                  disabled={member._sync_status === 'pending'} onClick={() => void handleRestoreMember(member)}
                                  className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                  title="Restore member to active congregation"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  disabled={member._sync_status === 'pending'} onClick={() => setMemberToArchive(member)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Archive Member"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : viewMode === 'families' ? (
            /* FAMILIES & HOUSEHOLDS DIRECTORY */
            <div className="space-y-6">
              {/* Family Directory Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gradient-to-r from-teal-950 via-teal-900 to-emerald-900 p-4 rounded-2xl text-white shadow-sm border border-teal-800/40">
                <div>
                  <p className="text-[10px] text-teal-300 font-semibold uppercase tracking-wider">Total Family Units</p>
                  <p className="text-xl font-black mt-0.5">{households.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-teal-300 font-semibold uppercase tracking-wider">Multi-Member Families</p>
                  <p className="text-xl font-black mt-0.5 text-amber-300">{multiMemberHouseholdsCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-teal-300 font-semibold uppercase tracking-wider">Married Couples</p>
                  <p className="text-xl font-black mt-0.5 text-rose-300">{marriedHouseholdsCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-teal-300 font-semibold uppercase tracking-wider">Active Members</p>
                  <p className="text-xl font-black mt-0.5 text-teal-100">{filteredMembers.length}</p>
                </div>
              </div>

              {/* Households Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {households.map((household, hIdx) => {
                  const isMulti = household.totalMembers > 1;
                  const waUrl = household.primaryPhone
                    ? buildFamilyBlessingWhatsAppUrl(
                        household.primaryPhone,
                        household.name,
                        household.headOfHousehold.first_name
                      )
                    : null;

                  return (
                    <div
                      key={household.id || `hh-${household.headOfHousehold.id}-${hIdx}`}
                      className={`bg-white rounded-2xl border p-5 shadow-xs transition-all duration-200 flex flex-col justify-between ${
                        isMulti
                          ? 'border-slate-200 hover:border-teal-400 hover:shadow-md'
                          : 'border-slate-200/80 bg-slate-50/30'
                      }`}
                    >
                      <div className="space-y-3.5">
                        {/* Household Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shadow-2xs shrink-0 ${
                                isMulti
                                  ? 'bg-teal-700 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-slate-900 text-base">{household.name}</h3>
                                {household.hasMarriedCouple && (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                    Married Couple
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>Head: <strong>{household.headOfHousehold.first_name} {household.headOfHousehold.last_name}</strong></span>
                                <span>•</span>
                                <span>
                                  {household.totalMembers} Member{household.totalMembers > 1 ? 's' : ''} ({household.adultCount} Adult{household.adultCount !== 1 ? 's' : ''}
                                  {household.childrenCount > 0 ? `, ${household.childrenCount} Child${household.childrenCount > 1 ? 'ren' : ''}` : ''}
                                  {household.youthCount > 0 ? `, ${household.youthCount} Youth` : ''})
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Family Blessing WhatsApp Button */}
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 transition shrink-0"
                              title="Send WhatsApp Family Blessing to this household"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Bless Family</span>
                            </a>
                          )}
                        </div>

                        {/* Location / Contact strip */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                            <span className="truncate max-w-[200px]">{household.residentialAddress}</span>
                          </span>
                          {household.gpsAddress && household.gpsAddress !== 'GA-' && (
                            <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                              {household.gpsAddress}
                            </span>
                          )}
                          {household.primaryPhone && (
                            <span className="flex items-center gap-1 font-mono text-[11px] ml-auto text-slate-600">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {household.primaryPhone}
                            </span>
                          )}
                        </div>

                        {/* Member Cards within this Household */}
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Household Members ({household.members.length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {household.members.map((m) => {
                              const isHead = m.id === household.headOfHousehold.id;
                              const isSpouseOfHead =
                                !isHead &&
                                household.hasMarriedCouple &&
                                areSpouseMatch(household.headOfHousehold, m);

                              const mAge = getMemberAgeGroup(m);
                              let roleTag = isHead
                                ? 'Head of House'
                                : isSpouseOfHead
                                ? m.gender === 'male'
                                  ? 'Spouse (Husband)'
                                  : 'Spouse (Wife)'
                                : mAge === 'child'
                                ? 'Child / Dependent'
                                : mAge === 'youth'
                                ? 'Youth'
                                : 'Family Member';

                              return (
                                <div
                                  key={m.id}
                                  onClick={() => handleSelectMember(m)}
                                  className="p-2.5 bg-white rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 transition cursor-pointer flex items-center justify-between gap-2"
                                  title={`View ${m.first_name}'s full profile`}
                                >
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs shrink-0">
                                      {m.first_name[0]}
                                      {m.last_name[0]}
                                    </div>
                                    <div className="truncate">
                                      <p className="font-bold text-slate-900 text-xs truncate">
                                        {m.first_name} {m.last_name}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-mono truncate">
                                        {m.member_id}
                                      </p>
                                    </div>
                                  </div>

                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap border ${
                                      isHead
                                        ? 'bg-teal-50 text-teal-800 border-teal-200'
                                        : isSpouseOfHead
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {roleTag}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Pagination Controls for Cards and Table views */}
          {viewMode !== 'families' && filteredMembers.length > 0 && renderPaginationControls()}
        </>
      )}

      {/* MODAL 1: ADD / EDIT MEMBER (ENHANCED) */}
      <AddEditMemberModal
        isOpen={isAddModalOpen && canManageMembers}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveMember}
        editingMember={editingMember}
      />

      {/* MODAL 2: QUICK RECORD GIVING */}
      {selectedMemberForGiving && (
        <RecordMemberGivingModal
          isOpen={!!selectedMemberForGiving}
          onClose={() => setSelectedMemberForGiving(null)}
          member={selectedMemberForGiving}
        />
      )}

      {/* MODAL 3: MEMBERSHIP ID CARD */}
      {selectedMemberForIdCard && (
        <MemberIdCardModal
          isOpen={!!selectedMemberForIdCard}
          onClose={() => setSelectedMemberForIdCard(null)}
          member={selectedMemberForIdCard}
          settings={settings}
        />
      )}

      {/* MODAL 4: ARCHIVE MEMBER CONFIRMATION */}
      {memberToArchive && (
        <ArchiveMemberModal
          isOpen={Boolean(memberToArchive)}
          onClose={() => setMemberToArchive(null)}
          onConfirm={handleConfirmArchiveMember}
          member={memberToArchive}
          isProcessing={isArchiving}
        />
      )}

      {/* MODAL 5: FOUNDATION SCHOOL & DISCIPLESHIP */}
      <FoundationSchoolModal
        isOpen={isFoundationSchoolOpen}
        onClose={() => setIsFoundationSchoolOpen(false)}
        cohorts={foundationCohorts}
        students={foundationStudents}
        members={members}
        settings={settings}
        onCreateCohort={createFoundationCohort}
        onEnrollStudent={enrollMemberInFoundationSchool}
        onToggleModule={toggleFoundationModule}
        onGraduateStudent={graduateFoundationStudent}
      />

      {/* MODAL 6: BULK MEMBER OPERATIONS */}
      <BulkMemberOperationsModal
        isOpen={isBulkOperationsOpen && canManageMembers}
        onClose={() => setIsBulkOperationsOpen(false)}
        selectedMembers={selectedMembers}
        ministries={ministries}
        smallGroups={smallGroups}
        foundationCohorts={foundationCohorts}
        onBulkUpdate={handleBulkUpdate}
        onEnrollInCohort={handleBulkEnrollInCohort}
        onClearSelection={() => setBatchSelectedIds(new Set())}
      />

      {isBatchArchiveOpen && canArchive && <BatchArchiveMembersModal
        members={selectedMembers}
        onClose={() => setIsBatchArchiveOpen(false)}
        onConfirm={async () => {
          await bulkUpdateMembers(selectedMembers.map(member => member.id), {is_archived: true});
          info('Archive saved', MEMBER_SAVE_NOTICE);
          setBatchSelectedIds(new Set());
        }}
      />}

      {/* MODAL 7: PRINT MEMBERSHIP DIRECTORY */}
      <PrintDirectoryModal
        isOpen={isPrintDirectoryOpen}
        onClose={() => setIsPrintDirectoryOpen(false)}
        members={
          selectedMembers.length > 0
            ? selectedMembers
            : filteredMembers
        }
        settings={settings}
        filterLabel={
          selectedMembers.length > 0
            ? `${selectedMembers.length} Selected Members`
            : statusFilter !== 'all'
            ? `Status: ${statusFilter}`
            : ministryFilter !== 'all'
            ? `Ministry: ${ministryFilter}`
            : 'All listed congregation members'
        }
      />
    </div>
  );
};
