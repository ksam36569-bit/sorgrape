import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Failing loudly here beats a wall of "Failed to fetch" further downstream.
  throw new Error(
    "Supabase is not configured. Set REACT_APP_SUPABASE_URL and " +
      "REACT_APP_SUPABASE_ANON_KEY (see .env.example), then restart the dev server. " +
      "Create React App inlines these at build time, so a running server will not pick up changes."
  );
}

// The anon key is a public, publishable key — it is meant to ship in the bundle.
// What actually protects the data is Row Level Security. See the warning at the
// bottom of supabase/migrations/0001_init.sql: policies are currently wide open.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export default supabase;
