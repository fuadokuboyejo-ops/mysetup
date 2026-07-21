import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { AUTH_REDIRECT_URL, handleAuthRedirect } from './auth';

WebBrowser.maybeCompleteAuthSession();

// Browser-based Google sign-in for the native app. The same callback is used
// by email verification so Supabase only needs one mobile redirect allow-list
// entry and every Auth link completes through the same session exchange.
export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: AUTH_REDIRECT_URL, skipBrowserRedirect: true },
    });
    if (error) return { user: null, error: error.message };
    if (!data?.url) return { user: null, error: 'Could not start Google sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URL);
    if (result.type === 'success' && result.url) {
      const completed = await handleAuthRedirect(result.url);
      return { user: completed.session?.user ?? null, error: completed.error };
    }
    return { user: null, error: null, cancelled: true };
  } catch (error) {
    return { user: null, error: error?.message ?? 'Google sign-in failed.' };
  }
}
