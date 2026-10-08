import type { Dispatch, SetStateAction } from 'react';
import type { Member } from '../../types/database.types';

export function addMember(
  data: Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'>,
  members: Member[],
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void,
  generateMemberId: () => string,
  generateTitheNumber: () => string
): Member {
  const now = new Date().toISOString();
  const newMember: Member = {
    ...data,
    id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    member_id: generateMemberId(),
    tithe_number: data.tithe_number || generateTitheNumber(),
    created_at: now,
    updated_at: now,
  };

  setMembers((prev) => [newMember, ...prev]);
  logAction(
    'CREATE_MEMBER',
    'Members',
    `Registered member ${newMember.first_name} ${newMember.last_name} (${newMember.member_id})`,
    newMember.id
  );
  dbSyncUpsert('members', newMember);
  return newMember;
}

export function updateMember(
  id: string,
  updates: Partial<Member>,
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setMembers((prev) =>
    prev.map((m) => {
      if (m.id === id) {
        const updated = { ...m, ...updates, updated_at: new Date().toISOString() };
        logAction(
          'UPDATE_MEMBER',
          'Members',
          `Updated member details for ${updated.first_name} ${updated.last_name}`,
          id
        );
        dbSyncUpsert('members', updated);
        return updated;
      }
      return m;
    })
  );
}

export function bulkUpdateMembers(
  memberIds: string[],
  updates: Partial<Member>,
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  const idSet = new Set(memberIds);
  const now = new Date().toISOString();
  setMembers((prev) =>
    prev.map((m) => {
      if (idSet.has(m.id)) {
        const updated = { ...m, ...updates, updated_at: now };
        dbSyncUpsert('members', updated);
        return updated;
      }
      return m;
    })
  );
  logAction('BULK_UPDATE_MEMBERS', 'Members', `Applied bulk update across ${memberIds.length} members`);
}

export function archiveMember(
  id: string,
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setMembers((prev) =>
    prev.map((m) => {
      if (m.id === id) {
        const archived = { ...m, is_archived: true, updated_at: new Date().toISOString() };
        logAction('ARCHIVE_MEMBER', 'Members', `Archived member ${m.first_name} ${m.last_name} (${m.member_id})`, id);
        dbSyncUpsert('members', archived);
        return archived;
      }
      return m;
    })
  );
}

export function unarchiveMember(
  id: string,
  setMembers: Dispatch<SetStateAction<Member[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setMembers((prev) =>
    prev.map((m) => {
      if (m.id === id) {
        const restored = { ...m, is_archived: false, updated_at: new Date().toISOString() };
        logAction('RESTORE_MEMBER', 'Members', `Restored member ${m.first_name} ${m.last_name} (${m.member_id})`, id);
        dbSyncUpsert('members', restored);
        return restored;
      }
      return m;
    })
  );
}

export function getMember(members: Member[], id: string): Member | undefined {
  return members.find((m) => m.id === id);
}
