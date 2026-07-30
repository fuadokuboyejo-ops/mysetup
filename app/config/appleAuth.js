import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

// Whether the native "Sign in with Apple" sheet can be shown. iOS-only — the
// native flow doesn't exist on Android (that would need a browser OAuth flow
// with a Services ID configured, like Google). Callers use this to hide the
// button off iOS.
export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

// Native Apple sign-in. Presents Apple's system sheet, then hands the returned
// identity token to Supabase, which verifies it and mints a session. Requires a
// development build (no Expo Go) and the Apple provider enabled in Supabase with
// the app's bundle id (com.mysetup.app) in its authorized client IDs.
export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { user: null, error: 'Apple did not return an identity token.' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) return { user: null, error: error.message };

    // Apple only sends the user's name on the VERY FIRST authorization, never on
    // later sign-ins. Capture it now so the profile isn't left nameless — but
    // don't clobber a name the account already has.
    const given = credential.fullName?.givenName;
    const family = credential.fullName?.familyName;
    const fullName = [given, family].filter(Boolean).join(' ').trim();
    if (fullName && data?.user && !data.user.user_metadata?.full_name) {
      await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
    }

    return { user: data?.user ?? null, error: null };
  } catch (e) {
    // The user tapping "Cancel" on the Apple sheet isn't an error.
    if (e?.code === 'ERR_REQUEST_CANCELED') {
      return { user: null, error: null, cancelled: true };
    }
    return { user: null, error: e?.message ?? 'Apple sign-in failed.' };
  }
}
