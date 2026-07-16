import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Credentials come from EXPO_PUBLIC_* env vars (see .env / .env.example). The
// anon key is safe to ship in the client — row-level security in Postgres is
// what actually protects the data, not the secrecy of this key.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// A missing config is almost always "forgot to fill in .env / restart Metro",
// so fail loudly rather than letting requests silently 401 later.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
    'Add them to app/.env and restart the Expo server (npx expo start -c).',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    // Persist the session across app launches using the same AsyncStorage the
    // rest of the app already uses.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no browser URL to parse a session out of in React Native.
    detectSessionInUrl: false,
    // PKCE: the OAuth redirect comes back with a ?code= that we exchange for a
    // session. The client stashes the code_verifier in AsyncStorage for us.
    flowType: 'pkce',
  },
});
