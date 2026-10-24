import type { Member, UserRole } from '../../types/database.types';

export const MEMBER_SAVE_NOTICE = 'Saved on this device. Awaiting cloud confirmation.';
export const MEMBER_WRITE_ROLES: UserRole[] = ['super_admin', 'senior_pastor', 'administrator', 'pastor', 'data_entry'];
export const MEMBER_ARCHIVE_ROLES: UserRole[] = ['super_admin', 'senior_pastor', 'administrator'];
export const canEditMembers = (role: UserRole) => MEMBER_WRITE_ROLES.includes(role);
export const canArchiveMembers = (role: UserRole) => MEMBER_ARCHIVE_ROLES.includes(role);
export async function foundationEnrollmentId(cohortId:string,memberId:string):Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([cohortId,memberId])));
  return 'foundation-'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function requireConfirmedMember(member: Member | undefined, expectedVersion?: string): Member {
  if (!member) throw new Error('This member is unavailable. Refresh the directory.');
  if (member._sync_status === 'pending' || !member.updated_at)
    throw new Error('Wait for cloud confirmation before changing this member again.');
  if (expectedVersion && member.updated_at !== expectedVersion)
    throw new Error('This member changed while the form was open. Reopen the latest profile before saving.');
  return member;
}

export function memberMatchesSearch(member: Member, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const fields = [member.first_name, member.middle_name, member.last_name, member.member_id,
    member.tithe_number, member.email, member.gps_address, member.national_id, member.leadership_position,
    member.ministry_name, member.small_group_name, member.residential_address, member.landmark, member.city, member.hometown,
    member.phone].map(value => (value || '').toLowerCase());
  const phone = (member.phone || '').replace(/\D/g, '');
  const localPhone = phone.startsWith('233') ? '0' + phone.slice(3) : phone;
  if (/^[+\d\s().-]+$/.test(term)) {
    const digits = term.replace(/\D/g, '');
    if (digits.length >= 3 && (phone.includes(digits) || localPhone.includes(digits))) return true;
  }
  return term.split(/\s+/).every(token => {
    if (fields.some(field => field.includes(token))) return true;
    if (!/^\d+$/.test(token)) return false;
    const idDigits = (member.member_id || '').replace(/\D/g, '');
    return idDigits.endsWith(token) || (token.length >= 3 && (phone.includes(token) || localPhone.includes(token)));
  });
}

export const memberDirectoryPage = (value: unknown): number => {
  const text = String(value ?? '1');
  const n = /^\d+$/.test(text) ? Number(text) : 1;
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
};
export const memberDirectoryPageSize = (value: unknown): number => {
  const n = Number(value);
  return [12, 24, 48, 96].includes(n) ? n : 24;
};
