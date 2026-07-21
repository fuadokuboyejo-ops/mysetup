import { supabase } from './supabase';

export const AUTH_REDIRECT_URL = 'mysetup://auth/callback';

function authParams(url) {
  const [beforeHash, hash = ''] = String(url || '').split('#');
  const query = beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

const redirectAttempts = new Map();

// Thin wrapper around Supabase auth so screens don't import the client directly
// and error messages stay consistent. All functions resolve to { error } (a
// string or null) plus any data, never throw, so callers can render inline.

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: AUTH_REDIRECT_URL },
  });
  return { user: data?.user ?? null, session: data?.session ?? null, error: error?.message ?? null };
}

export async function resendSignupConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: AUTH_REDIRECT_URL },
  });
  return { error: error?.message ?? null };
}

// Completes email-confirmation and OAuth links delivered to the app. Supabase
// may use a PKCE code, a token hash, or an access/refresh token pair depending
// on the project's Auth template settings.
async function completeAuthRedirect(url) {
  if (!url || !String(url).startsWith(AUTH_REDIRECT_URL)) {
    return { handled: false, session: null, error: null };
  }

  const params = authParams(url);
  const redirectError = params.get('error_description') || params.get('error');
  if (redirectError) return { handled: true, session: null, error: redirectError };

  const code = params.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    return { handled: true, session: data?.session ?? null, error: error?.message ?? null };
  }

  const tokenHash = params.get('token_hash');
  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: params.get('type') || 'signup',
    });
    return { handled: true, session: data?.session ?? null, error: error?.message ?? null };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { handled: true, session: data?.session ?? null, error: error?.message ?? null };
  }

  return { handled: true, session: null, error: 'The verification link is invalid or expired.' };
}

// OAuth browser completion and the app-level Linking listener can receive the
// same callback simultaneously. Cache each attempt so a one-time PKCE code is
// never exchanged twice.
export function handleAuthRedirect(url) {
  const key = String(url || '');
  if (!redirectAttempts.has(key)) {
    redirectAttempts.set(key, completeAuthRedirect(url));
  }
  return redirectAttempts.get(key);
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return { user: data?.user ?? null, session: data?.session ?? null, error: error?.message ?? null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// Subscribe to sign-in / sign-out. Returns an unsubscribe function.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
