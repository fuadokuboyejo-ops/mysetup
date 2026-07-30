// remove-bg — background cutout proxy (FAPIHub rembg API).
//
// The ONLY reason this runs server-side is to keep FAPIHUB_API_KEY secret: the
// app calls this function (auth JWT only, no secret), and this function calls
// FAPIHub with the key.
//
// Deploy:  supabase functions deploy remove-bg
// Secret:  supabase secrets set FAPIHUB_API_KEY=...   (fapihub.com)
//
// The app invokes it via supabase.functions.invoke('remove-bg', { body: { photo } }),
// which automatically attaches the signed-in user's JWT. Note the gateway's
// verify_jwt is NOT enough on its own — the shipped anon key also passes it —
// so we additionally resolve a real user via requireUser() before doing work.
//
// FAPIHub returns a PNG *with alpha*, which the board needs to composite items.
// Models: falcon (default), aurora, ghost — see docs.fapihub.com.

import { enforceDailyQuota, requireUser } from '../_shared/auth.ts';

const FAPIHUB_ENDPOINT = 'https://fapihub.com/v2/rembg/';
const FAPIHUB_MODEL = 'falcon';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// base64 -> bytes
function decodeBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// bytes -> base64, chunked (spreading a whole image overflows the call stack)
function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  // CORS preflight (browsers; harmless for the React Native client).
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const apiKey = Deno.env.get('FAPIHUB_API_KEY');
  if (!apiKey) return json({ error: 'FAPIHUB_API_KEY not configured' }, 500);

  // Require a real signed-in user — the shipped anon key alone passes the
  // gateway's verify_jwt, so without this check anyone holding it could burn
  // the FAPIHub quota. (See _shared/auth.ts.)
  const auth = await requireUser(req);
  if (!auth) return json({ error: 'Not authenticated' }, 401);

  // Per-user daily cap, enforced server-side before spending FAPIHub quota.
  const denied = await enforceDailyQuota(auth.supabase, 'remove_bg');
  if (denied) return json({ error: denied.error }, denied.status);

  try {
    const { photo } = await req.json();
    if (!photo) return json({ error: 'No photo provided' }, 400);

    const form = new FormData();
    form.append('image', new Blob([decodeBase64(photo)], { type: 'image/jpeg' }), 'image.jpg');
    form.append('model', FAPIHUB_MODEL);

    // Note: don't set Content-Type — fetch adds the multipart boundary itself.
    const response = await fetch(FAPIHUB_ENDPOINT, {
      method: 'POST',
      headers: { ApiKey: apiKey },
      body: form,
    });

    if (!response.ok) {
      // FAPIHub errors are JSON: { code, message, request_id } with 400/401/402/429.
      const err = await response.json().catch(() => ({}));
      const detail = err?.message || err?.code || `FAPIHub failed (${response.status})`;
      return json({ error: detail }, 502);
    }

    // Success is the raw PNG bytes, not JSON.
    const bytes = new Uint8Array(await response.arrayBuffer());
    return json({ image: encodeBase64(bytes) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
