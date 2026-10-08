import type { Dispatch, SetStateAction } from 'react';
import type {
  AssetMaintenanceLog,
  ChurchAsset,
  FoundationCohort,
  FoundationStudent,
  FoundationStudentStatus,
  Member,
  RosterAssignment,
  RosterConflict,
} from '../../types/database.types';

export function addAsset(
  data: Omit<ChurchAsset, 'id' | 'created_at'>,
  setAssets: Dispatch<SetStateAction<ChurchAsset[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
): ChurchAsset {
  const newAsset: ChurchAsset = {
    ...data,
    id: `ast-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setAssets((prev) => [newAsset, ...prev]);
  logAction(
    'CREATE_ASSET',
    'Inventory',
    `Registered asset [${data.asset_tag}] ${data.name} (${data.category}) valued at GH₵ ${data.purchase_cost.toFixed(2)}`,
    newAsset.id
  );
  return newAsset;
}

export function updateAsset(
  id: string,
  updates: Partial<ChurchAsset>,
  setAssets: Dispatch<SetStateAction<ChurchAsset[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  setAssets((prev) =>
    prev.map((asset) => {
      if (asset.id !== id) return asset;

      const updated = {
        ...asset,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      logAction(
        'UPDATE_ASSET',
        'Inventory',
        `Updated asset [${asset.asset_tag}] ${asset.name} (Condition: ${updates.current_condition || asset.current_condition})`,
        id
      );
      return updated;
    })
  );
}

export function deleteAsset(
  id: string,
  assets: ChurchAsset[],
  setAssets: Dispatch<SetStateAction<ChurchAsset[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  const toDelete = assets.find((asset) => asset.id === id);
  setAssets((prev) => prev.filter((asset) => asset.id !== id));
  if (toDelete) {
    logAction(
      'DELETE_ASSET',
      'Inventory',
      `Decommissioned/deleted asset [${toDelete.asset_tag}] ${toDelete.name}`,
      id
    );
  }
}

export function addAssetMaintenanceLog(
  assetId: string,
  logData: Omit<AssetMaintenanceLog, 'id'>,
  setAssets: Dispatch<SetStateAction<ChurchAsset[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  const newLog: AssetMaintenanceLog = {
    ...logData,
    id: `mlog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  };

  setAssets((prev) =>
    prev.map((asset) => {
      if (asset.id !== assetId) return asset;

      const existingLogs = asset.maintenance_logs || [];
      const updated = {
        ...asset,
        last_service_date: logData.service_date,
        maintenance_logs: [newLog, ...existingLogs],
        updated_at: new Date().toISOString(),
      };
      logAction(
        'RECORD_MAINTENANCE',
        'Inventory',
        `Logged ${logData.service_type} for asset [${asset.asset_tag}] ${asset.name} by ${logData.technician_vendor} (GH₵ ${logData.cost.toFixed(2)})`,
        assetId
      );
      return updated;
    })
  );
}

export function addRosterAssignment(
  data: Omit<RosterAssignment, 'id' | 'created_at'>,
  setRosterAssignments: Dispatch<SetStateAction<RosterAssignment[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
): RosterAssignment {
  const newAssignment: RosterAssignment = {
    ...data,
    id: `rst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setRosterAssignments((prev) => [newAssignment, ...prev]);
  logAction(
    'ASSIGN_ROSTER_DUTY',
    'Services',
    `Assigned ${data.member_name} to ${data.department} as ${data.role_title} for ${data.service_name} on ${data.date}`,
    newAssignment.id
  );
  return newAssignment;
}

export function updateRosterAssignment(
  id: string,
  updates: Partial<RosterAssignment>,
  setRosterAssignments: Dispatch<SetStateAction<RosterAssignment[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  setRosterAssignments((prev) =>
    prev.map((assignment) => {
      if (assignment.id !== id) return assignment;

      const updated = {
        ...assignment,
        ...updates,
      };
      logAction(
        'UPDATE_ROSTER_DUTY',
        'Services',
        `Updated roster duty for ${assignment.member_name} (${assignment.role_title}) to status ${updates.status || assignment.status}`,
        id
      );
      return updated;
    })
  );
}

export function deleteRosterAssignment(
  id: string,
  rosterAssignments: RosterAssignment[],
  setRosterAssignments: Dispatch<SetStateAction<RosterAssignment[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  const toDelete = rosterAssignments.find((assignment) => assignment.id === id);
  setRosterAssignments((prev) => prev.filter((assignment) => assignment.id !== id));
  if (toDelete) {
    logAction(
      'REMOVE_ROSTER_DUTY',
      'Services',
      `Removed roster duty for ${toDelete.member_name} from ${toDelete.department} (${toDelete.service_name})`,
      id
    );
  }
}

export function batchAddOrUpdateRosterAssignments(
  records: Omit<RosterAssignment, 'id' | 'created_at'>[],
  setRosterAssignments: Dispatch<SetStateAction<RosterAssignment[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  if (!records || records.length === 0) return;

  setRosterAssignments((prev) => {
    const nextList = [...prev];
    records.forEach((record, idx) => {
      const existingIdx = nextList.findIndex(
        (assignment) =>
          assignment.service_id === record.service_id &&
          assignment.date === record.date &&
          (assignment.role_title.toLowerCase() === record.role_title.toLowerCase() ||
            (assignment.department === record.department &&
              assignment.role_title.toLowerCase().slice(0, 5) === record.role_title.toLowerCase().slice(0, 5)))
      );

      if (existingIdx >= 0) {
        nextList[existingIdx] = {
          ...nextList[existingIdx],
          ...record,
        };
      } else {
        nextList.unshift({
          ...record,
          id: `rst-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          created_at: new Date().toISOString(),
        });
      }
    });
    return nextList;
  });

  logAction(
    'UPDATE_ROSTER_DUTY',
    'Services',
    `Synchronized ${records.length} duty roster assignment(s) for service schedule.`,
    records[0]?.service_id || 'roster'
  );
}

