// Stored media values are either legacy/raw base64 or a Supabase Storage URL.
// Keeping this normalization in one place lets components render both while
// local data is being replaced by Storage-backed records.
export function imageUri(value, mimeType = 'image/jpeg') {
  if (!value) return null;
  if (/^(data:|https?:|file:|content:|blob:)/i.test(value)) return value;
  return `data:${mimeType};base64,${value}`;
}

export function isMediaUrl(value) {
  return typeof value === 'string' && /^(https?:|file:|content:|blob:)/i.test(value);
}

export function stripDataUrl(value) {
  if (!value) return '';
  const match = String(value).match(/^data:[^;]+;base64,(.*)$/s);
  return match ? match[1] : String(value);
}

