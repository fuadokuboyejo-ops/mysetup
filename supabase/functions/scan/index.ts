// scan — Mistral vision proxy for editable gear-receipt suggestions.
//
// Deploy:  supabase functions deploy scan
// Secret:  supabase secrets set MISTRAL_API_KEY=...
// Optional model override: supabase secrets set MISTRAL_VISION_MODEL=...
//
// App: supabase.functions.invoke('scan', { body: { photo, productType } })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RECEIPT_FIELDS: Record<string, string[]> = {
  mouse: ['brand', 'model', 'weight', 'connection', 'dpi', 'switches'],
  keyboard: ['brand', 'model', 'percentage', 'switches', 'layout', 'connection'],
  monitor: ['brand', 'model', 'hz', 'inches', 'resolution', 'features'],
  deskmat: ['brand', 'model', 'size', 'material', 'thickness', 'color'],
  pc_tower: ['case', 'cpu', 'gpu', 'motherboard', 'psu', 'rgb'],
  server: ['brand', 'model', 'form_factor', 'role', 'cpu', 'ram', 'storage', 'os'],
  laptop: ['brand', 'model'],
  console: ['brand', 'model'],
  other: ['brand', 'name', 'category', 'model', 'color', 'notes'],
};

const CATEGORY_GUIDANCE: Record<string, string> = {
  laptop: 'A visible macOS menu bar or Dock is strong evidence that the laptop is Apple. If it is clearly an Apple laptop but Air versus Pro and generation cannot be proven, use model "MacBook". Never label a macOS laptop ASUS, ROG, Lenovo, Dell, HP, or Razer.',
  monitor: 'A wallpaper or computer desktop shown on the panel does not identify the monitor brand or model. Only use bezel logos, labels, or uniquely identifying physical details.',
  pc_tower: 'The exterior photo cannot reveal CPU, GPU, motherboard, PSU, RAM, or storage. Leave those blank unless their exact text is visibly readable in the photo.',
  server: 'Do not infer internal CPU, RAM, storage, operating system, or role from the chassis alone. Read visible manufacturer/model labels when possible.',
  keyboard: 'Do not infer switch type or connection from keycap appearance. Layout and approximate size may be entered only when clearly visible.',
  mouse: 'Do not infer DPI, sensor, switches, weight, or connection from shape alone.',
};

const FIELD_CONFIDENCE_THRESHOLD = 0.8;

