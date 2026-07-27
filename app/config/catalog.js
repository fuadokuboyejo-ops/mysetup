// Catalog — live product search (eBay-backed) for adding gear to a setup.
//
// This is a LIVE search, not a stored catalog: we query on demand and only
// persist the single item the user chooses (as their own library item). See the
// product-search edge function for why we don't mirror eBay's data.
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { addSetupItem } from './setup';

// Lightweight query classifier so the catalog can gently reject clearly non-tech
// searches ("shoes") while still allowing brand/model names it doesn't recognize.
const TECH_WORDS = new Set([
  'keyboard', 'keyboards', 'keycap', 'keycaps', 'switch', 'switches', 'mouse', 'mice', 'mousepad', 'deskmat', 'wristrest',
  'monitor', 'monitors', 'display', 'ultrawide', 'oled', 'ips', 'screen',
  'pc', 'desktop', 'tower', 'computer', 'rig', 'laptop', 'notebook', 'macbook', 'chromebook', 'server', 'nas',
  'console', 'playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'deck', 'controller', 'gamepad', 'joystick',
  'headset', 'headsets', 'headphone', 'headphones', 'earbud', 'earbuds', 'speaker', 'speakers', 'soundbar', 'mic', 'microphone', 'webcam',
  'gpu', 'graphics', 'rtx', 'gtx', 'radeon', 'cpu', 'processor', 'ryzen', 'intel', 'core', 'ram', 'memory', 'ssd', 'hdd', 'nvme', 'storage',
  'motherboard', 'mobo', 'psu', 'cooler', 'aio', 'fan', 'fans', 'case',
  'dock', 'hub', 'usb', 'usbc', 'hdmi', 'displayport', 'cable', 'charger', 'adapter', 'kvm', 'capture',
  'router', 'modem', 'wifi', 'ethernet', 'tablet', 'ipad', 'stylus', 'trackpad', 'trackball', 'arm', 'mount', 'stand', 'rgb', 'led',
  // brands
  'logitech', 'razer', 'keychron', 'corsair', 'asus', 'rog', 'acer', 'lg', 'samsung', 'dell', 'hp', 'apple', 'sony', 'bose', 'sennheiser',
  'steelseries', 'hyperx', 'ducky', 'nzxt', 'elgato', 'glorious', 'msi', 'gigabyte', 'benq', 'viewsonic', 'aoc', 'wooting', 'akko', 'nuphy',
  'anker', 'ugreen', 'shure', 'rode', 'edifier', 'jbl', 'nvidia', 'amd', 'beyerdynamic', 'secretlab', 'grovemade',
]);

const NON_TECH_WORDS = new Set([
  'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'heel', 'heels',
  'shirt', 'tshirt', 'tee', 'dress', 'pants', 'jeans', 'jacket', 'coat', 'hoodie', 'sweater', 'sock', 'socks', 'hat', 'cap', 'glove', 'gloves', 'scarf', 'belt', 'purse', 'wallet', 'handbag', 'tote',
  'watch', 'watches', 'jewelry', 'ring', 'necklace', 'bracelet', 'earring', 'earrings', 'sunglasses',
  'perfume', 'cologne', 'makeup', 'lipstick', 'cosmetic', 'cosmetics', 'skincare', 'shampoo', 'lotion',
  'food', 'snack', 'snacks', 'candy', 'chocolate', 'coffee', 'tea', 'vitamin', 'vitamins', 'supplement', 'supplements', 'protein',
  'toy', 'toys', 'doll', 'lego', 'puzzle', 'book', 'books', 'magazine',
  'sofa', 'couch', 'mattress', 'pillow', 'blanket', 'curtain', 'rug', 'towel',
  'car', 'tire', 'tires', 'motorcycle', 'bike', 'bicycle', 'scooter',
  'plant', 'flower', 'seed', 'seeds', 'drill', 'hammer', 'wrench',
  'guitar', 'piano', 'drum', 'violin',
  'nail', 'hair', 'wig', 'razor', 'toothbrush', 'diaper', 'baby', 'pet', 'dog', 'cat',
  'grill', 'pan', 'pot', 'knife', 'fork', 'plate', 'mug', 'bottle',
]);

function normTokens(q) {
  return String(q || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

// Returns 'tech' | 'nontech' | 'unknown'. Tech wins over nontech so "laptop bag"
// reads as tech; "unknown" (unrecognized model names) is allowed through to search.
export function classifyQuery(q) {
  const tokens = normTokens(q);
  if (!tokens.length) return 'unknown';
  const singular = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
  if (tokens.some((w) => TECH_WORDS.has(w) || TECH_WORDS.has(singular(w)))) return 'tech';
  if (tokens.some((w) => NON_TECH_WORDS.has(w) || NON_TECH_WORDS.has(singular(w)))) return 'nontech';
  return 'unknown';
}

// Strip the "🔥 BRAND NEW!!! FAST SHIP" noise off marketplace titles so the item
// reads cleanly in the library. Keeps letters/numbers and basic punctuation.
export function cleanTitle(raw) {
  return String(raw || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '') // emoji
    .replace(/[|•]/g, ' ')
    .replace(/\b(brand ?new|free ?ship\w*|fast ?ship\w*|us seller|oem|genuine|authentic|lot of \d+)\b/gi, '')
    .replace(/!+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);
}

// Search the catalog. `category` is one of the PRODUCT_GUIDES keys (or undefined)
// and scopes the query server-side. Returns [] on no match.
export async function searchCatalog(query, category) {
  const q = String(query || '').trim();
  if (!q) return [];
  const { data, error } = await supabase.functions.invoke('product-search', {
    body: { q, category, limit: 24 },
  });
  if (error) throw new Error(error.message || 'Search failed');
  if (data?.error) throw new Error(data.error);
  return data?.results || [];
}

// Download a remote image to the cache and return raw base64 (no data: prefix),
// so we can reuse the existing addSetupItem upload path. Uses expo-file-system
// rather than fetch().blob() — React Native can't build blobs from binary.
async function urlToBase64(url) {
  const target = `${FileSystem.cacheDirectory}catalog_${Date.now()}.img`;
  const { uri, status } = await FileSystem.downloadAsync(url, target);
  if (status && status >= 400) throw new Error(`Could not download image (${status})`);
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } finally {
    // Clean up the temp file; ignore if it's already gone.
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

// Add a chosen search result to the user's library. We try to cut out the
// background (via the remove-bg function) so the item is board-ready; marketplace
// photos vary, so on failure we fall back to saving the original image as a plain
// reference — the same graceful behavior as the scan flow.
// Returns { item, isCutout } so the caller can reflect board-readiness.
export async function addCatalogItem(result, category = 'other') {
  const original = await urlToBase64(result.image);

  let image = original;
  let isCutout = false;
  try {
    const { data, error } = await supabase.functions.invoke('remove-bg', {
      body: { photo: original },
    });
    if (!error && data?.image) {
      image = data.image;
      isCutout = true;
    }
  } catch {
    /* cutout failed — keep the original image as a reference */
  }

  const product = {
    product_name: cleanTitle(result.title),
    brand: '',
    category,
    price: result.price ?? null,
    currency: result.currency || 'USD',
    // Where it came from — the buy link + a marker the price is a live reference.
    purchase_url: result.url || null,
    source: 'ebay',
    condition: result.condition || null,
    specs: {},
  };
  const item = await addSetupItem('default', product, image, isCutout);
  return { item, isCutout };
}
