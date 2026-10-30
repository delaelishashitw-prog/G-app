/**
 * A successful portal invitation/link is independent of whether the directory
 * refresh succeeds. Do not misreport a committed account action as a failure.
 */
export const MEMBER_PORTAL_REFRESH_WARNING =
  'The account action succeeded, but the member directory could not be refreshed from the cloud. Refresh the directory before sending another invitation.';

export type MemberDirectoryRefresh = {
  success: boolean;
  source: 'supabase' | 'local';
};

/** Returns an advisory message, never throws after the account action succeeds. */
export async function memberPortalRefreshWarning(
  refresh: () => Promise<MemberDirectoryRefresh>,
): Promise<string> {
  try {
    const result = await refresh();
    return result?.success === true && result.source === 'supabase'
      ? ''
      : MEMBER_PORTAL_REFRESH_WARNING;
  } catch {
    return MEMBER_PORTAL_REFRESH_WARNING;
  }
}
