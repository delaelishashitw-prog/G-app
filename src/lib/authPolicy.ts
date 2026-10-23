import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '../types/database.types';
import {authRequestError} from './authConnectivity';

export const USER_ROLES: UserRole[] = ['super_admin', 'senior_pastor', 'administrator', 'finance_officer', 'pastor', 'ministry_leader', 'attendance_officer', 'data_entry', 'member'];

/** Authorization comes exclusively from the protected profile, never user_metadata. */
export async function readVerifiedProfile(client: SupabaseClient, user: User): Promise<UserProfile> {
  if (!user.email_confirmed_at) throw new Error('Verify your email address before signing in.');
  const { data, error, status } = await client.from('profiles').select('*').eq('id', user.id).single();
  if(error)throw authRequestError(error,status);
  if (!data) throw new Error('Your church account is not activated. Contact the church office.');
  if (data.id !== user.id || data.is_active !== true || data.has_login_account === false) {
    throw new Error('This account is inactive. Contact the church office.');
  }
  if(data.role!=='member' && !data.authorization_reviewed_at)throw new Error('An administrator must review this staff account before access is enabled.');
  if (!USER_ROLES.includes(data.role)) throw new Error('This account has an invalid role. Contact the church office.');
  return { ...data, email: user.email || data.email } as UserProfile;
}

export const GUEST_PROFILE: UserProfile = {
  id: '', first_name: 'Guest', last_name: '', email: '', role: 'member', is_active: false,
  created_at: '', updated_at: '',
};

export function clearLegacyCredentials(): void {
  for (const key of ['gwcc_active_user', 'gwcc_active_member_id', 'gwcc_auth_authenticated', 'gwcc_auth_role',
    'gwcc_staff_passwords', 'gwcc_member_passwords', 'gwcc_registered_users']) localStorage.removeItem(key);
  sessionStorage.removeItem('gwcc_member_passwords_v2');
  sessionStorage.removeItem('gwcc_impersonating_admin');
}
