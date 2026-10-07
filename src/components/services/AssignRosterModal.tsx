import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Calendar,
  Clock,
  Building,
  AlertTriangle,
  CheckCircle2,
  Save,
  Search,
  Tag,
  Phone,
} from 'lucide-react';
import {
  ChurchService,
  Member,
  RosterAssignment,
  RosterDepartment,
  RosterAssignmentStatus,
} from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface AssignRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: ChurchService[];
  members: Member[];
  existingAssignments: RosterAssignment[];
  onSave: (assignmentData: Omit<RosterAssignment, 'id' | 'created_at'>) => void;
  initialServiceId?: string;
  initialDate?: string;
}

const DEPARTMENTS: { value: RosterDepartment; label: string; roles: string[] }[] = [
  {
    value: 'sound_media',
    label: 'Sound & Media Technical',
    roles: [
      'Lead FOH Sound Engineer',
      'Livestream & Camera Operator',
      'Projection & Media Screens',
      'Audio Recording & Stage Patch',
      'Social Media Live Streamer',
    ],
  },
  {
    value: 'praise_team',
    label: 'Voice of Dominion (Praise & Choir)',
    roles: [
      'Worship Leader',
      'Lead Keyboardist / Organist',
      'Drummer',
      'Bass Guitarist',
      'Lead Soprano / Vocalist',
      'Choir Director',
    ],
  },
  {
    value: 'ushers_protocol',
    label: 'Ushers & Royal Protocol',
    roles: [
      'Main Entrance Head Usher',
      'Auditorium Seating Marshal',
      'Offering & Tithe Bag Usher',
      'VIP Pastoral Protocol Host',
      'First-Time Visitor Greeter',
    ],
  },
  {
    value: 'intercessors',
    label: 'Altar & Intercessory Board',
    roles: [
      'Pre-Service Altar Intercession Lead',
      'During-Service Prayer Support',
      'Altar Call Ministry Counselor',
      'Deliverance & Healing Assistant',
    ],
  },
  {
    value: 'children_ministry',
    label: "Children's Ministry (Sunday School)",
    roles: [
      'Hannah Hall (Nursery 0-3) Attendant',
      'Samuel Hall (Beginners 4-6) Teacher',
      'David Hall (Juniors 7-9) Teacher',
      'Timothy Hall (Pre-Teens 10-12) Teacher',
      'Security & Pickup Tag Gatekeeper',
    ],
  },
  {
    value: 'car_park_security',
    label: 'Compound & Car Park Security',
    roles: [
      'Main Gate Traffic Controller',
      'Car Park Marshall',
      'Sanctuary Compound Patrol',
      'Emergency Route Coordinator',
    ],
  },
  {
    value: 'sanctuary_cleaning',
    label: 'Sanctuary Care & Sanitation',
    roles: [
      'Pre-Service Sanctuary Preparation',
      'Communion Table Prep & Care',
      'Post-Service Sanitization Lead',
    ],
  },
];

