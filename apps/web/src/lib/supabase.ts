import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Browser Supabase client for Auth (Google sign-in, session JWT).
// Session lives in sessionStorage (per tab): two tabs can hold two different
// accounts without clobbering each other. Tradeoff: closing the browser signs
// you out (no cross-restart persistence). Returns null until configured.
export function supabaseBrowser(): SupabaseClient | null {
  // Built-in fallbacks (public values; env vars override when set).
  const FALLBACK_URL = 'https://xouxvmprrosstzlitcsp.supabase.co';
  const FALLBACK_KEY = 'sb_publishable_Yjv6wtpGp3mByGElA_XS3A_Eo1arLNY';
  const env = import.meta.env;
  const url = ((env.VITE_SUPABASE_URL || env.SUPABASE_URL) as string | undefined) || FALLBACK_URL;
  const key =
    ((env.VITE_SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.SUPABASE_PUBLISHABLE_KEY) as string | undefined) || FALLBACK_KEY;
  if (!url || !key) return null;
  if (!cached) cached = createClient(url, key, { auth: { storage: window.sessionStorage } });
  return cached;
}
