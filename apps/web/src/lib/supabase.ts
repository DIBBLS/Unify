import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
// Stable per tab ACROSS reloads (sessionStorage survives reloads in the
// same tab). A fresh random id on every load would point the client at a
// different storage key after refresh and "lose" the session — that was
// the refresh bug. Duplicated tabs intentionally share the id (and session).
function getTabId(): string {
  try {
    const existing = window.sessionStorage.getItem("unify.tabid");
    if (existing) return existing;
    const fresh = Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.sessionStorage.setItem("unify.tabid", fresh);
    return fresh;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
const tabId = getTabId();

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

// ---- Remember me (opt-in cross-restart sign-in) ----
// Tab sessions live in sessionStorage, so closing the browser signs every
// tab out and tabs never link. Ticking "Remember me" additionally stores
// the session tokens in localStorage; on a fresh visit with no tab session,
// /auth adopts them into the new tab's own client (tabs stay independent
// afterwards). Sign-out always clears both. Only discarded on auth
// rejection (bad/revoked tokens) — network blips keep it for next time.
const REMEMBER_KEY = "unify.remember.v1";

export function saveRememberSession(session: Session): void {
  try {
    localStorage.setItem(
      REMEMBER_KEY,
      JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token })
    );
  } catch {
    // ignore (e.g. private mode) — session still works for this tab
  }
}

function loadRememberSession(): { access_token: string; refresh_token: string } | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { access_token?: unknown; refresh_token?: unknown };
    if (typeof p?.access_token === "string" && typeof p?.refresh_token === "string") {
      return { access_token: p.access_token, refresh_token: p.refresh_token };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearRememberSession(): void {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // ignore
  }
}

// One-shot restore for fresh entry (called from /auth mount — every launch
// passes through /auth). Returns true when a session is now present.
export async function restoreRememberedSession(): Promise<boolean> {
  const sb = supabaseBrowser();
  if (!sb) return false;
  try {
    const { data } = await sb.auth.getSession();
    if (data.session) return true;
  } catch {
    return false;
  }
  const saved = loadRememberSession();
  if (!saved) return false;
  try {
    const { data, error } = await sb.auth.setSession(saved);
    if (error || !data.session) throw error || new Error("restore failed");
    return true;
  } catch (e) {
    if ((e as { status?: number })?.status && (e as { status?: number }).status! >= 400) {
      clearRememberSession();
    }
    return false;
  }
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
