import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Browser Supabase client for Auth (email sign-in, session JWT).
// Session persists in localStorage so signing in survives browser restarts
// and returning users stay signed in. (An earlier per-tab sessionStorage
// build logged everyone out on every restart — reverted per user request.)
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
  if (!cached) cached = createClient(url, key);
  return cached;
}

// Module session cache: every route mounts its own auth gate, and without
// this each navigation flashes "Checking sign-in…" while getSession resolves.
// First gate loads it, the rest render instantly; auth events keep it fresh.
let sessionCache: { loaded: boolean; session: Session | null } = { loaded: false, session: null };

export function getCachedSession(): { loaded: boolean; session: Session | null } {
  return sessionCache;
}

export function setCachedSession(session: Session | null): void {
  sessionCache = { loaded: true, session };
}

export async function ensureSession(): Promise<Session | null> {
  const sb = supabaseBrowser();
  if (!sb) return null;
  if (sessionCache.loaded) return sessionCache.session;
  const { data } = await sb.auth.getSession();
  sessionCache = { loaded: true, session: data.session };
  return data.session;
}
