import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
// Unique per tab so duplicated tabs don't share a session either.
const tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);

// ---- fully independent tab sessions ----
// Every tab gets its OWN session in sessionStorage under its own key.
// Signing in, signing out, or expiring in one tab never touches another:
// no auto-sign-in elsewhere, no auto-logout elsewhere, two tabs can even
// hold two different accounts side by side. Tradeoff (explicit user call):
// closing the browser signs every tab out — there is no cross-restart
// persistence, because any shared storage would re-link the tabs.
// Server-side data (progress, XP, enrollments) still merges naturally
// since it's keyed by user, not by tab.
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
  if (!cached) {
    cached = createClient(url, key, {
      auth: { storage: window.sessionStorage, storageKey: `unify.tab.${tabId}` },
    });
  }
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
