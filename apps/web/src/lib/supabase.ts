import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let cachedMain: SupabaseClient | null = null;
let decided: SupabaseClient | null = null;

// ---- smart resume: persistent sign-in WITHOUT cross-tab auto-sign-in ----
// The Supabase session persists in localStorage so returning users stay
// signed in across browser restarts. But each open tab registers itself in
// a localStorage tab registry, and a newly opened tab restores the shared
// session ONLY when no OTHER live tab claims one. Otherwise it gets an
// isolated client (own sessionStorage key) and starts signed out —
// independent, so two tabs can even hold two different accounts.
// Edge cases: two tabs opened in the same millisecond may both restore
// (rare, harmless — same stored session); crashed tabs leave stale entries
// that expire via lastSeen pruning.
const TAB_REG_KEY = "unify.tabs.v1";
const STALE_MS = 20000;
const HEARTBEAT_MS = 5000;
const tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
let tabActive = false;
let heartbeatOn = false;

type TabEntry = { ts: number; active: boolean; lastSeen: number };

function readRegistry(): Record<string, TabEntry> {
  try {
    const raw = localStorage.getItem(TAB_REG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TabEntry>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeRegistry(reg: Record<string, TabEntry>): void {
  try {
    localStorage.setItem(TAB_REG_KEY, JSON.stringify(reg));
  } catch {
    // storage unavailable (e.g. private mode) — sign-in still works,
    // just without tab coordination (falls back to shared behavior)
  }
}

function prune(reg: Record<string, TabEntry>): Record<string, TabEntry> {
  const now = Date.now();
  for (const k of Object.keys(reg)) {
    const e = reg[k];
    if (!e || typeof e.lastSeen !== "number" || now - e.lastSeen > STALE_MS) delete reg[k];
  }
  return reg;
}

function touchRegistry(): void {
  try {
    const reg = prune(readRegistry());
    const prev = reg[tabId];
    reg[tabId] = { ts: prev?.ts ?? Date.now(), active: tabActive, lastSeen: Date.now() };
    writeRegistry(reg);
  } catch {
    // ignore — coordination is best-effort
  }
}

function startHeartbeat(): void {
  if (heartbeatOn) return;
  heartbeatOn = true;
  touchRegistry();
  window.setInterval(touchRegistry, HEARTBEAT_MS);
  const remove = () => {
    try {
      const reg = readRegistry();
      delete reg[tabId];
      writeRegistry(reg);
    } catch {
      // ignore
    }
  };
  window.addEventListener("pagehide", remove);
  window.addEventListener("beforeunload", remove);
}

// Call when this tab gains or loses a session (sign-in, verified session,
// session death). Drives what newly opened tabs decide.
export function setTabActive(active: boolean): void {
  tabActive = active;
  touchRegistry();
}

// Call on explicit sign-out so this tab stops claiming immediately.
export function handleTabSignOut(): void {
  tabActive = false;
  try {
    const reg = readRegistry();
    delete reg[tabId];
    writeRegistry(reg);
  } catch {
    // ignore
  }
}

// Browser Supabase client for Auth (email sign-in, session JWT).
// First call per tab decides once (synchronously): restore the shared
// localStorage session, or go isolated when another live tab is signed in.
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
  if (!cachedMain) cachedMain = createClient(url, key);
  if (decided) return decided;
  let isolated = false;
  try {
    const reg = prune(readRegistry());
    isolated = Object.entries(reg).some(([k, v]) => k !== tabId && v.active);
    reg[tabId] = { ts: Date.now(), active: false, lastSeen: Date.now() };
    writeRegistry(reg);
  } catch {
    isolated = false;
  }
  startHeartbeat();
  decided = isolated
    ? createClient(url, key, { auth: { storage: window.sessionStorage, storageKey: `unify.tab.${tabId}` } })
    : cachedMain;
  return decided;
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
