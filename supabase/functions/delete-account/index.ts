// delete-account — permanently delete the calling user and all their data.
//
// Deleting an auth user requires the service-role key, which must never live in
// the app; this function holds it server-side. The auth-user delete cascades to
// profiles/setups/items/posts via the on-delete-cascade foreign keys. Storage
// objects are NOT cascaded, so we remove the user's folder in each bucket first.
//
// Deploy:  supabase functions deploy delete-account
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// App:     supabase.functions.invoke('delete-account')  // JWT attached for us

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKETS = ['item-photos', 'setup-photos', 'revamp-history', 'profile-media'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server not configured' }, 500);

  // Identify the caller from their JWT — never trust a user id from the body.
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return json({ error: 'Not authenticated' }, 401);

  const admin = createClient(url, serviceKey);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: 'Not authenticated' }, 401);
  const userId = userData.user.id;

  try {
    // Remove the user's storage objects (auth delete does not touch storage).
    for (const bucket of BUCKETS) {
      const { data: files } = await admin.storage.from(bucket).list(userId);
      if (files?.length) {
        await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      }
    }

    // Delete the auth user — cascades to profiles/setups/items/posts.
    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) return json({ error: delError.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
