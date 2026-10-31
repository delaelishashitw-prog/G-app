import type { Member } from '../../types/database.types';

const PREFIX = 'GWCC:MEMBER:1:';

export function canUseAttendancePass(member: Member): boolean {
  return !!member.id?.trim() && member.id.length <= 128 && !!member.member_id?.trim()
    && !/[\u0000-\u001f\u007f]/.test(member.id) && !member.is_archived
    && member.status !== 'deceased' && member.status !== 'transferred' && member._sync_status !== 'pending';
}

/** A directory reference, never an authentication or child collection credential. */
export function attendancePassValue(member: Member): string | null {
  return canUseAttendancePass(member) ? PREFIX + encodeURIComponent(member.id) : null;
}

export function resolveAttendancePass(value: string, members: readonly Member[]): { member: Member; error?: never } | { error: string; member?: never } {
  const input = value.trim();
  if (!input || input.length > 512 || /[\u0000-\u001f\u007f]/.test(input)) return { error: 'Enter or scan a valid member attendance pass.' };
  let matches: Member[];
  if (input.startsWith(PREFIX)) {
    let id: string;
    try { id = decodeURIComponent(input.slice(PREFIX.length)); }
    catch { return { error: 'This member pass is invalid. Use the member search instead.' }; }
    matches = members.filter(member => member.id === id);
  } else {
    // Older portal passes contain only the exact public Member ID.
    if (/[:/{}\[\]]/.test(input)) return { error: 'This is not a supported member attendance pass.' };
    matches = members.filter(member => member.member_id?.trim() === input);
  }
  if (matches.length > 1) return { error: 'This pass matches more than one member. Ask an administrator to review the directory.' };
  if (!matches.length) return { error: 'No member matches this pass. Refresh the directory or use member search.' };
  if (!canUseAttendancePass(matches[0])) return { error: 'This member pass is unavailable. Ask an administrator to review the member record.' };
  return { member: matches[0] };
}
