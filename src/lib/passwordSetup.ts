import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { authSessionId, CHANGED_LINK_SESSION_MESSAGE, EXPIRED_LINK_MESSAGE, type AuthLink, type PasswordLink } from './authLinks';

export type PasswordLinkProof = { link: PasswordLink; userId: string; email: string; sessionId: string | null };

export function matchesPasswordSession(proof: PasswordLinkProof, session: Session | null): boolean {
  return Boolean(session && session.user.id === proof.userId &&
    (session.access_token === proof.link.accessToken ||
      (proof.sessionId && authSessionId(session.access_token) === proof.sessionId)));
}

export async function verifyPasswordLink(client: SupabaseClient, link: AuthLink): Promise<PasswordLinkProof> {
  if (link.kind !== 'password') throw new Error(EXPIRED_LINK_MESSAGE);
  const { data: { user }, error } = await client.auth.getUser(link.accessToken);
  if (error || !user?.email_confirmed_at || !user.email) throw new Error(EXPIRED_LINK_MESSAGE);
  const proof: PasswordLinkProof = { link, userId: user.id, email: user.email, sessionId: authSessionId(link.accessToken) };
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError || !matchesPasswordSession(proof, data.session)) throw new Error(CHANGED_LINK_SESSION_MESSAGE);
  return proof;
}

export async function savePasswordFromLink(
  client: SupabaseClient, proof: PasswordLinkProof, config: { url: string; anonKey: string },
  password: string, clientFactory = createClient,
): Promise<void> {
  if (password.length < 12) throw new Error('Use at least 12 characters.');
  const { data, error } = await client.auth.getSession();
  if (error || !matchesPasswordSession(proof, data.session)) throw new Error(CHANGED_LINK_SESSION_MESSAGE);
  const session = data.session!;
  // Another tab can replace the main session during a request. An in-memory
  // client keeps the password write on the link's account and current MFA level.
  const isolated = clientFactory(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      storageKey: `gwcc-email-password-${crypto.randomUUID()}` },
  });
  const { data: verified, error: verificationError } = await isolated.auth.setSession({
    access_token: session.access_token, refresh_token: session.refresh_token,
  });
  if (verificationError || !verified.user?.email_confirmed_at || verified.user.id !== proof.userId ||
    !matchesPasswordSession(proof, verified.session)) throw new Error(CHANGED_LINK_SESSION_MESSAGE);
  const current = await client.auth.getSession();
  if (current.error || !matchesPasswordSession(proof, current.data.session)) throw new Error(CHANGED_LINK_SESSION_MESSAGE);
  const { error: updateError } = await isolated.auth.updateUser({ password });
  if (updateError) throw updateError;
}
