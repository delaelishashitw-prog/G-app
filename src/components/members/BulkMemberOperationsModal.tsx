import React, { useState } from 'react';
import {
  X,
  Users,
  Building,
  Heart,
  Shield,
  GraduationCap,
  Save,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { Member, Ministry, SmallGroup, FoundationCohort, MembershipStatus } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface BulkMemberOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMembers: Member[];
  ministries: Ministry[];
  smallGroups: SmallGroup[];
  foundationCohorts: FoundationCohort[];
  onBulkUpdate: (memberIds: string[], updates: Partial<Member>) => void;
  onEnrollInCohort: (cohortId: string, cohortName: string, members: Member[]) => void;
  onClearSelection: () => void;
}

export const BulkMemberOperationsModal: React.FC<BulkMemberOperationsModalProps> = ({
  isOpen,
  onClose,
  selectedMembers,
  ministries,
  smallGroups,
  foundationCohorts,
  onBulkUpdate,
  onEnrollInCohort,
  onClearSelection,
}) => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [operationType, setOperationType] = useState<'ministry' | 'small_group' | 'status' | 'discipleship'>('ministry');
  
  // Selections
  const [targetMinistryId, setTargetMinistryId] = useState(ministries[0]?.id || '');
  const [targetGroupId, setTargetGroupId] = useState(smallGroups[0]?.id || '');
  const [targetStatus, setTargetStatus] = useState<MembershipStatus>('active');
  const [targetCohortId, setTargetCohortId] = useState(foundationCohorts[0]?.id || '');

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const memberIds = selectedMembers.map((m) => m.id);

    if (memberIds.length === 0) {
      toastError('No Members Selected', 'Please select at least one member to perform bulk operations.');
      return;
    }

    if (operationType === 'ministry') {
      const selectedMin = ministries.find((m) => m.id === targetMinistryId);
      if (!selectedMin) {
        toastError('Selection Error', 'Please select a valid ministry.');
        return;
      }
      onBulkUpdate(memberIds, {
        ministry_id: selectedMin.id,
        ministry_name: selectedMin.name,
      });
      toastSuccess(
        'Ministry Assigned',
        `Assigned ${memberIds.length} members to ${selectedMin.name}.`
      );
    } else if (operationType === 'small_group') {
      const selectedGrp = smallGroups.find((g) => g.id === targetGroupId);
      if (!selectedGrp) {
        toastError('Selection Error', 'Please select a valid cell fellowship group.');
        return;
      }
      onBulkUpdate(memberIds, {
        small_group_id: selectedGrp.id,
        small_group_name: selectedGrp.name,
      });
      toastSuccess(
        'Cell Group Assigned',
        `Assigned ${memberIds.length} members to ${selectedGrp.name}.`
      );
    } else if (operationType === 'status') {
      onBulkUpdate(memberIds, {
        status: targetStatus,
      });
      toastSuccess(
        'Status Updated',
        `Updated membership status to "${targetStatus.replace('_', ' ')}" for ${memberIds.length} members.`
      );
    } else if (operationType === 'discipleship') {
      const selectedCohort = foundationCohorts.find((c) => c.id === targetCohortId);
      if (!selectedCohort) {
        toastError('Selection Error', 'Please select a valid Foundation School cohort.');
        return;
      }
      onEnrollInCohort(selectedCohort.id, selectedCohort.name, selectedMembers);
      toastSuccess(
        'Foundation School Enrollment',
        `Enrolled ${memberIds.length} members into ${selectedCohort.name}.`
      );
    }

    onClearSelection();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Users className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Bulk Member Operations</h3>
              <p className="text-xs text-emerald-200">
                Batch apply ministry, cell, discipleship, or status to {selectedMembers.length} selected members
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
        <form onSubmit={handleApply} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Selected Members Preview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Target Members ({selectedMembers.length})
              </span>
              <span className="text-[10px] text-emerald-800 font-bold">Multi-select active</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-100">
              {selectedMembers.map((m) => (
                <span
                  key={m.id}
                  className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px] border border-slate-200 flex items-center gap-1"
                >
                  <span>{m.first_name} {m.last_name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Operation Type Switcher */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Select Batch Operation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOperationType('ministry')}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2 ${
                  operationType === 'ministry'
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Building className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold">Assign Ministry</span>
                  <span className="text-[10px] text-slate-500 font-normal">Choir, Ushers, Media...</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOperationType('small_group')}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2 ${
                  operationType === 'small_group'
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Heart className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold">Assign Cell Group</span>
                  <span className="text-[10px] text-slate-500 font-normal">Community fellowships</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOperationType('status')}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2 ${
                  operationType === 'status'
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold">Update Status</span>
                  <span className="text-[10px] text-slate-500 font-normal">Active, Leader, Convert...</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOperationType('discipleship')}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2 ${
                  operationType === 'discipleship'
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="block font-bold">Foundation School</span>
                  <span className="text-[10px] text-slate-500 font-normal">Enroll in discipleship</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Inputs based on Operation Type */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            {operationType === 'ministry' && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Target Ministry Department
                </label>
                <select
                  value={targetMinistryId}
                  onChange={(e) => setTargetMinistryId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600"
                >
                  {ministries.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.leader_name || 'Leader not set'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  All {selectedMembers.length} members will have their primary ministry assignment updated immediately.
                </p>
              </div>
            )}

            {operationType === 'small_group' && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Target Small Group / Cell Fellowship
                </label>
                <select
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600"
                >
                  {smallGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} — {g.zone || g.meeting_location || 'Cell Fellowship'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Connects selected members into pastoral cell tracking and home fellowship meetings.
                </p>
              </div>
            )}

            {operationType === 'status' && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  New Membership Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as MembershipStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600"
                >
                  <option value="active">Active Communicant Member</option>
                  <option value="new_convert">New Convert (Born Again)</option>
                  <option value="new_member">New Member (Transferred)</option>
                  <option value="leader">Ministerial Leader</option>
                  <option value="inactive">Inactive Member</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Updates congregational registry classification and reporting badges.
                </p>
              </div>
            )}

            {operationType === 'discipleship' && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Foundation School Cohort
                </label>
                <select
                  value={targetCohortId}
                  onChange={(e) => setTargetCohortId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold focus:outline-emerald-600"
                >
                  {foundationCohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status.toUpperCase()}) — Instructor: {c.instructor_name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enrolls selected members into discipleship tracking across the 5 curriculum modules and water baptism preparation.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
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
              <span>Apply to {selectedMembers.length} Members</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
