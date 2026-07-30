// _shared/auth.ts — resolve the calling user from the request's Authorization
// header, or null if the caller is not a real signed-in user.
//
// Why this exists: the gateway's verify_jwt only checks that the bearer token
// is signed with the project's JWT secret — and the anon key that ships inside
// the app bundle is itself such a token, so verify_jwt alone does NOT prove a
// user is signed in. Every function that spends third-party quota (Mistral,
// FAPIHub, eBay, Gemini) must call this and reject when it returns null,
// otherwise anyone who extracts the anon key can burn that quota from a script.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function requireUser(req: Request) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  // Return the client too: RPCs made through it run AS this user (auth.uid()),
  // which is what the per-user quota RPCs key on.
  return { user: data.user, supabase };
}

// Enforce the per-user daily cap for an expensive function ('scan' or
// 'remove_bg' — limits live server-side in consume_usage(), migration 0008).
// Returns null when allowed, or a { error, status } the caller should return.
export async function enforceDailyQuota(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any>,
  kind: 'scan' | 'remove_bg',
) {
  const { data, error } = await supabase.rpc('consume_usage', { p_kind: kind });
  if (error) return { error: error.message, status: 500 };
  const usage = Array.isArray(data) ? data[0] : data;
  if (!usage?.allowed) {
    return { error: 'Daily limit reached — try again tomorrow.', status: 429 };
  }
  return null;
}
