require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { execSync, spawn } = require('child_process');

const app = express();
const PORT = 3001;
const LOCAL_IP = '192.168.68.51';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OUTPUT_DIR = path.join(__dirname, 'output');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/output', express.static(OUTPUT_DIR));

const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

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

// AI Revamp — compose the board's items into one photorealistic desk-setup photo
// using Gemini 2.5 Flash Image ("nano banana"), passing each item's photo as a
// reference so the generated scene contains the user's actual gear.
app.post('/api/revamp', async (req, res) => {
  const { items, style } = req.body;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  try {
    const itemList = items
      .map(i => `${i.name || 'item'}${i.category ? ` (${i.category})` : ''}`)
      .join(', ');
    const promptText =
      `Create ONE photorealistic photo of a clean, aesthetic desk setup / battlestation that ` +
      `includes these exact products, each shown in the reference images: ${itemList}. ` +
      `Arrange them naturally on a desk so it looks like a real, cohesive setup. ` +
      `${style ? `Style: ${style}. ` : 'Modern, minimal, well-lit, shallow depth of field. '}` +
      `Keep each product faithful to its reference image. High detail, no text, no watermarks.`;

    const parts = [{ text: promptText }];
    for (const it of items) {
      if (it.photo) parts.push({ inline_data: { mime_type: 'image/png', data: it.photo } });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'Gemini request failed');

    // The generated image comes back as an inline_data part (camelCase in responses).
    const outParts = data.candidates?.[0]?.content?.parts || [];
    const imgPart = outParts.find(p => p.inlineData?.data || p.inline_data?.data);
    const image = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
    if (!image) throw new Error('No image returned from Gemini');

    console.log(`✨ Revamp generated from ${items.length} item(s)`);
    res.json({ image });
  } catch (e) {
    console.error('revamp error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/remove-bg-video', videoUpload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video provided' });

  const ts = Date.now();
  const inputPath = path.join(UPLOADS_DIR, `input_${ts}.mp4`);
  const outputFilename = `wallpaper_${ts}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  try {
    fs.writeFileSync(inputPath, req.file.buffer);

    // Get actual video dimensions
    const probe = JSON.parse(execSync(`ffprobe -v quiet -print_format json -show_streams "${inputPath}"`));
    const stream = probe.streams.find(s => s.codec_type === 'video');
    const W = stream.width;
    const H = stream.height;

    // The green monitorGuide overlay in CameraScreen is: 90% of the preview width,
    // 16:9 aspect, centered. But the camera preview is cover-fit, so the guide does
    // NOT map to 90% of the *video* width — the preview crops the video first.
    // Using the preview aspect (width/height) we map the guide through that crop to
    // exact video pixels; without it we fall back to the naive centered box.
    const even = n => Math.max(2, Math.floor(n / 2) * 2);
    const previewAspect = parseFloat(req.body.previewAspect);

    let cropW, cropH, cropX, cropY;
    if (previewAspect && previewAspect > 0) {
      const videoAspect = W / H;
      // Visible region of the video inside the cover-fit preview.
      let visW, visH, offX, offY;
      if (videoAspect > previewAspect) {       // video wider than preview → sides cropped
        visH = H; visW = H * previewAspect; offX = (W - visW) / 2; offY = 0;
      } else {                                  // video taller than preview → top/bottom cropped
        visW = W; visH = W / previewAspect; offX = 0; offY = (H - visH) / 2;
      }
      // Guide as fractions of the preview: width 0.9, height 0.9 * aspect * 9/16, centered.
      const gw = 0.9;
      const gh = 0.9 * previewAspect * 9 / 16;
      const gx = (1 - gw) / 2;
      const gy = (1 - gh) / 2;
      cropW = even(gw * visW);
      cropH = even(gh * visH);
      cropX = even(offX + gx * visW);
      cropY = even(offY + gy * visH);
    } else {
      cropW = even(W * 0.9);
      cropH = even(cropW * 9 / 16);
      cropX = even((W - cropW) / 2);
      cropY = even((H - cropH) / 2);
    }

    console.log(`🎬 Cropping ${W}x${H} (previewAspect=${previewAspect || 'n/a'}) → guide box ${cropW}x${cropH} at (${cropX},${cropY})`);

    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-i', inputPath,
        '-vf', `crop=${cropW}:${cropH}:${cropX}:${cropY}`,
        '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
        '-an', '-y',
        outputPath,
      ]);
      proc.stderr.on('data', d => process.stdout.write(d));
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    });

    fs.unlinkSync(inputPath);
    console.log('✅ Video cropped to monitor area');
    res.json({ video_url: `http://${LOCAL_IP}:${PORT}/output/${outputFilename}` });
  } catch (e) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    console.error('Video crop error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ mysetup server running on http://0.0.0.0:${PORT}`);
});
