import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Browser Supabase client for Auth (Google sign-in, session JWT).
// Returns null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
export function supabaseBrowser(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  if (!cached) cached = createClient(url, key);
  return cached;
}
