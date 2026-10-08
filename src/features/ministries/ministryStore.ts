import type { Dispatch, SetStateAction } from 'react';
import type { Member, Ministry, SmallGroup } from '../../types/database.types';

export function addMinistry(
  data: Omit<Ministry, 'id' | 'member_count'>,
  setMinistries: Dispatch<SetStateAction<Ministry[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): Ministry {
  const newMinistry: Ministry = {
    ...data,
    id: `min-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    member_count: 0,
  };

  setMinistries((prev) => [...prev, newMinistry]);
  logAction('CREATE_MINISTRY', 'Ministries', `Formed ministry "${newMinistry.name}"`, newMinistry.id);
  dbSyncUpsert('ministries', newMinistry);
  return newMinistry;
}

export function updateMinistry(
  id: string,
  updates: Partial<Ministry>,
  setMinistries: Dispatch<SetStateAction<Ministry[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setMinistries((prev) =>
    prev.map((ministry) => {
      if (ministry.id === id) {
        const updated = { ...ministry, ...updates };
        logAction('UPDATE_MINISTRY', 'Ministries', `Updated ministry "${updated.name}"`, id);
        dbSyncUpsert('ministries', updated);
        return updated;
      }
      return ministry;
    })
  );
}

export function deleteMinistry(
  id: string,
  ministries: Ministry[],
  setMinistries: Dispatch<SetStateAction<Ministry[]>>,
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  const toDelete = ministries.find((ministry) => ministry.id === id);
  const ministryName = toDelete ? toDelete.name : id;

  setMinistries((prev) => prev.filter((ministry) => ministry.id !== id));
  setMembers((prev) =>
    prev.map((member) => {
      if (member.ministry_id === id || member.ministry_name === ministryName) {
        const cleared = {
          ...member,
          ministry_id: undefined,
          ministry_name: undefined,
          updated_at: new Date().toISOString(),
        };
        dbSyncUpsert('members', cleared);
        return cleared;
      }
      return member;
    })
  );

  logAction('DELETE_MINISTRY', 'Ministries', `Deleted ministry "${ministryName}"`, id);
  dbSyncDelete('ministries', id);
}

export function assignMemberToMinistry(
  memberId: string,
  ministryId: string,
  ministryName: string,
  role: string | undefined,
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setMembers((prev) =>
    prev.map((member) => {
      if (member.id !== memberId) return member;

      const updated = {
        ...member,
        ministry_id: ministryId,
        ministry_name: ministryName,
        leadership_position: role !== undefined ? role : member.leadership_position,
        updated_at: new Date().toISOString(),
      };
      logAction(
        'ASSIGN_MINISTRY',
        'Ministries',
        `Assigned ${member.first_name} ${member.last_name} to ${ministryName} as ${role || 'Member'}`,
        memberId
      );
      dbSyncUpsert('members', updated);
      return updated;
    })
  );
}

export function removeMemberFromMinistry(
  memberId: string,
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setMembers((prev) =>
    prev.map((member) => {
      if (member.id !== memberId) return member;

      const previousMinistry = member.ministry_name || 'Ministry';
      const updated = {
        ...member,
        ministry_id: undefined,
        ministry_name: undefined,
        updated_at: new Date().toISOString(),
      };
      logAction(
        'REMOVE_MINISTRY_MEMBER',
        'Ministries',
        `Removed ${member.first_name} ${member.last_name} from ${previousMinistry}`,
        memberId
      );
      dbSyncUpsert('members', updated);
      return updated;
    })
  );
}

export function addSmallGroup(
  data: Omit<SmallGroup, 'id' | 'member_count'>,
  setSmallGroups: Dispatch<SetStateAction<SmallGroup[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): SmallGroup {
  const newGroup: SmallGroup = {
    ...data,
    id: `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    member_count: 0,
  };

  setSmallGroups((prev) => [...prev, newGroup]);
  logAction('CREATE_SMALL_GROUP', 'Small Groups', `Created cell group "${newGroup.name}"`, newGroup.id);
  dbSyncUpsert('small_groups', newGroup);
  return newGroup;
}
