/** Capture the email callback before Supabase consumes its URL fragment. */
export type PasswordLink = {
  kind: 'password';
  purpose: 'invite' | 'recovery';
  accessToken: string;
  refreshToken: string;
};
export type AuthLink = PasswordLink | { kind: 'error'; reason: 'expired' | 'invalid' } | { kind: 'none' };

export const EXPIRED_LINK_MESSAGE = 'This invitation or reset link is invalid, expired, or already used. Ask the church office for a new invitation, or request a new password reset link.';
export const CHANGED_LINK_SESSION_MESSAGE = 'The signed-in account changed. Open a new invitation or password reset link for the account you want to use.';

export function parseAuthLink(href: string): AuthLink {
  let url: URL;
  try { url = new URL(href); } catch { return { kind: 'none' }; }
  const hash = new URLSearchParams(url.hash.slice(1)), query = url.searchParams;
  const error = hash.get('error') || query.get('error');
  const code = hash.get('error_code') || query.get('error_code');
  const hint = query.get('link_error');
  if (error || code || hash.has('error_description') || query.has('error_description') || hint) {
    return { kind: 'error', reason: code === 'otp_expired' || hint === 'expired' ? 'expired' : 'invalid' };
  }
  const purpose = hash.get('type') || query.get('type');
  if (purpose !== 'invite' && purpose !== 'recovery') return { kind: 'none' };
  const accessToken = hash.get('access_token'), refreshToken = hash.get('refresh_token');
  if (!accessToken || !refreshToken || hash.get('token_type')?.toLowerCase() !== 'bearer') return { kind: 'error', reason: 'invalid' };
  return { kind: 'password', purpose, accessToken, refreshToken };
}

let initialLink: AuthLink = parseAuthLink(typeof window === 'undefined' ? '' : window.location.href || '');
export const getInitialAuthLink = (): AuthLink => initialLink;
export const consumePasswordLink = (): void => { initialLink = { kind: 'none' }; };

/** Run before constructing the auth client and BrowserRouter. Callback proof
 * stays in memory; no callback flags or extra tokens are persisted. */
export function routeInitialAuthLink(): void {
  if (initialLink.kind === 'none' || typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  url.pathname = '/auth/password';
  if (initialLink.kind === 'error') {
    url.search = new URLSearchParams({ link_error: initialLink.reason }).toString();
    url.hash = '';
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Only binds a verified email-link session through refresh/MFA. Identity and
 * permissions still come from getUser and the protected profile. */
export function authSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const value = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof value.session_id === 'string' && value.session_id ? value.session_id : null;
  } catch { return null; }
}
