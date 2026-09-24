import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
const tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
let ownLoginTs = 0;

// ---- single-session policy: last login wins across tabs ----
// One shared session in localStorage (survives restarts, so returning users
// stay signed in). When THIS tab signs in with credentials it broadcasts
// the new session; every other tab holding a DIFFERENT session drops to
// sign-in (local scope only, so the fresh login is never revoked).
// Mount/restore/token-refresh never broadcast — only explicit sign-ins.
// Simultaneous logins resolve deterministically: the later timestamp wins,
// the earlier tab stands down.
const LOGIN_CHANNEL = "unify-login";

function loginChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel === "undefined") return null;
    return new BroadcastChannel(LOGIN_CHANNEL);
  } catch {
    return null;
  }
}

// Call immediately after an explicit credential sign-in (NOT on restore).
export function broadcastLogin(session: Session): void {
  const ts = Date.now();
  ownLoginTs = ts;
  try {
    loginChannel()?.postMessage({ tabId, userId: session.user.id, token: session.access_token, ts });
  } catch {
    // coordination unavailable — shared session still works
  }
}

// Listen once per tab (layout-level): drop to sign-in when another tab
// establishes a newer session. Returns unsubscribe.
export function onLoginElsewhere(): () => void {
  const ch = loginChannel();
  if (!ch) return () => {};
  ch.onmessage = (ev: MessageEvent) => {
    const msg = (ev.data || {}) as { tabId?: string; userId?: string; token?: string; ts?: number };
    if (!msg || msg.tabId === tabId || !msg.userId || !msg.token) return;
    if ((msg.ts || 0) < ownLoginTs) return; // we logged in later; ignore
    const sb = supabaseBrowser();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => {
      const mine = data.session;
      if (!mine) return; // already signed out here
      if (mine.user.id !== msg.userId || mine.access_token !== msg.token) {
        // A different session took over: clear THIS tab only. Local scope
        // keeps the fresh login alive; guards navigate this tab to /auth.
        sb.auth.signOut({ scope: "local" }).catch(() => {});
      }
    });
  };
  return () => {
    try {
      ch.close();
    } catch {
      // ignore
    }
  };
}
// Single shared client (localStorage session, survives restarts).
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