export function buildRosterConflicts(rosterAssignments: RosterAssignment[]): RosterConflict[] {
  const conflicts: RosterConflict[] = [];
  const memberDateGroups = new Map<string, RosterAssignment[]>();

  rosterAssignments.forEach((assignment) => {
    const key = `${assignment.member_id}__${assignment.date}`;
    const group = memberDateGroups.get(key) || [];
    group.push(assignment);
    memberDateGroups.set(key, group);
  });

  memberDateGroups.forEach((assignments) => {
    if (assignments.length <= 1) return;

    const first = assignments[0];
    const sameService = assignments.every((entry) => entry.service_id === first.service_id);
    const roles = assignments.map((entry) => `${entry.department} (${entry.role_title})`).join(' and ');

    conflicts.push({
      member_id: first.member_id,
      member_name: first.member_name,
      date: first.date,
      service_id: first.service_id,
      service_name: first.service_name,
      assignments,
      conflict_type: sameService ? 'double_booked' : 'back_to_back',
      message: sameService
        ? `${first.member_name} is double-booked across ${roles} during the same service!`
        : `${first.member_name} has multiple assignments across services on ${first.date}.`,
    });
  });

  return conflicts;
}

export function createFoundationCohort(
  data: Omit<FoundationCohort, 'id' | 'created_at'>,
  setFoundationCohorts: Dispatch<SetStateAction<FoundationCohort[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
): FoundationCohort {
  const newCohort: FoundationCohort = {
    ...data,
    id: `fnd-cohort-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setFoundationCohorts((prev) => [newCohort, ...prev]);
  logAction('CREATE_FOUNDATION_COHORT', 'Discipleship', `Created Foundation School cohort: ${data.name}`, newCohort.id);
  return newCohort;
}

export function updateFoundationCohort(
  id: string,
  updates: Partial<FoundationCohort>,
  setFoundationCohorts: Dispatch<SetStateAction<FoundationCohort[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  setFoundationCohorts((prev) =>
    prev.map((cohort) => {
      if (cohort.id !== id) return cohort;

      const updated = { ...cohort, ...updates };
      logAction('UPDATE_FOUNDATION_COHORT', 'Discipleship', `Updated cohort ${cohort.name} (Status: ${updates.status || cohort.status})`, id);
      return updated;
    })
  );
}

export function enrollMemberInFoundationSchool(
  data: Omit<FoundationStudent, 'id' | 'created_at'>,
  setFoundationStudents: Dispatch<SetStateAction<FoundationStudent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
): FoundationStudent {
  const newStudent: FoundationStudent = {
    ...data,
    id: `fnd-std-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setFoundationStudents((prev) => [newStudent, ...prev]);
  logAction('ENROLL_FOUNDATION_STUDENT', 'Discipleship', `Enrolled ${data.member_name} into ${data.cohort_name}`, newStudent.id);
  return newStudent;
}

export function updateFoundationStudent(
  id: string,
  updates: Partial<FoundationStudent>,
  setFoundationStudents: Dispatch<SetStateAction<FoundationStudent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  setFoundationStudents((prev) =>
    prev.map((student) => {
      if (student.id !== id) return student;

      const updated: FoundationStudent = {
        ...student,
        ...updates,
      };
      logAction('UPDATE_FOUNDATION_STUDENT', 'Discipleship', `Updated student ${student.member_name} progress (Status: ${updates.status || student.status})`, id);
      return updated;
    })
  );
}

export function toggleFoundationModule(
  studentId: string,
  moduleNumber: number,
  setFoundationStudents: Dispatch<SetStateAction<FoundationStudent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  setFoundationStudents((prev) =>
    prev.map((student) => {
      if (student.id !== studentId) return student;

      const current = new Set(student.completed_modules);
      if (current.has(moduleNumber)) {
        current.delete(moduleNumber);
      } else {
        current.add(moduleNumber);
      }

      const completedModules = Array.from(current).sort();
      const allCompleted = [1, 2, 3, 4, 5].every((module) => completedModules.includes(module));
      const nextStatus: FoundationStudentStatus = allCompleted ? 'ready_for_baptism' : 'in_progress';

      const updated: FoundationStudent = {
        ...student,
        completed_modules: completedModules,
        status: student.status === 'graduated' ? 'graduated' : nextStatus,
      };
      logAction('TOGGLE_FOUNDATION_MODULE', 'Discipleship', `Updated ${student.member_name} module ${moduleNumber} completion state (${completedModules.length}/5)`, studentId);
      return updated;
    })
  );
}

export function graduateFoundationStudent(
  studentId: string,
  certificateNo: string | undefined,
  setFoundationStudents: Dispatch<SetStateAction<FoundationStudent[]>>,
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  const today = new Date().toISOString().split('T')[0];
  const certNumber = certificateNo || `GWCC-FS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  setFoundationStudents((prev) =>
    prev.map((student) => {
      if (student.id !== studentId) return student;

      const updated: FoundationStudent = {
        ...student,
        status: 'graduated',
        graduation_date: today,
        certificate_no: certNumber,
        completed_modules: [1, 2, 3, 4, 5],
      };
      setMembers((members) =>
        members.map((member) =>
          member.id === student.member_id ? { ...member, membership_class_completed: true } : member
        )
      );
      logAction('GRADUATE_FOUNDATION_STUDENT', 'Discipleship', `Graduated ${student.member_name} from Foundation School with Certificate ${certNumber}`, studentId);
      return updated;
    })
  );
}
