import 'react-native-url-polyfill/auto';
import * as WebBrowser from 'expo-web-browser';

// ─── Affiliate config ─────────────────────────────────────────────────────────
// Your Amazon Associates tracking ID (StoreID). Registered on amazon.ca, so
// links must point at .ca for this tag to earn. For other countries later, set
// up Amazon OneLink to auto-route + tag per marketplace.
export const AMAZON_ASSOCIATE_TAG = 'mysetupapp0d-20';

// Marketplace your Associates account is registered in.
export const AMAZON_DOMAIN = 'www.amazon.ca';

// FTC requires a visible disclosure wherever affiliate links appear.
export const AFFILIATE_DISCLOSURE =
  'As an Amazon Associate, mysetup earns from qualifying purchases.';

const AMAZON_HOST = /(^|\.)amazon\.[a-z.]+$/i;

function cleanPart(value) {
  const v = String(value || '').trim();
  return v && v.toLowerCase() !== 'unknown' ? v : '';
}

// Build an Amazon URL for a product:
//  • if we already have an Amazon product URL, keep it and set our tag;
//  • otherwise fall back to a tagged Amazon search on brand + product name.
// Works with just a product name (no catalog needed) — see Option A.
export function amazonAffiliateUrl(product) {
  const tag = AMAZON_ASSOCIATE_TAG;
  const existing = product?.purchase_url || product?.product_url || product?.source_url;

  if (existing) {
    try {
      const url = new URL(existing);
      if (AMAZON_HOST.test(url.hostname)) {
        if (tag) url.searchParams.set('tag', tag);
        return url.toString();
      }
    } catch {
      /* not a parseable URL — fall through to search */
    }
  }

  const query =
    [cleanPart(product?.brand), cleanPart(product?.product_name)].filter(Boolean).join(' ') ||
    cleanPart(product?.product_name) ||
    'desk setup gear';
  const base = `https://${AMAZON_DOMAIN}/s?k=${encodeURIComponent(query)}`;
  return tag ? `${base}&tag=${encodeURIComponent(tag)}` : base;
}

// Open the affiliate link in the in-app browser.
export async function openAmazonAffiliate(product) {
  try {
    await WebBrowser.openBrowserAsync(amazonAffiliateUrl(product));
  } catch {
    /* user closed / no browser available */
  }
}
