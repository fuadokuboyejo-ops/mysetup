// revamp — AI desk-setup generation proxy (Gemini 2.5 Flash Image).
//
// Replaces the Express `POST /api/revamp` route. Holds GEMINI_API_KEY
// server-side; the app calls this with just the user's JWT.
//
// Deploy:  supabase functions deploy revamp
// Secret:  supabase secrets set GEMINI_API_KEY=...
//
// App:     supabase.functions.invoke('revamp', { body: { items, style, basePhoto } })
//   items:     [{ name, category, photo(base64) }]
//   basePhoto: base64 of the user's real setup photo (optional).
//
// Two modes:
//   • basePhoto present  → EDIT mode: keep the user's real photo untouched and
//     only place/replace the board items into it (what "Try different gear"
//     wants — same room, lighting, angle; just the gear changes).
//   • basePhoto absent   → GENERATE mode: compose a fresh desk photo from the
//     item reference images.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function remoteImage(url: string, fallbackMime: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl || new URL(url).origin !== new URL(supabaseUrl).origin) {
    throw new Error('Stored reference image URL is not from this Supabase project');
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load a stored reference image (${response.status})`);
  return {
    data: encodeBase64(new Uint8Array(await response.arrayBuffer())),
    mimeType: response.headers.get('content-type')?.split(';')[0] || fallbackMime,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY not configured' }, 500);

  try {
    const { items, style, basePhoto, basePhotoUrl, setupType } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'No items provided' }, 400);
    }

    const itemList = items
      .map((i: { name?: string; category?: string }) =>
        `${i.name || 'item'}${i.category ? ` (${i.category})` : ''}`)
      .join(', ');

    // The kind of setup drives the whole scene: a server board should read as a
    // home lab (racks / networking gear), a laptop board as a portable desk,
    // everything else as a classic battlestation.
    const SCENES: Record<string, string> = {
      server:
        `a clean, professional home-lab / server setup that includes these exact products, ` +
        `each shown in the reference images: ${itemList}. Arrange them like a real home lab — ` +
        `servers and networking gear neatly rack-mounted or stacked on a shelf or open rack, ` +
        `tidy cable management, patch panels and short network cables, subtle blinking status ` +
        `LEDs. NOT a gaming desk — no keyboard/mouse battlestation vibe.`,
      laptop:
        `a clean, aesthetic laptop workspace that includes these exact products, each shown in ` +
        `the reference images: ${itemList}. Arrange them naturally on a tidy desk around the laptop.`,
      pc:
        `a clean, aesthetic desk setup / battlestation that includes these exact products, each ` +
        `shown in the reference images: ${itemList}. Arrange them naturally on a desk so it looks ` +
        `like a real, cohesive setup.`,
    };
    const sceneDesc = SCENES[setupType as string] || SCENES.pc;

    const parts: Array<Record<string, unknown>> = [];

    if (basePhoto || basePhotoUrl) {
      // EDIT mode — the first image is the user's real photo and must be
      // preserved; only the gear changes. Reference images follow it.
      const editPrompt =
        `The FIRST image is a real photograph of the user's actual setup. This is the ` +
        `scene you must edit. Keep it EXACTLY the same: identical room, walls, lighting, ` +
        `shadows, furniture, floor, background, camera angle, framing and perspective. ` +
        `Do NOT restyle, relight, recolor, crop, or regenerate the scene. ` +
        `The remaining images are the user's own products: ${itemList}. ` +
        `Place or swap in ONLY these products at their natural spots in the scene ` +
        `(monitor(s) on the desk, keyboard and mouse in front, PC tower/console beside or ` +
        `under the desk, deskmat under the keyboard/mouse), each faithful to its reference ` +
        `image — same shape, colour, and branding. Match each product to the original ` +
        `photo's lighting, perspective, and scale so it looks naturally composited in. ` +
        `Change nothing else in the photo. No text, no watermarks.`;
      parts.push({ text: editPrompt });
      const base = basePhotoUrl
        ? await remoteImage(basePhotoUrl, 'image/jpeg')
        : { data: basePhoto, mimeType: 'image/jpeg' };
      parts.push({ inline_data: { mime_type: base.mimeType, data: base.data } });
    } else {
      // GENERATE mode — no base photo, compose a fresh scene from the items.
      // The scene framing depends on the setup type (home lab vs desk vs laptop).
      const genPrompt =
        `Create ONE photorealistic photo of ${sceneDesc} ` +
        `${style ? `Style: ${style}. ` : 'Modern, minimal, well-lit, shallow depth of field. '}` +
        `Keep each product faithful to its reference image. High detail, no text, no watermarks.`;
      parts.push({ text: genPrompt });
    }

    for (const it of items) {
      if (it.photo) {
        parts.push({ inline_data: { mime_type: 'image/png', data: it.photo } });
      } else if (it.photoUrl) {
        const reference = await remoteImage(it.photoUrl, 'image/png');
        parts.push({ inline_data: { mime_type: reference.mimeType, data: reference.data } });
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || 'Gemini request failed' }, 502);

    // Generated image comes back as an inline_data part (camelCase in responses).
    const outParts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = outParts.find((p: Record<string, any>) => p.inlineData?.data || p.inline_data?.data);
    const image = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
    if (!image) return json({ error: 'No image returned from Gemini' }, 502);

    return json({ image });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
