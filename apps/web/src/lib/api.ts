import { supabaseBrowser } from "./supabase";
import { log } from "./log";

// Backend is now the source of truth (Supabase Auth + Render API).
// Set VITE_USE_BACKEND=0 only to disable API calls (auth still needs Supabase).
export const USE_BACKEND = ((import.meta.env.VITE_USE_BACKEND ?? import.meta.env.USE_BACKEND ?? "1") as string) === "1";

// Built-in fallback (public URL; env vars override when set).
const FALLBACK_API_URL = 'https://unify-api-z4zm.onrender.com';
const API_URL = (
  ((import.meta.env.VITE_API_URL || import.meta.env.API_URL) as string | undefined) || FALLBACK_API_URL
).replace(/\/$/, '');

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
    let response = await fetch(`${API_URL}${path}`, { ...init, headers, signal: ctrl.signal });
    if (response.status === 401) {
      // Might be a transient multi-tab refresh race, not a dead session:
      // re-read the session once and retry before giving up.
      log.warn("api", `← 401 ${path} (retrying once with fresh session)`);
      try {
        const sb = supabaseBrowser();
        if (sb) {
          await sb.auth.getSession();
          const fresh = await sessionToken();
          if (fresh && fresh !== token) {
            const retryRes = await fetch(`${API_URL}${path}`, {
              ...init,
              headers: { ...headers, Authorization: `Bearer ${fresh}` },
              signal: ctrl.signal,
            });
            if (retryRes.ok) {
              log.info("api", `← ${retryRes.status} ${path} (retry ok, ${Date.now() - started}ms)`);
              return (await retryRes.json()) as T;
            }
            response = retryRes;
          }
        }
      } catch {
        // fall through to dead-session handling below
      }
    }
    if (response.status === 401) {
      // Session truly dead (expired/revoked): clear it and send the user to sign in.
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
    const res = response;
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as {
          error?: string;
          message?: string;
          details?: { fieldErrors?: Record<string, string[]> };
        };
        const firstIssue = Object.values(body.details?.fieldErrors || {}).flat()[0];
        detail = [body.error || body.message, firstIssue].filter(Boolean).join(" — ") || "";
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
  role?: string;
};

export type AdminUser = {
  id: string;
  first_name?: string;
  email?: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: string;
  role?: string;
  is_admin?: boolean;
  created_at?: string;
};

export type TopicVersionMeta = {
  id: string;
  version: number;
  authorId: string | null;
  createdAt: string;
};

export type TopicMeta = {
  topic: number;
  version: number;
  id: string;
  title: string;
  authorId: string | null;
  versions: TopicVersionMeta[];
};

