// RevenueCat wiring — configures the SDK and exposes a simple pro-entitlement
// check. Kept in one place so App.js just calls initPurchases() on startup.
import { NativeModules } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// Must match the entitlement identifier in the RevenueCat dashboard EXACTLY.
// Yours is "MySetup Pro" (with the space + capitals).
export const ENTITLEMENT_ID = 'MySetup Pro';

// Public SDK key from RevenueCat → Project Settings → API Keys.
// NOTE: this "test_" key looks like a Test Store key rather than the platform
// (appl_/goog_) SDK keys a shipping build needs — fine for testing now.
const API_KEY = 'test_MvKmRkXIvbWRMzIxyWbueuHADNH';

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
