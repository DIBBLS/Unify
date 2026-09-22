import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Browser Supabase client for Auth (Google sign-in, session JWT).
// Returns null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
export function supabaseBrowser(): SupabaseClient | null {
  const env = import.meta.env;
  const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL) as string | undefined;
  const key = (env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY) as string | undefined;
  if (!url || !key) return null;
  if (!cached) cached = createClient(url, key);
  return cached;
}
