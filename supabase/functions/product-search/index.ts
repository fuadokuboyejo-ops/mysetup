// product-search — live product search for the in-app catalog (eBay Browse API).
//
// Powers the "Add from catalog" screen: the user types a query, we return a list
// of matching products (name, image, price, buy link) that they can add to their
// setup. This is a LIVE search — we never store or mirror eBay's catalog, which
// their API License Agreement prohibits. The app only saves the item the user
// picks, as their own setup item.
//
// Deploy:  supabase functions deploy product-search
// Secrets: reuses EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (same keyset as price-lookup)
//
// App:     supabase.functions.invoke('product-search', { body: { q, category, limit } })
// Returns: { results: [{ itemId, title, image, price, currency, condition, url }] }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scope an eBay query with a category hint so "K2" under Keyboard doesn't return
// vitamins. Values map to how people actually search, not our internal keys.
const CATEGORY_TERMS: Record<string, string> = {
  mouse: 'mouse',
  monitor: 'monitor',
  keyboard: 'keyboard',
  pc_tower: 'desktop pc',
  server: 'server',
  laptop: 'laptop',
  console: 'game console',
  deskmat: 'desk mat',
  other: '',
};

// Restrict every search to a tech category so the catalog never returns clothes,
// vitamins, etc. eBay's Browse API only reliably honors a SINGLE category_id per
// request, so we map each catalog category to one L1 (top-level) tech category
// on EBAY_US and default the rest to Computers/Tablets & Networking:
//   58058 = Computers/Tablets & Networking (keyboards, mice, monitors, PCs, mousepads)
//   1249  = Video Games & Consoles
//   293   = Consumer Electronics (audio, mics, misc electronics)
const CATEGORY_ID: Record<string, string> = {
  mouse: '58058',
  keyboard: '58058',
  monitor: '58058',
  pc_tower: '58058',
  server: '58058',
  laptop: '58058',
  deskmat: '58058',
  console: '1249',
  other: '293',
};
const DEFAULT_CATEGORY_ID = '58058';

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
    const { q, category, limit } = await req.json();
    const term = String(q || '').trim();
    const catTerm = CATEGORY_TERMS[category as string] || '';
    const query = [term, catTerm].filter(Boolean).join(' ').trim();
    if (!query) return json({ results: [] });

    const token = await getAppToken(clientId, clientSecret);
    const count = Math.min(Math.max(Number(limit) || 20, 1), 30);

    // Fixed-price listings, most-relevant first, restricted to a tech category.
    const catId = CATEGORY_ID[category as string] || DEFAULT_CATEGORY_ID;
    const url =
      'https://api.ebay.com/buy/browse/v1/item_summary/search' +
      `?q=${encodeURIComponent(query)}` +
      `&category_ids=${catId}` +
      `&filter=buyingOptions:%7BFIXED_PRICE%7D&limit=${count}`;
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

    // Only keep results we can actually show (image + price). Prefer NEW items by
    // sorting them to the front while preserving eBay's relevance order otherwise.
    const results = summaries
      .filter((s) => s?.price?.value != null && s?.image?.imageUrl)
      .map((s) => ({
        itemId: s.itemId || null,
        title: s.title || 'Untitled',
        image: s.image.imageUrl,
        price: parseFloat(s.price.value),
        currency: s.price.currency || 'USD',
        condition: s.condition || null,
        url: s.itemWebUrl || null,
        isNew: (s.condition || '').toUpperCase().includes('NEW'),
      }))
      .sort((a, b) => Number(b.isNew) - Number(a.isNew))
      .slice(0, count);

    return json({ results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
