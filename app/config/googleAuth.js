import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

// Dismisses the auth browser popup automatically if it's left open.
WebBrowser.maybeCompleteAuthSession();

// Deep link the OAuth redirect comes back to. In Expo Go this is an exp:// URL
// (tied to your LAN IP); in a real build it's mysetup:// (the scheme in
// app.json). Whatever this resolves to must be added to Supabase → Auth → URL
// Configuration → Redirect URLs.
const redirectTo = makeRedirectUri();

// Turn the redirect URL (…?code=…) into a Supabase session via PKCE exchange.
async function createSessionFromUrl(url) {
  const { queryParams } = Linking.parse(url);
  if (queryParams?.error) {
    return { user: null, error: String(queryParams.error_description || queryParams.error) };
  }
  const code = queryParams?.code;
  if (!code) return { user: null, error: 'No authorization code in the redirect.' };

  const { data, error } = await supabase.auth.exchangeCodeForSession(String(code));
  return { user: data?.session?.user ?? null, error: error?.message ?? null };
}

// Web-redirect Google sign-in: opens the Google login sheet in a browser, then
// exchanges the returned code for a session. Works in Expo Go. Resolves
// { user, error, cancelled } like the other auth helpers; never throws.
export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { user: null, error: error.message };
    if (!data?.url) return { user: null, error: 'Could not start Google sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      return await createSessionFromUrl(result.url);
    }
    // 'cancel' (user closed the sheet) or 'dismiss'.
    return { user: null, error: null, cancelled: true };
  } catch (e) {
    return { user: null, error: e?.message ?? 'Google sign-in failed.' };
  }
}
