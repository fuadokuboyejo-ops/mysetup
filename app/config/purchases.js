// RevenueCat wiring — configures the SDK and exposes a simple pro-entitlement
// check. Kept in one place so App.js just calls initPurchases() on startup.
import { NativeModules } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// Must match the entitlement identifier in the RevenueCat dashboard EXACTLY.
// Yours is "MySetup Pro" (with the space + capitals).
export const ENTITLEMENT_ID = 'MySetup Pro';

// Public SDK key from RevenueCat → API keys → SDK API keys (App Store / Apple).
// This is the iOS platform key (appl_...) a shipping App Store / TestFlight build
// needs. It's a publishable client key — safe to embed. If Android ships later,
// switch to Platform.select({ ios: 'appl_...', android: 'goog_...' }).
const API_KEY = 'appl_YbciCqQzZTjGlFFXnBqQeYrprGk';

// Configure RevenueCat and report whether we actually connected. Guarded so a
// dev build without the native module just warns instead of crashing startup.
export async function initPurchases() {
  try {
    // The JS wrapper always exists, but its methods call into the native
    // RNPurchases module — which is null unless the app was built with
    // `expo run:android`/`run:ios`. Check that first so we fail with a clear
    // message instead of a cryptic "of null".
    if (!NativeModules.RNPurchases) {
      console.warn('[purchases] native module NOT in this build — run `npx expo run:android` (a JS-only reload won\'t include it)');
      return null;
    }
    // Safety net: a Test Store key ("test_...") can hard-crash a real App
    // Store / TestFlight build when the SDK talks to StoreKit. Never configure
    // with one outside dev — skip purchases entirely so the app still opens.
    if (!__DEV__ && (!API_KEY || API_KEY.startsWith('test_'))) {
      console.warn('[purchases] skipping init — a production build needs a platform key (appl_/goog_), not a test_ key');
      return null;
    }
    if (__DEV__ && Purchases.setLogLevel) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: API_KEY });
    const info = await Purchases.getCustomerInfo();
    const active = Object.keys(info?.entitlements?.active || {});
    console.log('[purchases] CONNECTED ✅ appUserID:', await Purchases.getAppUserID(), 'active entitlements:', active);
    return info;
  } catch (e) {
    console.warn('[purchases] init FAILED ❌:', e?.message || e);
    return null;
  }
}

// True when the signed-in RevenueCat user has the pro entitlement active.
export async function hasProEntitlement() {
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

// The current offering (the one marked "Current" in the RevenueCat dashboard),
// or null if RevenueCat isn't reachable / nothing is configured. A custom
// paywall reads its packages + live localized prices from here.
export async function getProOfferings() {
  if (!NativeModules.RNPurchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current ?? null;
  } catch (e) {
    console.warn('[purchases] getOfferings failed:', e?.message || e);
    return null;
  }
}

// Describe a package's introductory offer (the free trial / intro price you set
// up on the store product), or null if it has none. The trial itself is granted
// by the store when configured in App Store Connect / Google Play Console — this
// only reads what RevenueCat reports so the paywall never claims a trial that
// isn't actually there.
//   → { isFree, periodText: "3-day", label: "3-day free trial" }
export function introOffer(pkg) {
  const intro = pkg?.product?.introPrice;
  const units = intro?.periodNumberOfUnits;
  const unit = String(intro?.periodUnit || '').toLowerCase(); // day | week | month | year
  if (!intro || !units || !unit) return null;

  const isFree = (intro.price ?? 0) === 0;
  const periodText = `${units}-${unit}`; // RevenueCat already gives singular units
  return {
    isFree,
    periodText,
    label: isFree ? `${periodText} free trial` : `${periodText} intro offer`,
  };
}

// Buy a package. Resolves { unlocked, cancelled, error } — cancelled is the
// user backing out (not an error to surface), unlocked means the pro
// entitlement is now active.
export async function purchasePackage(pkg) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { unlocked: !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] };
  } catch (e) {
    if (e?.userCancelled) return { cancelled: true };
    return { error: e?.message || 'Purchase failed' };
  }
}

// Restore prior purchases; resolves whether the pro entitlement is now active.
export async function restorePurchases() {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { unlocked: !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] };
  } catch (e) {
    return { unlocked: false, error: e?.message || 'Restore failed' };
  }
}
