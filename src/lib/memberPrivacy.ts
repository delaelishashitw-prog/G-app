import type { UserRole } from '../types/database.types';

export const canReadMemberNotes = (role: UserRole | string | null) =>
  ['super_admin', 'senior_pastor', 'pastor'].includes(role || '');

// Column privileges protect notes even when a caller bypasses the UI.
export const MEMBER_DIRECTORY_COLUMNS = [
  'id', 'member_id', 'tithe_number', 'first_name', 'middle_name', 'last_name', 'gender',
  'date_of_birth', 'marital_status', 'nationality', 'occupation', 'employer', 'education',
  'phone', 'alternative_phone', 'email', 'residential_address', 'city', 'region', 'gps_address',
  'profile_photo_url', 'status', 'membership_date', 'first_visit_date', 'baptism_status',
  'baptism_date', 'salvation_status', 'ministry_id', 'ministry_name', 'small_group_id',
  'leadership_position', 'emergency_name', 'emergency_relationship', 'emergency_phone',
  'emergency_alt_phone', 'is_archived', 'created_by', 'created_at', 'updated_at', 'national_id',
  'hometown', 'region_of_origin', 'spouse_name', 'spouse_is_member', 'wedding_anniversary',
  'number_of_children', 'preferred_communication', 'landmark', 'date_joined',
  'right_hand_of_fellowship_date', 'previous_church', 'small_group_name', 'salvation_date',
  'baptized_by', 'holy_spirit_baptism', 'holy_spirit_baptism_date', 'spiritual_gifts',
  'talents_skills', 'membership_class_completed', 'auth_user_id',
].join(',');

export function memberForRole<T extends { notes?: unknown }>(member: T, role: string | null): T {
  if (canReadMemberNotes(role)) return member;
  const result = { ...member };
  delete result.notes;
  return result;
}
