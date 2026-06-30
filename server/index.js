require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = 3001;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/scan', async (req, res) => {
  const { photo } = req.body;
  if (!photo) return res.status(400).json({ error: 'No photo provided' });

  console.log(`📸 Received photo (${(photo.length / 1024).toFixed(1)} KB)`);

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: photo },
          },
          {
            type: 'text',
            text: `You are a 3D product reconstruction assistant. Analyze this photo and output JSON only, no prose.

OUTPUT FORMAT:
{
  "product_name": "",
  "brand": "exact brand name if visible, or 'Unknown' if not identifiable",
  "category": "",
  "estimated_dimensions": { "width": "", "height": "", "depth": "", "unit": "cm" },
  "primary_colors": [],
  "materials": [],
  "surface_texture": "",
  "geometry_summary": "",
  "confidence": 0.0,
  "model_prompt": ""
}`,
          },
        ],
      }],
    });

    const raw = response.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Claude response');

    const product = JSON.parse(jsonMatch[0]);
    console.log(`✅ Identified: ${product.product_name} (${Math.round(product.confidence * 100)}% confidence)`);

    res.json({ product });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: 'Failed to analyze image', details: e.message });
  }
});

app.post('/api/remove-bg', async (req, res) => {
  const { photo } = req.body;
  if (!photo) return res.status(400).json({ error: 'No photo provided' });

  try {
    const form = new URLSearchParams();
    form.append('image_file_b64', photo);
    form.append('size', 'auto');
    form.append('format', 'png');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY },
      body: form,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.errors?.[0]?.title || 'remove.bg failed');
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    console.log('✅ Background removed');
    res.json({ image: base64 });
  } catch (e) {
    console.error('remove.bg error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ mysetup server running on http://0.0.0.0:${PORT}`);
});
