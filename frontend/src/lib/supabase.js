import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

/** False when the build has no Supabase credentials baked in. */
export const isConfigured = Boolean(url && anonKey);

// Throwing here would white-screen the whole app, which is a poor way to say
// "an environment variable is missing". App.js checks isConfigured and renders
// instructions instead; every data call is behind that check.
//
// The anon key is a publishable key and is meant to ship in the bundle. What
// protects the data is Row Level Security — see the warning at the bottom of
// supabase/migrations/0001_init.sql: the policies are currently wide open.
export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        // Persist so a reload keeps the session, and refresh tokens before they
        // expire so a long-lived dashboard does not silently start failing.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export default supabase;