function promptFor(productType: string, fieldNames: string[]) {
  return `Analyze this photo of a ${productType} and prefill an editable gear receipt.

Return JSON only in this exact shape:
{"fields":{${fieldNames.map(name => `"${name}":""`).join(',')}},"field_confidence":{${fieldNames.map(name => `"${name}":0.0`).join(',')}},"field_evidence":{${fieldNames.map(name => `"${name}":""`).join(',')}},"observations":{"operating_system":"","operating_system_confidence":0.0},"confidence":0.0}

Rules:
- First inspect logos, readable labels, operating-system UI, ports, and physical construction. Then perform a second consistency check before answering.
- Every field value and evidence value must be a string. Every confidence must be a number from 0 to 1.
- Use an empty field, empty evidence, and confidence 0 when a value is not directly supported by the photo.
- Do not invent hidden specifications such as CPU, GPU, refresh rate, DPI, switches, storage, or power supply.
- Brand and model must be concise. Exact model names require readable text or genuinely unique visual evidence; general resemblance is not evidence.
- Do not use a generic visual description as the model name.
- Do not copy a familiar product name from memory just because the item has a similar shape.
- A non-empty field is accepted only when its field_confidence is at least 0.8 and field_evidence states the visible proof.
- For multiple features, use a comma-separated string.
- Omit units already shown by the receipt: weight is grams, hz is Hz, inches is inches, thickness is millimetres, and ram is GB.
${CATEGORY_GUIDANCE[productType] || ''}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const apiKey = Deno.env.get('MISTRAL_API_KEY');
  if (!apiKey) return json({ error: 'MISTRAL_API_KEY not configured' }, 503);

  try {
    const { photo, productType = 'other' } = await req.json();
    if (!photo) return json({ error: 'No photo provided' }, 400);

    const fieldNames = RECEIPT_FIELDS[productType] || RECEIPT_FIELDS.other;
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('MISTRAL_VISION_MODEL') || 'mistral-large-2512',
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: promptFor(productType, fieldNames) },
            { type: 'image_url', image_url: `data:image/jpeg;base64,${photo}` },
          ],
        }],
      }),
    });

    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = response.status === 401
        ? 'Mistral rejected MISTRAL_API_KEY. Replace it in Supabase Edge Function secrets.'
        : responseBody?.message
          || responseBody?.error?.message
          || (typeof responseBody?.error === 'string' ? responseBody.error : '')
          || `Mistral returned ${response.status}`;
      return json({
        error: 'Failed to analyze image with Mistral',
        details,
      }, 502);
    }

    const raw = responseBody?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') {
      return json({ error: 'Failed to analyze image with Mistral', details: 'No receipt data returned' }, 502);
    }

    const parsed = JSON.parse(raw);
    const suggested = parsed?.fields && typeof parsed.fields === 'object' ? parsed.fields : parsed;
    const suggestedConfidence = parsed?.field_confidence && typeof parsed.field_confidence === 'object'
      ? parsed.field_confidence
      : {};
    const suggestedEvidence = parsed?.field_evidence && typeof parsed.field_evidence === 'object'
      ? parsed.field_evidence
      : {};
    const fields = Object.fromEntries(fieldNames.map(name => {
      const value = suggested?.[name];
      const fieldConfidence = Number(suggestedConfidence?.[name]);
      const evidence = typeof suggestedEvidence?.[name] === 'string' ? suggestedEvidence[name].trim() : '';
      if (!Number.isFinite(fieldConfidence) || fieldConfidence < FIELD_CONFIDENCE_THRESHOLD || !evidence) {
        return [name, ''];
      }
      if (Array.isArray(value)) return [name, value.map(String).join(', ').trim()];
      if (typeof value === 'string') return [name, value.trim()];
      if (typeof value === 'number' || typeof value === 'boolean') return [name, String(value)];
      return [name, ''];
    }));

    // Apply a deterministic cross-check for the most common high-confidence
    // contradiction: a laptop visibly running macOS cannot be an ASUS/ROG/etc.
    const observedOs = typeof parsed?.observations?.operating_system === 'string'
      ? parsed.observations.operating_system.trim().toLowerCase()
      : '';
    const observedOsConfidence = Number(parsed?.observations?.operating_system_confidence);
    if (
      productType === 'laptop'
      && Number.isFinite(observedOsConfidence)
      && observedOsConfidence >= 0.85
      && /mac\s?os|macintosh/.test(observedOs)
    ) {
      fields.brand = 'Apple';
      if (!/^macbook\b/i.test(fields.model || '')) fields.model = 'MacBook';
    }
    const confidence = Number.isFinite(Number(parsed?.confidence))
      ? Math.max(0, Math.min(1, Number(parsed.confidence)))
      : null;

    // `product` keeps the response compatible with the retired PreviewScreen
    // while the current GearReceiptScreen consumes the category-specific fields.
    const productName = fields.model || fields.name || fields.case || '';
    const product = {
      product_name: productName,
      brand: fields.brand || 'Unknown',
      category: fields.category || productType,
      confidence,
      estimated_dimensions: null,
      primary_colors: fields.color ? [fields.color] : [],
      materials: fields.material ? [fields.material] : [],
      surface_texture: fields.material || '',
    };

    return json({ fields, confidence, product });
  } catch (error) {
    return json({
      error: 'Failed to analyze image with Mistral',
      details: error instanceof Error ? error.message : 'Unexpected error',
    }, 500);
  }
});
