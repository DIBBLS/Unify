import { supabaseBrowser } from "./supabase";
import { log } from "./log";

// Backend is now the source of truth (Supabase Auth + Render API).
// Set VITE_USE_BACKEND=0 only to disable API calls (auth still needs Supabase).
export const USE_BACKEND = ((import.meta.env.VITE_USE_BACKEND ?? import.meta.env.USE_BACKEND ?? "1") as string) === "1";

const API_URL = (((import.meta.env.VITE_API_URL || import.meta.env.API_URL) as string | undefined) || "").replace(/\/$/, "");

// Raw backend root (authoring studio lives here). Null until VITE_API_URL is set.
export function getApiUrl(): string | null {
  return API_URL || null;
}

let warmed = false;

// Fire-and-forget warmup: Render free tier sleeps when idle, first request
// can take 30-60s. Call once on app start so real calls find a warm server.
export function warmupApi(): void {
  if (warmed || !USE_BACKEND || !API_URL) return;
  warmed = true;
  log.info("api", `warmup ping ${API_URL}/healthz`);
  fetch(`${API_URL}/healthz`, { mode: "cors" }).catch(() => {
    log.warn("api", "warmup failed (cold start?) — will retry on first call");
    warmed = false;
  });
}

async function sessionToken(): Promise<string | null> {
  const sb = supabaseBrowser();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retries = 1): Promise<T> {
  if (!API_URL) throw new Error("VITE_API_URL is not set");
  const started = Date.now();
  const method = (init.method || "GET").toUpperCase();
  const token = await sessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  log.info("api", `→ ${method} ${path} ${token ? "(authed)" : "(anon)"}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: ctrl.signal });
    if (res.status === 401) {
      // Session dead (expired/revoked): clear it and send the user to sign in.
      // Public endpoints never 401, so this only fires for authed calls.
      log.warn("api", `← 401 ${path} (session dead, signing out)`);
      try {
        await supabaseBrowser()?.auth.signOut();
      } catch {
        // ignore sign-out errors
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
        window.location.assign('/auth');
      }
    }
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { error?: string; message?: string };
        detail = body.error || body.message || "";
      } catch {
        detail = "";
      }
      const err = new Error(`API ${res.status}${detail ? `: ${detail}` : ""}`);
      (err as { status?: number }).status = res.status;
      throw err;
    }
    log.info("api", `← ${res.status} ${path} (${Date.now() - started}ms)`);
    return (await res.json()) as T;
  } catch (e) {
    if (retries > 0) {
      log.warn("api", `↻ retry ${path} (${e instanceof Error ? e.message : "network error"})`);
      await new Promise((r) => setTimeout(r, 1500));
      return apiFetch<T>(path, init, retries - 1);
    }
    log.error("api", `✕ ${method} ${path} failed (${e instanceof Error ? e.message : "network error"})`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export type University = { id: string; name: string; short_name?: string };
export type Profile = {
  id: string;
  first_name?: string;
  email?: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: string;
  grad_target?: number;
};

export const api = {
  universities: () => apiFetch<University[]>("/v1/universities"),
  me: () => apiFetch<{ onboarded: boolean; profile: Profile | null }>("/v1/me"),
  onboarding: (payload: Record<string, unknown>) =>
    apiFetch<{ ok: boolean; profile: Profile }>("/v1/onboarding", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  week: (course: string, week: number) =>
    apiFetch<{ course: string; week: number; title: string; subtitle: string; note_json: unknown }>(
      `/v1/courses/${encodeURIComponent(course)}/weeks/${week}`
    ),
  progress: (course: string, week: number, topic: number) =>
    apiFetch<{ ok: boolean; xp: number; streak: number }>("/v1/progress", {
      method: "POST",
      body: JSON.stringify({ course, week, topic }),
    }),
  stats: () =>
    apiFetch<{ xp: number; streak: number; courses: { course: string; topics: number }[] }>("/v1/stats"),
  progressGet: (course: string, week: number) =>
    apiFetch<{ done: number[] }>(`/v1/progress?course=${encodeURIComponent(course)}&week=${week}`),
};
