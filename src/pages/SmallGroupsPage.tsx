import React, { useState, useMemo } from 'react';
import {
  Network,
  Users,
  MapPin,
  Plus,
  Clock,
  Phone,
  Search,
  Filter,
  Calendar,
  DollarSign,
  FileText,
  Printer,
  ChevronRight,
  UserPlus,
  CheckCircle2,
  BookOpen,
  MessageCircle,
  X,
  Sparkles,
  TrendingUp,
  HeartHandshake,
  UserCheck,
  Building,
  ExternalLink
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { formatGHS } from '../lib/currencyUtils';

interface CellMeetingReport {
  id: string;
  group_id: string;
  group_name: string;
  date: string;
  topic: string;
  scripture: string;
  leader_name: string;
  attendance_men: number;
  attendance_women: number;
  attendance_children: number;
  attendance_visitors: number;
  total_attendance: number;
  offering_amount: number;
  prayer_requests: string;
  testimonies: string;
}

export const SmallGroupsPage: React.FC = () => {
  const { smallGroups, members, addSmallGroup, updateMember } = useChurchData();

  // State
  const [activeTab, setActiveTab] = useState<'cells' | 'reports' | 'zones'>('cells');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedDay, setSelectedDay] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGroupForRoster, setSelectedGroupForRoster] = useState<any | null>(null);
  const [selectedGroupForReport, setSelectedGroupForReport] = useState<any | null>(null);
  const [isAssignMemberModalOpen, setIsAssignMemberModalOpen] = useState(false);
  const [memberToAssignId, setMemberToAssignId] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // New Cell Form Data
  const [formData, setFormData] = useState({
    name: '',
    zone: 'Joma West',
    meeting_address: '',
    meeting_day: 'Wednesday',
    meeting_time: '19:00',
    leader_name: '',
    leader_phone: '+233 24 ',
    assistant_leader: '',
    host_name: '',
  });

  // Cell Meeting Reports state (persisted in local state with realistic seed data)
  const [meetingReports, setMeetingReports] = useState<CellMeetingReport[]>([
    {
      id: 'rep-1',
      group_id: smallGroups[0]?.id || '1',
      group_name: smallGroups[0]?.name || 'Joma Grace Center',
      date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      topic: 'Walking in Supernatural Authority',
      scripture: 'Luke 10:19',
      leader_name: smallGroups[0]?.leader_name || 'Bro. Emmanuel Mensah',
      attendance_men: 5,
      attendance_women: 8,
      attendance_children: 4,
      attendance_visitors: 2,
      total_attendance: 19,
      offering_amount: 280.00,
      prayer_requests: 'Healing for Mama Serwaa; Safe travel for brother Isaac travelling to Kumasi.',
      testimonies: 'Sister Grace testified of securing a new teaching appointment after 6 months prayer.'
    },
    {
      id: 'rep-2',
      group_id: smallGroups[1]?.id || '2',
      group_name: smallGroups[1]?.name || 'Ablekuma Sector Fellowship',
      date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
      topic: 'The Power of Prevailing Prayer',
      scripture: 'James 5:16b',
      leader_name: smallGroups[1]?.leader_name || 'Deacon Daniel Osei',
      attendance_men: 6,
      attendance_women: 7,
      attendance_children: 3,
      attendance_visitors: 1,
      total_attendance: 17,
      offering_amount: 215.50,
      prayer_requests: 'Academic breakthrough for BECE and WASSCE candidates in the fellowship.',
      testimonies: 'Deacon Osei shared God miraculous provision for church outreach materials.'
    },
    {
      id: 'rep-3',
      group_id: smallGroups[2]?.id || '3',
      group_name: smallGroups[2]?.name || 'Weija Foothills Cell',
      date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
      topic: 'Rooted and Grounded in Love',
      scripture: 'Ephesians 3:17-19',
      leader_name: smallGroups[2]?.leader_name || 'Sis. Abigail Addo',
      attendance_men: 4,
      attendance_women: 9,
      attendance_children: 5,
      attendance_visitors: 3,
      total_attendance: 21,
      offering_amount: 340.00,
      prayer_requests: 'Peace in the family of one of the new visitors.',
      testimonies: 'New family of four received Christ during the home fellowship.'
    }
  ]);

  // New Report Form
  const [reportForm, setReportForm] = useState({
    date: new Date().toISOString().split('T')[0],
    topic: '',
    scripture: '',
    attendance_men: 4,
    attendance_women: 6,
    attendance_children: 2,
    attendance_visitors: 1,
    offering_amount: 150,
    prayer_requests: '',
    testimonies: ''
  });

  // Extract unique zones
  const zones = useMemo(() => {
    const list = Array.from(new Set(smallGroups.map((g) => g.zone || 'Unassigned'))).filter(Boolean);
    return list.sort();
  }, [smallGroups]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return smallGroups.filter((group) => {
      const matchesSearch =
        group.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.leader_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.meeting_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.zone?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesZone = selectedZone === 'ALL' || group.zone === selectedZone;
      const matchesDay = selectedDay === 'ALL' || group.meeting_day === selectedDay;

      return matchesSearch && matchesZone && matchesDay;
    });
  }, [smallGroups, searchQuery, selectedZone, selectedDay]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalCells = smallGroups.length;
    const totalAssignedDisciples = members.filter((m) => !!m.small_group_id || !!m.small_group_name).length;
    const totalChurchMembers = members.length;
    const involvementPercentage = totalChurchMembers > 0
      ? Math.round((totalAssignedDisciples / totalChurchMembers) * 100)
      : 0;

    const totalReportsOfferings = meetingReports.reduce((acc, r) => acc + (r.offering_amount || 0), 0);
    const avgAttendance = meetingReports.length > 0
      ? Math.round(meetingReports.reduce((acc, r) => acc + r.total_attendance, 0) / meetingReports.length)
      : 0;

    return {
      totalCells,
      totalAssignedDisciples,
      involvementPercentage,
      totalReportsOfferings,
      avgAttendance
    };
  }, [smallGroups, members, meetingReports]);

  // Handle Add Small Group
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    addSmallGroup({
      name: formData.name,
      zone: formData.zone,
      meeting_address: formData.meeting_address,
      meeting_day: formData.meeting_day,
      meeting_time: formData.meeting_time,
      leader_name: formData.leader_name || 'Elder / Cell Leader',
      leader_phone: formData.leader_phone || '+233 24 000 0000',
    });
    setIsAddModalOpen(false);
    setFormData({
      name: '',
      zone: 'Joma West',
      meeting_address: '',
      meeting_day: 'Wednesday',
      meeting_time: '19:00',
      leader_name: '',
      leader_phone: '+233 24 ',
      assistant_leader: '',
      host_name: '',
    });
  };

  // Handle Member Assignment to Cell
  const handleAssignMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToAssignId || !selectedGroupForRoster) return;

    if (updateMember) {
      updateMember(memberToAssignId, {
        small_group_id: selectedGroupForRoster.id,
        small_group_name: selectedGroupForRoster.name
      });
    }

    setMemberToAssignId('');
    setIsAssignMemberModalOpen(false);
  };

  // Remove Member from Cell
  const handleRemoveFromCell = (memberId: string) => {
    if (confirm('Remove this member from the cell fellowship roster?')) {
      if (updateMember) {
        updateMember(memberId, {
          small_group_id: undefined,
          small_group_name: undefined
        });
      }
    }
  };

  // Handle Submit Meeting Report
  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupForReport) return;

    const total =
      Number(reportForm.attendance_men || 0) +
      Number(reportForm.attendance_women || 0) +
      Number(reportForm.attendance_children || 0) +
      Number(reportForm.attendance_visitors || 0);

    const newRep: CellMeetingReport = {
      id: `rep-${Date.now()}`,
      group_id: selectedGroupForReport.id,
      group_name: selectedGroupForReport.name,
      date: reportForm.date,
      topic: reportForm.topic || 'Cell Fellowship & Word Study',
      scripture: reportForm.scripture || 'Acts 2:42-47',
      leader_name: selectedGroupForReport.leader_name,
      attendance_men: Number(reportForm.attendance_men || 0),
      attendance_women: Number(reportForm.attendance_women || 0),
      attendance_children: Number(reportForm.attendance_children || 0),
      attendance_visitors: Number(reportForm.attendance_visitors || 0),
      total_attendance: total,
      offering_amount: Number(reportForm.offering_amount || 0),
      prayer_requests: reportForm.prayer_requests,
      testimonies: reportForm.testimonies
    };

    setMeetingReports([newRep, ...meetingReports]);
    setSelectedGroupForReport(null);
    setReportForm({
      date: new Date().toISOString().split('T')[0],
      topic: '',
      scripture: '',
      attendance_men: 4,
      attendance_women: 6,
      attendance_children: 2,
      attendance_visitors: 1,
      offering_amount: 150,
      prayer_requests: '',
      testimonies: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 to-[#064e3b] p-6 rounded-3xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Network className="w-5 h-5 text-emerald-200" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Discipleship & Community Care
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Small Groups & Community Cells
          </h1>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-xl">
            Home cell fellowships across Joma, Ablekuma, Weija, Anyaa, and surrounding sectors.
            Fostering pastoral care, biblical fellowship, and community evangelism.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 transition border border-white/20"
          >
            <Printer className="w-4 h-4" />
            <span>Print Directory</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Add New Cell Group</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Active Cell Fellowships</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.totalCells}</p>
            <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <Building className="w-3 h-3" /> Across {zones.length} sectors
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Network className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Disciples In Cells</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.totalAssignedDisciples}</p>
            <p className="text-[10px] text-blue-600 font-medium flex items-center gap-1 mt-0.5">
              <UserCheck className="w-3 h-3" /> {stats.involvementPercentage}% church connection
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Average Cell Attendance</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.avgAttendance || 18}</p>
            <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3" /> Healthy fellowship size
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <HeartHandshake className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Cell Offerings (Month)</p>
            <p className="text-2xl font-extrabold text-emerald-800 mt-1">{formatGHS(stats.totalReportsOfferings)}</p>
            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <DollarSign className="w-3 h-3" /> From weekly cell reports
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('cells')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'cells'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Cell Directory ({filteredGroups.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'reports'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Weekly Meeting Reports ({meetingReports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('zones')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'zones'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Sectors & Zones ({zones.length})</span>
        </button>
      </div>

      {/* TAB 1: CELLS DIRECTORY */}
      {activeTab === 'cells' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cell name, leader, location..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-emerald-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Zone:</span>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-xs"
                >
                  <option value="ALL">All Zones ({smallGroups.length})</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Day:</span>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-xs"
                >
                  <option value="ALL">All Days</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>
            </div>
          </div>

          {/* Small Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => {
              const membersInGroup = members.filter(
                (m) => m.small_group_id === group.id || m.small_group_name === group.name
              );

              return (
                <div
                  key={group.id}
                  className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-900">
                          {group.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{group.meeting_address || 'Address pending'}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {group.zone || 'General'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600">
                      <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong className="text-slate-900">{group.meeting_day}s</strong> at{' '}
                        <strong className="text-slate-900">{group.meeting_time}</strong>
                      </span>
                    </div>

                    {/* Leader Details */}
                    <div className="p-3 border border-slate-100 rounded-xl space-y-1.5 text-xs bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Cell Leader:</span>
                        <span className="font-bold text-slate-800">{group.leader_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Phone:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-600">{group.leader_phone}</span>
                          {group.leader_phone && (
                            <a
                              href={`tel:${group.leader_phone}`}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition"
                              title="Call Leader"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          )}
                          {group.leader_phone && (
                            <a
                              href={`https://wa.me/${group.leader_phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-green-600 hover:bg-green-50 rounded-md transition"
                              title="WhatsApp Leader"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Member Count & Avatars Preview */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center -space-x-2">
                        {membersInGroup.slice(0, 4).map((m, idx) => (
                          <div
                            key={m.id || idx}
                            className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-emerald-800 shadow-2xs"
                            title={`${m.first_name} ${m.last_name}`}
                          >
                            {m.first_name?.[0] || 'M'}
                          </div>
                        ))}
                        {membersInGroup.length > 4 && (
                          <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-2xs">
                            +{membersInGroup.length - 4}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                          {membersInGroup.length} disciples
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedGroupForRoster(group)}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Roster ({membersInGroup.length})</span>
                    </button>
                    <button
                      onClick={() => setSelectedGroupForReport(group)}
                      className="py-2 px-3 bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                      title="Log Weekly Cell Meeting Report"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Report</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredGroups.length === 0 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Network className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700">No Cell Groups Match Your Filter</h3>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or zone filter.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedZone('ALL');
                  setSelectedDay('ALL');
                }}
                className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEEKLY MEETING REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Weekly Cell Meeting Logs & Attendance</h3>
              <p className="text-xs text-slate-500">
                Tracked reports submitted by cell leaders including offering and scripture focus.
              </p>
            </div>

            <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              Total Cell Giving Recorded: {formatGHS(stats.totalReportsOfferings)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetingReports.map((report) => (
              <div
                key={report.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">
                      {report.group_name}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 mt-1.5 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-700" />
                      {report.topic}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono">Scripture: {report.scripture}</p>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {new Date(report.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 p-2 bg-slate-50 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Men</span>
                    <strong className="text-slate-800">{report.attendance_men}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Women</span>
                    <strong className="text-slate-800">{report.attendance_women}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Children</span>
                    <strong className="text-slate-800">{report.attendance_children}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Visitors</span>
                    <strong className="text-emerald-700">+{report.attendance_visitors}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 font-medium">Total Attendance:</span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    {report.total_attendance} attendees
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Offering Harvest:</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {formatGHS(report.offering_amount)}
                  </span>
                </div>

                {report.testimonies && (
                  <div className="p-2.5 bg-amber-50/60 rounded-xl text-xs text-amber-900 border border-amber-100">
                    <strong className="block font-semibold text-amber-800 mb-0.5">Testimony:</strong>
                    {report.testimonies}
                  </div>
                )}

                {report.prayer_requests && (
                  <div className="p-2.5 bg-blue-50/60 rounded-xl text-xs text-blue-900 border border-blue-100">
                    <strong className="block font-semibold text-blue-800 mb-0.5">Prayer Target:</strong>
                    {report.prayer_requests}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Leader: {report.leader_name}</span>
                  <span className="text-emerald-700 font-medium">Verified</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ZONES OVERVIEW */}
      {activeTab === 'zones' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zoneName) => {
            const groupsInZone = smallGroups.filter((g) => g.zone === zoneName);
            const totalDisciples = members.filter((m) =>
              groupsInZone.some((g) => g.id === m.small_group_id || g.name === m.small_group_name)
            ).length;

            return (
              <div
                key={zoneName}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4 hover:border-emerald-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{zoneName}</h4>
                      <p className="text-[11px] text-slate-400">{groupsInZone.length} active cell units</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    {totalDisciples} disciples
                  </span>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-700">Cells In This Sector:</p>
                  {groupsInZone.map((grp) => (
                    <div
                      key={grp.id}
                      onClick={() => {
                        setSelectedGroupForRoster(grp);
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-emerald-50 rounded-xl text-xs flex items-center justify-between cursor-pointer transition border border-transparent hover:border-emerald-200"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{grp.name}</p>
                        <p className="text-[11px] text-slate-500">{grp.leader_name} • {grp.meeting_day}s</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ROSTER / CELL MEMBERS MODAL */}
      {selectedGroupForRoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  {selectedGroupForRoster.zone} Sector
                </span>
                <h3 className="text-base font-bold text-white">{selectedGroupForRoster.name} Roster</h3>
              </div>
              <button
                onClick={() => setSelectedGroupForRoster(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Group Quick Info */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Cell Leader</span>
                  <strong className="text-slate-900">{selectedGroupForRoster.leader_name}</strong>
                  <span className="text-slate-500 font-mono block">{selectedGroupForRoster.leader_phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Meeting Schedule</span>
                  <strong className="text-slate-900">
                    {selectedGroupForRoster.meeting_day}s at {selectedGroupForRoster.meeting_time}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Meeting Location</span>
                  <span className="text-slate-700 truncate block">{selectedGroupForRoster.meeting_address}</span>
                </div>
              </div>

              {/* Roster List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Assigned Church Disciples (
                    {
                      members.filter(
                        (m) =>
                          m.small_group_id === selectedGroupForRoster.id ||
                          m.small_group_name === selectedGroupForRoster.name
                      ).length
                    }
                    )
                  </h4>
                  <button
                    onClick={() => setIsAssignMemberModalOpen(true)}
                    className="px-3 py-1.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Assign Member</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {members
                    .filter(
                      (m) =>
                        m.small_group_id === selectedGroupForRoster.id ||
                        m.small_group_name === selectedGroupForRoster.name
                    )
                    .map((m) => (
                      <div
                        key={m.id}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                            {m.first_name?.[0]}
                            {m.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-900">
                              {m.first_name} {m.last_name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {m.phone || 'No phone recorded'} • {(m as any).residential_address || (m as any).residence_location || (m as any).address || 'Joma'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {m.phone && (
                            <a
                              href={`tel:${m.phone}`}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {m.phone && (
                            <a
                              href={`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleRemoveFromCell(m.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition text-xs"
                            title="Remove from cell"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                  {members.filter(
                    (m) =>
                      m.small_group_id === selectedGroupForRoster.id ||
                      m.small_group_name === selectedGroupForRoster.name
                  ).length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No members assigned to this cell group yet. Click <strong>Assign Member</strong> above to add members.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedGroupForRoster(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MEMBER MODAL */}
      {isAssignMemberModalOpen && selectedGroupForRoster && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Assign Member to {selectedGroupForRoster.name}</h3>
              <button
                onClick={() => setIsAssignMemberModalOpen(false)}
                className="p-1 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignMember} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Church Member</label>
                <select
                  value={memberToAssignId}
                  onChange={(e) => setMemberToAssignId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-emerald-600"
                >
                  <option value="">-- Choose a member --</option>
                  {members
                    .filter((m) => m.small_group_id !== selectedGroupForRoster.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({(m as any).residential_address || (m as any).residence_location || (m as any).address || 'Joma'})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Assigning will update the member record with this cell fellowship.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignMemberModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!memberToAssignId}
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl font-bold shadow-md"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG MEETING REPORT MODAL */}
      {selectedGroupForReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  Weekly Fellowship Report
                </span>
                <h3 className="text-base font-bold text-white">{selectedGroupForReport.name}</h3>
              </div>
              <button
                onClick={() => setSelectedGroupForReport(null)}
                className="p-1 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="p-6 space-y-3.5 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Date *</label>
                  <input
                    type="date"
                    required
                    value={reportForm.date}
                    onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Offering Collected (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={reportForm.offering_amount}
                    onChange={(e) => setReportForm({ ...reportForm, offering_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-800"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Word Topic / Theme *</label>
                <input
                  type="text"
                  required
                  value={reportForm.topic}
                  onChange={(e) => setReportForm({ ...reportForm, topic: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Walking in Divine Protection"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Scripture Reference</label>
                <input
                  type="text"
                  value={reportForm.scripture}
                  onChange={(e) => setReportForm({ ...reportForm, scripture: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  placeholder="e.g. Psalm 91:1-4; Hebrews 11:1"
                />
              </div>

              {/* Attendance Breakdown */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-semibold text-slate-800 mb-2">Attendance Breakdown</label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Men</span>
                    <input
                      type="number"
                      min="0"
                      value={reportForm.attendance_men}
                      onChange={(e) => setReportForm({ ...reportForm, attendance_men: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Women</span>
                    <input
                      type="number"
                      min="0"
                      value={reportForm.attendance_women}
                      onChange={(e) => setReportForm({ ...reportForm, attendance_women: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Children</span>
                    <input
                      type="number"
                      min="0"
                      value={reportForm.attendance_children}
                      onChange={(e) => setReportForm({ ...reportForm, attendance_children: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Visitors</span>
                    <input
                      type="number"
                      min="0"
                      value={reportForm.attendance_visitors}
                      onChange={(e) => setReportForm({ ...reportForm, attendance_visitors: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs text-center text-emerald-700 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Testimonies Recorded</label>
                <textarea
                  rows={2}
                  value={reportForm.testimonies}
                  onChange={(e) => setReportForm({ ...reportForm, testimonies: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Bro. Kwame gave thanks for safe childbirth..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Prayer Requests & Pastoral Needs</label>
                <textarea
                  rows={2}
                  value={reportForm.prayer_requests}
                  onChange={(e) => setReportForm({ ...reportForm, prayer_requests: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Sister Comfort's mother in hospital; job seeker prayers..."
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedGroupForReport(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold shadow-md"
                >
                  Save Meeting Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CELL GROUP MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Create New Cell Fellowship</h3>
                <p className="text-[11px] text-emerald-200">Establish a new community home fellowship center</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-white/80 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cell Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Joma Grace Center or Ablekuma Victory Cell"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Zone / Sector *</label>
                  <input
                    type="text"
                    required
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="e.g. Joma West, Ablekuma, Weija"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Day</label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Wednesday">Wednesday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Time</label>
                  <input
                    type="time"
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Leader Phone</label>
                  <input
                    type="tel"
                    value={formData.leader_phone}
                    onChange={(e) => setFormData({ ...formData, leader_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    placeholder="+233 24 000 0000"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cell Leader Full Name</label>
                <input
                  type="text"
                  value={formData.leader_name}
                  onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Bro. Emmanuel Mensah"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Meeting Address / Host Residence</label>
                <input
                  type="text"
                  value={formData.meeting_address}
                  onChange={(e) => setFormData({ ...formData, meeting_address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Deaconess Comfort residence, Joma New Site near clinic"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold shadow-md"
                >
                  Create Small Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT DIRECTORY MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between no-print">
              <div>
                <h3 className="text-sm font-bold">Print Cell Fellowship Directory</h3>
                <p className="text-[11px] text-slate-300">Ready for physical pastoral handouts or PDF save</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto flex-1 space-y-6 print:p-0">
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold text-slate-900">GREATER WORKS CITY CHURCH</h2>
                <p className="text-xs text-slate-600">Joma, Accra, Ghana • Home Cell & Small Groups Directory</p>
                <p className="text-[10px] text-slate-400 mt-1">Generated: {new Date().toLocaleDateString('en-GB')}</p>
              </div>

              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-50 font-bold text-slate-700">
                  <tr>
                    <th className="p-2.5 border-b">Cell Name</th>
                    <th className="p-2.5 border-b">Zone</th>
                    <th className="p-2.5 border-b">Day & Time</th>
                    <th className="p-2.5 border-b">Cell Leader</th>
                    <th className="p-2.5 border-b">Leader Contact</th>
                    <th className="p-2.5 border-b">Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {smallGroups.map((g) => (
                    <tr key={g.id}>
                      <td className="p-2.5 font-bold">{g.name}</td>
                      <td className="p-2.5">{g.zone}</td>
                      <td className="p-2.5">{g.meeting_day}s @ {g.meeting_time}</td>
                      <td className="p-2.5">{g.leader_name}</td>
                      <td className="p-2.5 font-mono">{g.leader_phone}</td>
                      <td className="p-2.5 text-slate-600">{g.meeting_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