export const api = {
  universities: () => apiFetch<University[]>("/v1/universities"),
  settings: () => apiFetch<{ currentSemester: string }>("/v1/settings"),
  me: () => apiFetch<{ onboarded: boolean; profile: Profile | null; isAdmin: boolean; courses: string[]; resume: { course: string; week: number; topic: number } | null }>("/v1/me"),
  onboarding: (payload: Record<string, unknown>) =>
    apiFetch<{ ok: boolean; profile: Profile }>("/v1/onboarding", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  week: (course: string, week: number) =>
    apiFetch<{ course: string; week: number; title: string; subtitle: string; note_json: unknown; topicMeta?: TopicMeta[] }>(
      `/v1/courses/${encodeURIComponent(course)}/weeks/${week}`
    ),
  progress: (course: string, week: number, topic: number) =>
    apiFetch<{ ok: boolean; xp: number; streak: number }>("/v1/progress", {
      method: "POST",
      body: JSON.stringify({ course, week, topic }),
    }),
  stats: () =>
    apiFetch<{ xp: number; streak: number; courses: { course: string; topics: number }[]; quizzesTaken: number; quizAvg: number }>("/v1/stats"),
  progressGet: (course: string, week: number) =>
    apiFetch<{ done: number[] }>(`/v1/progress?course=${encodeURIComponent(course)}&week=${week}`),
  enroll: (course: string, enroll: boolean) =>
    apiFetch<{ ok: boolean; enrolled: string[] }>('/v1/enrollments', {
      method: 'POST',
      body: JSON.stringify({ course, enroll }),
    }),
  resume: (course: string, week: number, topic: number) =>
    apiFetch<{ ok: boolean }>('/v1/resume', {
      method: 'POST',
      body: JSON.stringify({ course, week, topic }),
    }),
  authored: () =>
    apiFetch<{ notes: { id: string; course: string; week: number; topic: number; version: number; title: string }[] }>('/v1/authored'),
  courseWeeks: (course: string) =>
    apiFetch<{ weeks: { week: number; title: string; subtitle: string }[] }>(
      `/v1/courses/${encodeURIComponent(course)}/weeks`
    ),
  quizAttempt: (course: string, week: number, score: number, total: number) =>
    apiFetch<{ ok: boolean }>('/v1/quiz/attempt', {
      method: 'POST',
      body: JSON.stringify({ course, week, score, total }),
    }),
  convert: (payload: {
    course: string;
    week: number;
    title?: string;
    subtitle?: string;
    learningOutcome?: string;
    tags?: string[];
    segmentationMode?: string;
    rawNotesText: string;
  }) =>
    apiFetch<{ success: boolean; note: unknown; validation: { valid: boolean; errors?: unknown } }>('/api/convert', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  validateNote: (note: unknown) =>
    apiFetch<{ valid: boolean; errors?: unknown }>('/api/validate', {
      method: 'POST',
      body: JSON.stringify(note),
    }),
  publish: (payload: { course: string; week: number; title?: string; subtitle?: string; noteJson: unknown }) =>
    apiFetch<{ ok: boolean; course: string; week: number; versions: { topic: number; version: number; id: string }[] }>('/v1/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  topicPublish: (payload: { course: string; week: number; topic: number; title?: string; noteJson: unknown }) =>
    apiFetch<{ ok: boolean; id: string; version: number }>('/v1/topics/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  topicList: (course: string, week: number) =>
    apiFetch<{ topics: TopicMeta[] }>(`/v1/courses/${encodeURIComponent(course)}/weeks/${week}/topics`),
  noteGet: (id: string) =>
    apiFetch<{ id: string; course: string; week: number; topic: number; version: number; title: string; noteJson: unknown; authorId: string | null }>(`/v1/notes/${id}`),
  noteDelete: (id: string) =>
    apiFetch<{ ok: boolean; remaining: number }>(`/v1/notes/${id}`, { method: 'DELETE' }),
  adminStats: () =>
    apiFetch<{
      users: number;
      byRole: Record<string, number>;
      weeks: number;
      xpTotal: number;
    }>('/v1/admin/stats'),
  adminUsers: (q = '', role = '') =>
    apiFetch<{ users: AdminUser[] }>(`/v1/admin/users?q=${encodeURIComponent(q)}&role=${encodeURIComponent(role)}`),
  adminPatchUser: (id: string, payload: { role?: string; is_admin?: boolean; level?: string }) =>
    apiFetch<{ ok: boolean }>(`/v1/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  adminSetSemester: (semester: string) =>
    apiFetch<{ ok: boolean; currentSemester: string }>('/v1/admin/settings/semester', { method: 'PUT', body: JSON.stringify({ semester }) }),
  adminPromote: () =>
    apiFetch<{ ok: boolean; promoted: number; graduated: number }>('/v1/admin/users/promote', { method: 'POST', body: JSON.stringify({}) }),
  adminDeleteUser: (id: string) => apiFetch<{ ok: boolean }>(`/v1/admin/users/${id}`, { method: 'DELETE' }),
  adminModels: (refresh = false) =>
    apiFetch<{ provider: string; default: string; models: { model: string; failures: number; last_ok: string | null }[] }>(
      `/v1/admin/models${refresh ? '?refresh=1' : ''}`
    ),
  adminModelsReset: (model?: string) =>
    apiFetch<{ ok: boolean }>('/v1/admin/models/reset', { method: 'POST', body: JSON.stringify(model ? { model } : {}) }),
  adminInvite: (email: string, role: string) =>
    apiFetch<{ ok: boolean }>('/v1/admin/users/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
  courses: (level = '', semester = '') => {
    const p = new URLSearchParams();
    if (level) p.set('level', level);
    if (semester) p.set('semester', semester);
    const q = p.toString();
    return apiFetch<{ code: string; title: string; levels: string[]; semesters: string[] }[]>(`/v1/courses${q ? `?${q}` : ''}`);
  },
  adminCreateUni: (name: string, short_name?: string) =>
    apiFetch<{ ok: boolean }>('/v1/admin/universities', { method: 'POST', body: JSON.stringify({ name, short_name }) }),
  adminDeleteUni: (id: string) => apiFetch<{ ok: boolean }>(`/v1/admin/universities/${id}`, { method: 'DELETE' }),
  adminCreateCourse: (code: string, title: string, levels: string[], semester = 'First Semester') =>
    apiFetch<{ ok: boolean; course: string }>('/v1/admin/courses', { method: 'POST', body: JSON.stringify({ code, title, levels, semester }) }),
  adminDeleteCourse: (code: string) =>
    apiFetch<{ ok: boolean }>(`/v1/admin/courses/${encodeURIComponent(code)}`, { method: 'DELETE' }),
};
