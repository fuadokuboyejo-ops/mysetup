import { supabase } from './supabase';

// Thin wrapper around Supabase auth so screens don't import the client directly
// and error messages stay consistent. All functions resolve to { error } (a
// string or null) plus any data, never throw, so callers can render inline.

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  return { user: data?.user ?? null, session: data?.session ?? null, error: error?.message ?? null };
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
