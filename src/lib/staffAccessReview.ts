import type { UserProfile } from '../types/database.types';
import { USER_ROLES } from './authPolicy';

/** Profile requirements only; this does not verify another user's Auth session. */
export function staffProfileAccessBlockers(user: UserProfile): string[] {
  const blockers: string[] = [];
  if (!user.is_active) blockers.push('This profile is suspended.');
  if (user.has_login_account === false) blockers.push('Directory only: sign-in is disabled for this profile.');
  if (!USER_ROLES.includes(user.role)) blockers.push('The security role needs administrator review.');
  if (user.role !== 'member' && !user.authorization_reviewed_at) blockers.push('Administrator review is required before staff access is enabled.');
  return blockers;
}
