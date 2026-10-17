import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function serverSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new HttpError(503, 'Secure authentication is not configured on the server.');
  return { url, key };
}

export async function authorizeRequest(req, { roles, bucket = 'ai', allowedOrigins = [] } = {}, dependencies = {}) {
  const config = serverSupabaseConfig();
  const auth = req.headers?.authorization || '';
  const match = /^Bearer ([^\s]+)$/i.exec(auth);
  if (!match) throw new HttpError(401, 'Sign-in is required.');
  const client = (dependencies.createClient || createClient)(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data.user?.email_confirmed_at) throw new HttpError(401, 'Your session is invalid or expired.');
  const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single();
  if (profileError || profile?.id !== data.user.id || profile.is_active !== true || profile.has_login_account !== true || (profile.role!=='member' && !profile.authorization_reviewed_at)) {
    throw new HttpError(403, 'This account is not authorized.');
  }
  if (roles && !roles.includes(profile.role)) throw new HttpError(403, 'Your role cannot perform this action.');
  const { data: security, error: securityError } = await client.rpc('gwcc_security_status');
  if (securityError || !security || security.role !== profile.role || typeof security.satisfied !== 'boolean') {
    throw new HttpError(503, 'Account security could not be checked. Please try again.');
  }
  if (!security.satisfied) throw new HttpError(403, 'Complete two-factor verification before using this action.');
  const origin = req.headers?.origin;
  if (origin) {
    const configured = [...(process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean),...allowedOrigins];
    const requestHost = req.headers?.host;
    let sameHost=false;
    try {sameHost=Boolean(requestHost && new URL(origin).host===requestHost);} catch {throw new HttpError(403,'This origin is not allowed.');}
    if (!sameHost && !configured.includes(origin)) throw new HttpError(403, 'This origin is not allowed.');
  }
  // A forwarding server checks identity/origin here; the destination consumes
  // the quota after repeating these checks. The client cannot select this flag.
  if (bucket !== null) {
    const { data: allowed, error: rateError } = await client.rpc('gwcc_consume_api_limit', { p_bucket: bucket });
    if (rateError) throw new HttpError(503, 'The security database migration is required.');
    if (!allowed) throw new HttpError(429, 'Too many requests. Try again in a minute.');
  }
  return { client, profile, user: data.user };
}

export function sendError(res, error) {
  const status = error instanceof HttpError ? error.status : 500;
  res.status(status).json({ error: status < 500 ? error.message : (status === 503 ? error.message : 'The operation could not be completed. Please try again.') });
}

export function requirePost(req, res) {
  res.setHeader?.('Cache-Control', 'no-store');
  if (req.method === 'POST') return true;
  res.setHeader?.('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return false;
}
