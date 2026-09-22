import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminCached: SupabaseClient | null = null;

// Service-role client: bypasses RLS. Server-side only, never expose the key.
export function supabaseAdmin(): SupabaseClient {
  if (adminCached) return adminCached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  adminCached = createClient(url, key, { auth: { persistSession: false } });
  return adminCached;
}

// Anon client: used only to verify user JWTs (auth.getUser). Safe to construct per call.
export function supabaseAnon(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
