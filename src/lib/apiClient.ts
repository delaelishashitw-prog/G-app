import { getSupabaseClient } from './supabase';

export async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Secure sign-in is not configured.');
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in again.');
  return fetch(url, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init.headers).entries()), Authorization: `Bearer ${session.access_token}` },
  });
}

export async function apiRequest<T = any>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await authenticatedFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({ error: 'The server returned an invalid response.' }));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result as T;
}