export const AssignRosterModal: React.FC<AssignRosterModalProps> = ({
  isOpen,
  onClose,
  services,
  members,
  existingAssignments,
  onSave,
  initialServiceId,
  initialDate,
}) => {
  const { error: toastError, success: toastSuccess, warning: toastWarning } = useToast();

  const [serviceId, setServiceId] = useState(initialServiceId || services[0]?.id || '');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [department, setDepartment] = useState<RosterDepartment>('sound_media');
  const [roleTitle, setRoleTitle] = useState('Lead FOH Sound Engineer');
  const [reportTime, setReportTime] = useState('07:30 AM');
  const [status, setStatus] = useState<RosterAssignmentStatus>('confirmed');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const currentService = services.find((s) => s.id === serviceId) || services[0];
  const selectedMember = members.find((m) => m.id === selectedMemberId);

  // Suggested roles for selected department
  const currentDeptConfig = DEPARTMENTS.find((d) => d.value === department);
  const suggestedRoles = currentDeptConfig?.roles || [];

  // Filtered member options for search
  const filteredMembers = members.filter((m) => {
    const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
    const phone = m.phone.toLowerCase();
    const search = memberSearch.toLowerCase();
    return fullName.includes(search) || phone.includes(search);
  });

  // Real-Time Conflict Detection Preview
  const conflictDetection = useMemo(() => {
    if (!selectedMemberId || !date) return null;

    const memberOtherAssignments = existingAssignments.filter(
      (a) => a.member_id === selectedMemberId && a.date === date
    );

    if (memberOtherAssignments.length === 0) return null;

    const sameServiceConflict = memberOtherAssignments.some((a) => a.service_id === serviceId);

    return {
      hasConflict: true,
      sameServiceConflict,
      assignments: memberOtherAssignments,
      message: sameServiceConflict
        ? `Double-Booking Alert: This volunteer is ALREADY assigned to ${memberOtherAssignments
            .map((a) => `[${a.department.replace('_', ' ')}: ${a.role_title}]`)
            .join(' and ')} for this service on ${date}!`
        : `Cross-Service Notice: This volunteer has another assignment on ${date} (${memberOtherAssignments
            .map((a) => `${a.service_name} at ${a.report_time}`)
            .join(', ')}).`,
    };
  }, [selectedMemberId, date, serviceId, existingAssignments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMember) {
      toastError('Validation Error', 'Please select a volunteer or church member.');
      return;
    }
    if (!roleTitle.trim()) {
      toastError('Validation Error', 'Please specify a duty role title.');
      return;
    }

    if (conflictDetection?.sameServiceConflict) {
      toastWarning('Conflict Detected', `${selectedMember.first_name} was saved with a concurrent assignment.`);
    }

    onSave({
      service_id: currentService.id,
      service_name: currentService.name,
      date,
      member_id: selectedMember.id,
      member_name: `${selectedMember.first_name} ${selectedMember.last_name}`,
      member_phone: selectedMember.phone,
      department,
      role_title: roleTitle.trim(),
      report_time: reportTime,
      status,
      notes: notes.trim() || undefined,
    });

    toastSuccess(
      'Volunteer Scheduled',
      `${selectedMember.first_name} ${selectedMember.last_name} assigned as ${roleTitle} (${department.replace('_', ' ')}).`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Users className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Assign Volunteer / Duty Roster</h3>
              <p className="text-xs text-emerald-200">
                Multi-department scheduling with real-time conflict detection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-emerald-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Service & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Target Church Service <span className="text-rose-500">*</span>
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-semibold focus:outline-emerald-600"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.day_of_week})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Service Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
            </div>
          </div>

          {/* Member Search & Selection */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Select Volunteer / Church Member <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Type volunteer name or phone number..."
                  className="w-full pl-8.5 pr-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-medium focus:bg-white focus:outline-emerald-600 text-xs"
                />
              </div>

              <select
                required
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-semibold focus:outline-emerald-600"
                size={4}
              >
                <option value="" disabled>
                  -- Select Volunteer from Congregation --
                </option>
                {filteredMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} ({m.phone}) — {m.ministry_name || m.small_group_name || 'General Congregation'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conflict Alert Banner if detected! */}
          {conflictDetection && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                conflictDetection.sameServiceConflict
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  conflictDetection.sameServiceConflict ? 'text-rose-600' : 'text-amber-600'
                }`}
              />
              <div className="space-y-0.5">
                <span className="font-bold block">
                  {conflictDetection.sameServiceConflict ? 'Double-Booking Warning!' : 'Scheduling Advisory'}
                </span>
                <p className="text-[11px] leading-relaxed">{conflictDetection.message}</p>
              </div>
            </div>
          )}

          {/* Department & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Department / Board <span className="text-rose-500">*</span>
              </label>
              <select
                value={department}
                onChange={(e) => {
                  const newDept = e.target.value as RosterDepartment;
                  setDepartment(newDept);
                  const cfg = DEPARTMENTS.find((d) => d.value === newDept);
                  if (cfg?.roles[0]) setRoleTitle(cfg.roles[0]);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-semibold focus:outline-emerald-600"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.value} value={dept.value}>
                    {dept.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Role Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="roles-list"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Lead FOH Sound Engineer"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600"
              />
              <datalist id="roles-list">
                {suggestedRoles.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Report Time & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Required Call / Report Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={reportTime}
                onChange={(e) => setReportTime(e.target.value)}
                placeholder="e.g. 07:30 AM"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-semibold focus:outline-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Assignment Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RosterAssignmentStatus)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-semibold focus:outline-emerald-600"
              >
                <option value="confirmed">Confirmed / Accepted</option>
                <option value="pending">Pending Confirmation</option>
                <option value="substituted">Substitute Requested</option>
                <option value="declined">Declined / Unavailable</option>
              </select>
            </div>
          </div>

          {/* Notes / Special Instructions */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Duty Notes & Ministerial Instructions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Arrive 30 mins prior for altar prayer; coordinate with head of sound booth..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-emerald-600 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>Confirm Assignment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
