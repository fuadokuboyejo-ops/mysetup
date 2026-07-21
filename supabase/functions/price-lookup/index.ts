// price-lookup — current price + buy link for a scanned product (eBay Browse API).
//
// Holds the eBay app credentials server-side; the app calls this with just the
// user's JWT. eBay needs an OAuth app token (client-credentials grant), which we
// fetch and cache in-memory across warm invocations.
//
// Deploy:  supabase functions deploy price-lookup
// Secrets: supabase secrets set EBAY_CLIENT_ID=... EBAY_CLIENT_SECRET=...
//          (free production keyset from developer.ebay.com)
//
// App:     supabase.functions.invoke('price-lookup', { body: { name, brand, category } })
// Returns: { price, regularPrice, currency, source, purchase_url, matchedName, image, condition }
//          or { price: null } when nothing matches (still HTTP 200).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STOP = new Set([
  'the', 'and', 'with', 'for', 'series', 'edition', 'gen', 'unknown',
  'inch', 'in', 'new',
]);

// "Logitech G403 Gaming Mouse" → "logitech g403 gaming mouse" (max 5 terms).
function buildQuery(name: string, brand: string): string {
  const raw = `${brand && brand.toLowerCase() !== 'unknown' ? brand + ' ' : ''}${name || ''}`;
  const terms: string[] = [];
  for (const w of raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w.length >= 2 && !STOP.has(w) && !terms.includes(w)) terms.push(w);
    if (terms.length >= 5) break;
  }
  return terms.join(' ');
}

// Cache the app token across warm invocations — it's valid ~2h.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const basic = btoa(`${clientId}:${clientSecret}`);
  const r = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=' +
      encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  const data = await r.json();
  if (!r.ok || !data?.access_token) {
    throw new Error(data?.error_description || `eBay auth failed (${r.status})`);
  }
  // Refresh a minute early to be safe.
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in || 7200) - 60) * 1000,
  };
  return cachedToken.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return json({ error: 'EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not configured' }, 500);
  }

  try {
    const { name, brand } = await req.json();
    const q = buildQuery(name || '', brand || '');
    if (!q) return json({ price: null, reason: 'no searchable terms' });

    const token = await getAppToken(clientId, clientSecret);

    // Fixed-price listings, most-relevant first. We then prefer a NEW item.
    const url =
      'https://api.ebay.com/buy/browse/v1/item_summary/search' +
      `?q=${encodeURIComponent(q)}&filter=buyingOptions:%7BFIXED_PRICE%7D&limit=10`;
    const r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return json({ error: err?.errors?.[0]?.message || `eBay request failed (${r.status})` }, 502);
    }
    const data = await r.json();
    const summaries: any[] = data?.itemSummaries || [];
    const priced = summaries.filter((s) => s?.price?.value != null);
    if (priced.length === 0) return json({ price: null, reason: 'no match' });

    // Prefer NEW condition; otherwise take the first relevant result.
    const hit = priced.find((s) => (s.condition || '').toUpperCase().includes('NEW')) || priced[0];
    const value = parseFloat(hit.price.value);
    const original = hit?.marketingPrice?.originalPrice?.value
      ? parseFloat(hit.marketingPrice.originalPrice.value)
      : null;

    return json({
      price: value,
      regularPrice: original,
      currency: hit.price.currency || 'USD',
      source: 'ebay',
      purchase_url: hit.itemWebUrl || null,
      matchedName: hit.title || null,
      image: hit?.image?.imageUrl || null,
      condition: hit.condition || null,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
