import { supabaseBrowser, clearRememberSession } from "./supabase";
import { log } from "./log";
// Offline write queue (progress/quiz/resume bank locally when offline).
// Import is function-level only — no init-time cycle with ./offline.
import { queueWrite } from "./offline";

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

export async function apiFetch<T>(path: string, init: RequestInit = {}, retries = 1, timeoutMs = 30000): Promise<T> {
  if (!API_URL) throw new Error("VITE_API_URL is not set");
  const started = Date.now();
  const method = (init.method || "GET").toUpperCase();
  const token = await sessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  log.info("api", `→ ${method} ${path} ${token ? "(authed)" : "(anon)"}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
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
      // Local scope: never revoke another tab's newer session server-side.
      log.warn("api", `← 401 ${path} (session dead, signing out)`);
      try {
        await supabaseBrowser()?.auth.signOut({ scope: 'local' });
        clearRememberSession();
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
      let hint = "";
      let code = "";
      let existing: unknown = null;
      try {
        const body = (await res.json()) as {
          error?: string;
          message?: string;
          hint?: string;
          code?: string;
          existing?: unknown;
          details?: { fieldErrors?: Record<string, string[]> };
        };
        const firstIssue = Object.values(body.details?.fieldErrors || {}).flat()[0];
        detail = [body.error || body.message, firstIssue].filter(Boolean).join(" — ") || "";
        hint = body.hint || "";
        code = body.code || "";
        existing = body.existing ?? null;
      } catch {
        detail = "";
      }
      const err = new Error(`API ${res.status}${detail ? `: ${detail}` : ""}`);
      (err as { status?: number }).status = res.status;
      if (hint) (err as { hint?: string }).hint = hint;
      if (code) (err as { code?: string }).code = code;
      if (existing) (err as { existing?: unknown }).existing = existing;
      throw err;
    }
    log.info("api", `← ${res.status} ${path} (${Date.now() - started}ms)`);
    // Any successful write may change who the user is (onboarding, profile,
    // enrolment, role): never serve the memoised /v1/me after one.
    if (method !== "GET") clearMeCache();
    return (await res.json()) as T;
  } catch (e) {
    // Retry transient faults (cold starts, network blips) — never 4xx:
    // those are deterministic (bad input, unknown course) and retrying
    // them only multiplies failing requests.
    const status = (e as { status?: number })?.status;
    if (retries > 0 && !(status && status >= 400 && status < 500)) {
      log.warn("api", `↻ retry ${path} (${e instanceof Error ? e.message : "network error"})`);
      await new Promise((r) => setTimeout(r, 1500));
      return apiFetch<T>(path, init, retries - 1, timeoutMs);
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
  avatar_url?: string;
  notify_new_notes?: boolean;
  box_boy_persona?: string | null;
  semester?: string | null;
  semester_start?: string | null;
  semester_weeks?: number | null;
  cgpa_target?: number | null;
  cgpa_current?: number | null;
  hide_cgpa?: boolean;
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
  lecture: number;
  version: number;
  id: string;
  title: string;
  authorId: string | null;
  versions: TopicVersionMeta[];
};

/** Window event: the notification list changed here, so the bell should recount. */
export const NOTIFS_CHANGED = 'unify:notifs-changed';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  course?: string | null;
  week?: number | null;
  topic?: number | null;
  link?: string | null;
  read?: boolean;
  created_at?: string;
};

export type NoteAuthor = { name: string; avatar: string };
export type ClassSlot = { id: string; course: string; day: number; start: string; end: string; venue: string; lecturer: string; meetLink?: string };
export type RosterStudent = { id: string; name: string; email: string; level: string; topicsDone: number; quizzesTaken: number; lastActive: string | null };
export type AdminContentTopic = { topic: number; lecture: number; versions: number; title: string };
export type AdminContentWeek = { week: number; title: string; topics: AdminContentTopic[] };
export type AdminContentCourse = {
  code: string;
  title: string;
  level: string;
  semester: string;
  weekCount: number;
  topicCount: number;
  weeks: AdminContentWeek[];
};

export type MeResponse = { onboarded: boolean; profile: Profile | null; isAdmin: boolean; courses: string[]; avatar: string; resume: { course: string; week: number; topic: number; lecture: number } | null };

// Short-TTL memo for me(): the layout gate + every route each call it on
// navigation — without this every page change costs a full round trip.
// 15s is stale-safe (role changes are admin-driven and rare). Cleared on
// sign-out and fresh sign-in so account switches never read another
// user's profile.
let meCache: { at: number; data: MeResponse } | null = null;
// In-flight /v1/me: the layout, the role gate and the page all ask at once on
// first load — they share one request instead of each hitting the server.
// meGen bumps on every invalidation so a request started before a write or
// sign-out never repopulates the cache or gets handed to a later caller.
let meInflight: Promise<MeResponse> | null = null;
let meGen = 0;
export function clearMeCache(): void {
  meCache = null;
  meInflight = null;
  meGen++;
}


// ---- Head of Class + attendance ----
export type HocPost = { id: string; type: 'announcement' | 'tip' | 'question'; title: string | null; content: string; createdAt: string; author: string; mine: boolean };
export type AttendanceSession = { id: string; course: string; online?: boolean; code: string; rotatesAt: string; rotateSeconds: number; week: number | null; opensAt: string; closesAt: string; open: boolean; startedBy?: { name: string; role: string; mine: boolean } };
export type CgpaCourse = { code: string; title: string; status: 'done' | 'priority' | 'not_yet'; units: number; grade: number | null };
export type CgpaData = { cgpaCurrent: number | null; cgpaTarget: number | null; hideCgpa: boolean; unitsDone: number | null; unitsTotal: number | null; degreeYears?: number | null; level: string | null; courses: CgpaCourse[] };
export type Material = { id: string; week: number; type: 'slides' | 'notes' | 'past-paper'; title: string; url: string; createdAt: string; mine: boolean };
export type AttendanceRegister = {
  session: AttendanceSession | null;
  // onList: null until the class rep uploads a class list for this course.
  present: { studentId: string; entryId: string; at: string; name: string; matric: string; avatar: string; persona: string; method: 'scan' | 'typed' | 'code'; by: string; onList: boolean | null }[];
  // Everyone on the class list not marked yet (empty without a class list).
  absent: { entryId: string; name: string; matric: string; joined: boolean; notTaking: boolean }[];
  listed: number | null;
  lists: string[];
  enrolled: number;
};
export type StudentCard = { id: string; name: string; matric: string; level: string; department: string; avatar: string; persona: string };
export type AttendancePass = { token: string; rotatesAt: string; rotateSeconds: number; student: StudentCard };
export type ScanResult = { status: 'marked' | 'already' | 'not_enrolled' | 'not_on_list'; method?: 'scan' | 'typed'; course: string; student: StudentCard; onList?: boolean | null };

// Class lists (HOC uploads, students claim their entry).
export type ClassListMe = {
  list: { department: string; level: string; size: number } | null;
  entry: { name: string; matric: string; method: string; verifiedEmail: boolean } | null;
  request: { matric: string; reason: 'not_on_list' | 'already_claimed'; at: string } | null;
  emailPending: { email: string } | null;
  emailFormat: string;
};
export type ClaimOutcome =
  | { status: 'claimed'; entry: { name: string; matric: string } }
  | { status: 'sent_to_hoc'; reason: 'not_on_list' | 'already_claimed' }
  | { status: 'not_found'; reason: 'not_on_list' | 'already_claimed' }
  | { status: 'no_list' };
export type ClassListEntry = { id: string; name: string; matric: string; claimed: boolean; claimedBy: string; claimMethod: string; verifiedEmail: boolean; removed: boolean };
export type ClassListClaim = {
  id: string; reason: 'not_on_list' | 'already_claimed'; matric: string; name: string; account: string; accountEmail: string;
  verifiedEmail: string; note: string; at: string; entry: { id: string; name: string; claimedBy: string } | null;
};
export type ClassListLog = { id: string; action: string; detail: Record<string, unknown>; at: string; by: string };
export type ClassListData = {
  list: { id: string; department: string; level: string; institution: string; updatedAt: string } | null;
  class: { department: string; level: string; institution: string };
  entries: ClassListEntry[];
  claims: ClassListClaim[];
  log: ClassListLog[];
};
export type ParsedClassRow = {
  line: number; name: string; matric: string;
  issue?: 'duplicate' | 'no_name' | 'odd_matric';
  existing: { name: string; removed: boolean } | null;
};
export type ClassListParse = { rows: ParsedClassRow[]; problems: { line: number; text: string; issue: 'no_matric' }[]; skipped: number; source: string };

// Authenticated file download (CSV exports): fetch with the session token, save as a file.
export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = await sessionToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let msg = '';
    try { msg = ((await res.json()) as { error?: string }).error || ''; } catch { /* not JSON */ }
    const err = new Error(`API ${res.status}${msg ? `: ${msg}` : ''}`);
    (err as { status?: number }).status = res.status;
    throw err;
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || filename;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export type PerfPoint = { t: number; n: number; e4: number; e5: number; p50: number; p95: number; max: number };
export type PerfSnapshot = {
  minutes: number;
  from: number;
  to: number;
  serverTime: number;
  total: PerfPoint[];
  totals: Omit<PerfPoint, 't'> & { rpm: number; errRate: number };
  modules: (Omit<PerfPoint, 't'> & { name: string; rpm: number; errRate: number; series: PerfPoint[] })[];
  system: { uptimeSec: number; rssMb: number; heapMb: number; lagMaxMs: number; lag: { t: number; ms: number }[]; db: { t: number; ms: number; ok: boolean }[]; node: string };
  vitals: { page: string; metric: string; n: number; p50: number; p75: number }[];
  alerts: { at: string; signature: string; kind: string; message: string; emailed: boolean; note?: string }[];
};

export type HomeUpdate = { id: string; title: string; body: string; link?: string; cta?: string; pose: import('../components/redesign/brand').Pose; endsAt?: string; createdAt?: string };

export const api = {
  universities: () => apiFetch<University[]>("/v1/universities"),
  settings: () => apiFetch<{ currentSemester: string }>("/v1/settings"),
  me: () => {
    if (meCache && Date.now() - meCache.at < 15000) return Promise.resolve(meCache.data);
    if (meInflight) return meInflight;
    const gen = meGen;
    const p = apiFetch<MeResponse>("/v1/me").then(
      (d) => {
        if (gen === meGen) {
          meCache = { at: Date.now(), data: d };
          meInflight = null;
        }
        return d;
      },
      (e) => {
        if (gen === meGen) meInflight = null;
        throw e;
      }
    );
    meInflight = p;
    return p;
  },
  updateMe: (payload: Record<string, unknown>) =>
    apiFetch<{ ok: boolean; profile: Profile }>("/v1/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  onboarding: (payload: Record<string, unknown>) =>
    apiFetch<{ ok: boolean; profile: Profile }>("/v1/onboarding", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  week: (course: string, week: number) =>
    apiFetch<{ course: string; week: number; title: string; subtitle: string; note_json: unknown; topicMeta?: TopicMeta[]; lectures?: number[]; authors?: NoteAuthor[] }>(
      `/v1/courses/${encodeURIComponent(course)}/weeks/${week}`
    ),
  progress: (course: string, week: number, topic: number, lectureNo = 1) => {
    const body = JSON.stringify({ course, week, topic, lectureNo });
    // Offline-first: completing while offline banks locally and syncs on
    // reconnect — XP is never lost to a dead connection.
    if (queueWrite('/v1/progress', body)) return Promise.resolve({ ok: true, xp: 0, streak: 0 });
    return apiFetch<{ ok: boolean; xp: number; streak: number }>('/v1/progress', {
      method: 'POST',
      body,
    });
  },
  stats: () =>
    apiFetch<{ xp: number; streak: number; courses: { course: string; topics: number }[]; quizzesTaken: number; quizAvg: number }>("/v1/stats"),
  progressGet: (course: string, week: number) =>
    apiFetch<{ done: ({ topic: number; lecture: number } | number)[] }>(`/v1/progress?course=${encodeURIComponent(course)}&week=${week}`),
  enroll: (course: string, enroll: boolean) =>
    apiFetch<{ ok: boolean; enrolled: string[] }>('/v1/enrollments', {
      method: 'POST',
      body: JSON.stringify({ course, enroll }),
    }),
  repairEnrollments: () =>
    apiFetch<{ ok: boolean; restored: number; enrolled: string[] }>('/v1/enrollments/repair', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  resume: (course: string, week: number, topic: number, lecture = 1) => {
    const body = JSON.stringify({ course, week, topic, lectureNo: lecture });
    // Bookmarks are low-value offline (the local tab already holds
    // position) — queue quietly, never error.
    if (queueWrite('/v1/resume', body)) return Promise.resolve({ ok: true });
    return apiFetch<{ ok: boolean }>('/v1/resume', {
      method: 'POST',
      body,
    });
  },
  authored: () =>
    apiFetch<{ notes: { id: string; course: string; week: number; topic: number; lecture: number; version: number; title: string }[] }>('/v1/authored'),
  authorStats: () =>
    apiFetch<{ courses: number; topics: number; versions: number; students: number; completions: number; quizzesTaken: number; quizAvg: number }>('/v1/author/stats'),
  courseWeeks: (course: string) => {
    // Never request a blank code: it 404s by design and would only spam
    // retries (this exact storm showed up in production logs).
    if (!course || !course.trim()) return Promise.reject(new Error('No course selected.'));
    return apiFetch<{ weeks: { week: number; title: string; subtitle: string; authors: NoteAuthor[] }[] }>(
      `/v1/courses/${encodeURIComponent(course.trim())}/weeks`
    );
  },
  quizAttempt: (course: string, week: number, score: number, total: number) => {
    const body = JSON.stringify({ course, week, score, total });
    // Quiz results bank locally offline and flush on reconnect.
    if (queueWrite('/v1/quiz/attempt', body)) return Promise.resolve({ ok: true });
    return apiFetch<{ ok: boolean }>('/v1/quiz/attempt', {
      method: 'POST',
      body,
    });
  },
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
    // Async jobs: the POST only plans the split and returns instantly;
    // poll convertStatus for part progress. Generous timeout for safety.
    apiFetch<{ jobId: string; parts: number; split: boolean }>(
      '/api/convert',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      1,
      60000
    ),
  convertStatus: (jobId: string) =>
    apiFetch<
      | { status: 'working'; partsTotal: number; partsDone: number; currentModel: string }
      | {
          status: 'done';
          note: unknown;
          validation: { valid: boolean; errors?: unknown };
          provider: string;
          model: string;
          split: boolean;
          parts: { index: number; topics: number; model: string; attempts: number }[];
          warnings: string[];
        }
    >(`/api/convert/${encodeURIComponent(jobId)}`, {}, 0, 60000),
  validateNote: (note: unknown) =>
    apiFetch<{ valid: boolean; errors?: unknown }>('/api/validate', {
      method: 'POST',
      body: JSON.stringify(note),
    }),
  formatPack: () => apiFetch<{ prompt: string }>('/api/format'),
  publish: (payload: { course: string; week: number; title?: string; subtitle?: string; noteJson: unknown; mode?: 'add' | 'replace' }) =>
    apiFetch<{ ok: boolean; course: string; week: number; versions: { topic: number; lecture: number; version: number; id: string }[] }>('/v1/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  topicPublish: (payload: { course: string; week: number; topic: number; lectureNo?: number; title?: string; noteJson: unknown; mode?: 'add' | 'replace' }) =>
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
  notifications: (limit = 20) =>
    apiFetch<{ notifications: NotificationItem[]; unread: number }>(`/v1/notifications?limit=${limit}`),
  notificationsMarkRead: (payload: { ids?: string[]; all?: boolean }) =>
    apiFetch<{ ok: boolean }>('/v1/notifications/read', { method: 'POST', body: JSON.stringify(payload) }),
  notificationDelete: (id: string) =>
    apiFetch<{ ok: boolean }>(`/v1/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  notificationsClear: () =>
    apiFetch<{ ok: boolean }>('/v1/notifications', { method: 'DELETE' }),
  pushSubscribe: (endpoint: string, keys: { p256dh: string; auth: string }) =>
    apiFetch<{ ok: boolean }>('/v1/push/subscribe', { method: 'POST', body: JSON.stringify({ endpoint, keys }) }),
  pushUnsubscribe: (endpoint?: string) =>
    apiFetch<{ ok: boolean }>('/v1/push/unsubscribe', { method: 'POST', body: JSON.stringify(endpoint ? { endpoint } : {}) }),
  shareCreate: (course: string, week: number, ttlHours: number) =>
    apiFetch<{ ok: boolean; token: string; expires_at: string; views: number }>('/v1/share', { method: 'POST', body: JSON.stringify({ course, week, ttlHours }) }),
  shareGet: (token: string) =>
    apiFetch<{ course: string; week: number; title: string; subtitle: string; note_json: unknown; topicMeta: TopicMeta[]; share: { token: string; expires_at: string; views: number } }>(`/v1/share/${encodeURIComponent(token)}`),
  shareMine: () =>
    apiFetch<{ links: { token: string; course: string; week: number; expires_at: string; views: number; created_at: string }[] }>('/v1/share/mine'),
  shareDelete: (token: string) =>
    apiFetch<{ ok: boolean }>(`/v1/share/${encodeURIComponent(token)}`, { method: 'DELETE' }),
  adminAnnounce: (title: string, body: string, link?: string) =>
    apiFetch<{ ok: boolean; reached: number; emailTo?: number }>('/v1/admin/announce', { method: 'POST', body: JSON.stringify({ title, body, link }) }),
  adminEmailTest: (to: string) =>
    apiFetch<{ ok: boolean; status: number; body: string; sender: string; keySet: boolean; fromSet: boolean }>('/v1/admin/email/test', { method: 'POST', body: JSON.stringify({ to }) }),
  adminContent: () =>
    apiFetch<{ courses: AdminContentCourse[] }>('/v1/admin/content'),
  adminActivity: () =>
    apiFetch<{
      recentUsers: { first_name: string; email: string; role: string; created_at: string }[];
      recentNotes: { course: string; week: number; topic: number; version: number; title: string; created_at: string }[];
    }>('/v1/admin/activity'),
  adminTrends: () =>
    apiFetch<{
      signups: { day: string; count: number }[];
      notes: { day: string; count: number }[];
      xp: { day: string; count: number }[];
    }>('/v1/admin/trends'),
  adminStats: () =>
    apiFetch<{
      users: number;
      byRole: Record<string, number>;
      weeks: number;
      topics: number;
      courses: number;
      xpTotal: number;
    }>('/v1/admin/stats'),
  adminUsers: (q = '', role = '') =>
    apiFetch<{ users: AdminUser[] }>(`/v1/admin/users?q=${encodeURIComponent(q)}&role=${encodeURIComponent(role)}`),
  adminPatchUser: (id: string, payload: { role?: string; is_admin?: boolean; level?: string }) =>
    apiFetch<{ ok: boolean }>(`/v1/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  adminUserCourses: (id: string) =>
    apiFetch<{ courses: { course: string; kind: string }[] }>(`/v1/admin/users/${id}/courses`),
  adminSetUserCourses: (id: string, courses: string[]) =>
    apiFetch<{ ok: boolean; courses: string[] }>(`/v1/admin/users/${id}/courses`, { method: 'PUT', body: JSON.stringify({ courses }) }),
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
    return apiFetch<{ code: string; title: string; levels: string[]; semesters: string[]; weeks: number; lecturers: string[]; staff: { name: string; avatar: string }[] }[]>(`/v1/courses${q ? `?${q}` : ''}`);
  },
  courseSearch: (q: string, level = '') => {
    const p = new URLSearchParams({ q });
    if (level) p.set('level', level);
    return apiFetch<{ code: string; title: string; levels: string[]; semesters: string[]; weeks: number; matchedAlias: string | null }[]>(`/v1/courses/search?${p.toString()}`);
  },
  adminCreateUni: (name: string, short_name?: string) =>
    apiFetch<{ ok: boolean }>('/v1/admin/universities', { method: 'POST', body: JSON.stringify({ name, short_name }) }),
  adminDeleteUni: (id: string) => apiFetch<{ ok: boolean }>(`/v1/admin/universities/${id}`, { method: 'DELETE' }),
  adminCreateCourse: (code: string, title: string, levels: string[], semester = 'First Semester') =>
    apiFetch<{ ok: boolean; course: string }>('/v1/admin/courses', { method: 'POST', body: JSON.stringify({ code, title, levels, semester }) }),
  support: () =>
    apiFetch<{ supported: boolean; supportNumber: string }>('/v1/support'),
  // Daily-activity heartbeat (streak fuel): at most one ping per device
  // per day, fired when the student genuinely enters (dashboard, reader).
  // Server dedupes by day; offline days simply don't count.
  pingDaily: () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem('unify.ping.v1') === today) return Promise.resolve({ ok: true });
      localStorage.setItem('unify.ping.v1', today);
    } catch {
      // storage blocked: still try, server dedupes
    }
    return apiFetch<{ ok: boolean }>('/v1/ping', { method: 'POST', body: JSON.stringify({}) }).catch(() => ({ ok: false }));
  },
  roleRequest: (payload: { role: 'lecturer' | 'contributor'; level: string; courses: string[] }) =>
    apiFetch<{ ok: boolean; id: string }>('/v1/role-requests', { method: 'POST', body: JSON.stringify(payload) }),
  myRoleRequest: () =>
    apiFetch<{ request: { id: string; role: string; level: string; courses: string[]; status: string; created_at: string } | null }>('/v1/role-requests/mine'),
  cancelRoleRequest: () =>
    apiFetch<{ ok: boolean }>('/v1/role-requests/mine', { method: 'DELETE' }),
  adminRoleRequests: (history = false) =>
    apiFetch<{ requests: { id: string; user_id: string; role: string; level: string; courses: string[]; status: string; created_at: string; decided_at?: string; name: string; email: string }[] }>(`/v1/admin/role-requests${history ? '?status=all' : ''}`),
  decideRoleRequest: (id: string, approve: boolean) =>
    apiFetch<{ ok: boolean; approved: boolean; granted?: string[]; capped?: string[] }>(`/v1/admin/role-requests/${id}`, { method: 'POST', body: JSON.stringify({ approve }) }),
  capAudit: () =>
    apiFetch<{ violations: { user_id: string; name: string; email: string; level: string; courses: string[] }[] }>('/v1/admin/cap-audit'),
  capTrim: () =>
    apiFetch<{ ok: boolean; trimmed: number; remaining: unknown[] }>('/v1/admin/cap-audit', { method: 'POST', body: JSON.stringify({ trim: true }) }),
  contributions: () =>
    apiFetch<{ courses: { course: string; level: string; semester: string; assigned: boolean; topics: number; versions: number; totalTopics: number }[] }>('/v1/contributions'),
  uploadAvatar: (image: string) =>
    apiFetch<{ ok: boolean; avatarUrl: string }>('/v1/avatar', { method: 'POST', body: JSON.stringify({ image }) }),
  logError: (payload: { kind: string; message: string; stack: string; url: string; appVersion: string }) =>
    apiFetch<{ ok: boolean }>('/v1/errors', { method: 'POST', body: JSON.stringify(payload) }),
  updates: () => apiFetch<{ updates: HomeUpdate[] }>('/v1/updates'),
  adminUpdates: () => apiFetch<{ updates: HomeUpdate[] }>('/v1/admin/updates'),
  adminSaveUpdates: (updates: HomeUpdate[]) => apiFetch<{ ok: boolean; updates: HomeUpdate[] }>('/v1/admin/updates', { method: 'PUT', body: JSON.stringify({ updates }) }),
  adminMetrics: (minutes: 15 | 60 | 180) => apiFetch<PerfSnapshot>(`/v1/admin/metrics?minutes=${minutes}`),
  adminTestAlert: () => apiFetch<{ ok: boolean; note: string }>('/v1/admin/alerts/test', { method: 'POST', body: '{}' }),
  adminErrors: () =>
    apiFetch<{ errors: { kind: string; message: string; stack: string; url: string; app_version: string; created_at: string }[] }>('/v1/admin/errors'),
  adminDeleteCourse: (code: string) =>
    apiFetch<{ ok: boolean }>(`/v1/admin/courses/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  teaching: () => apiFetch<{ courses: string[] }>('/v1/teaching'),
  timetable: (course: string) =>
    apiFetch<{ slots: ClassSlot[] }>(`/v1/timetable?course=${encodeURIComponent(course)}`),
  slotAdd: (payload: { course: string; day: number; start: string; end: string; venue: string; meetLink?: string }) =>
    apiFetch<{ ok: boolean; id: string }>('/v1/timetable', { method: 'POST', body: JSON.stringify(payload) }),
  slotSetLink: (id: string, meetLink: string) =>
    apiFetch<{ ok: boolean }>(`/v1/timetable/${id}`, { method: 'PATCH', body: JSON.stringify({ meetLink }) }),
  materials: (course: string) => apiFetch<{ materials: Material[] }>(`/v1/materials?course=${encodeURIComponent(course)}`),
  materialAdd: (payload: { course: string; week: number; type: Material['type']; title: string; url: string }) =>
    apiFetch<{ ok: boolean; id: string }>('/v1/materials', { method: 'POST', body: JSON.stringify(payload) }),
  materialDelete: (id: string) => apiFetch<{ ok: boolean }>(`/v1/materials/${id}`, { method: 'DELETE' }),
  slotDelete: (id: string) =>
    apiFetch<{ ok: boolean }>(`/v1/timetable/${id}`, { method: 'DELETE' }),
  roster: (course: string) =>
    apiFetch<{ students: RosterStudent[] }>(`/v1/courses/${encodeURIComponent(course)}/students`),
  setPersona: (persona: string, clearPhoto = false) =>
    apiFetch<{ ok: boolean }>('/v1/persona', { method: 'PUT', body: JSON.stringify({ persona, clearPhoto }) }),
  // CGPA planner (students)
  cgpa: () => apiFetch<CgpaData>('/v1/cgpa'),
  cgpaSave: (payload: {
    cgpaCurrent?: number; cgpaTarget?: number; unitsDone?: number; unitsTotal?: number; degreeYears?: number; hide?: boolean;
    courses?: { code: string; status: CgpaCourse['status']; units: number; grade?: number | null }[];
  }) => apiFetch<{ ok: boolean }>('/v1/cgpa', { method: 'PUT', body: JSON.stringify(payload) }),
  // Head of Class
  hocPosts: () => apiFetch<{ posts: HocPost[]; isHoc: boolean; department?: string; level?: string }>('/v1/hoc/posts'),
  hocPost: (payload: { type: HocPost['type']; title?: string; content: string }) =>
    apiFetch<{ ok: boolean; id: string }>('/v1/hoc/posts', { method: 'POST', body: JSON.stringify(payload) }),
  hocDelete: (id: string) => apiFetch<{ ok: boolean }>(`/v1/hoc/posts/${id}`, { method: 'DELETE' }),
  hocRequest: () => apiFetch<{ ok: boolean }>('/v1/hoc/request', { method: 'POST', body: '{}' }),
  hocGrant: (email: string, revoke = false) =>
    apiFetch<{ ok: boolean; name: string | null; isHoc: boolean }>('/v1/hoc/grant', { method: 'POST', body: JSON.stringify({ email, revoke }) }),
  // Attendance
  attendanceProfile: () => apiFetch<{ fullName: string; matric: string }>('/v1/attendance/profile'),
  attendanceSetProfile: (fullName: string, matric: string) =>
    apiFetch<{ ok: boolean }>('/v1/attendance/profile', { method: 'PUT', body: JSON.stringify({ fullName, matric }) }),
  attendanceStart: (course: string, week?: number, minutes?: number, online?: { meetLink?: string }) =>
    apiFetch<AttendanceRegister>('/v1/attendance/sessions', { method: 'POST', body: JSON.stringify({ course, week, minutes, ...(online ? { online: true, meetLink: online.meetLink || undefined } : {}) }) }),
  attendanceRegister: (course: string) =>
    apiFetch<AttendanceRegister>(`/v1/attendance/sessions?course=${encodeURIComponent(course)}`),
  attendanceClose: (id: string) => apiFetch<{ ok: boolean }>(`/v1/attendance/sessions/${id}/close`, { method: 'POST', body: '{}' }),
  // Online classes only: the code shared in the meeting chat.
  attendanceCheckin: (code: string) =>
    apiFetch<{ ok: boolean; already: boolean; course: string }>('/v1/attendance/checkin', { method: 'POST', body: JSON.stringify({ code }) }),
  attendancePass: () => apiFetch<AttendancePass>('/v1/attendance/pass'),
  attendanceScan: (sessionId: string, input: { token: string } | { matric: string }) =>
    apiFetch<ScanResult>(`/v1/attendance/sessions/${sessionId}/scan`, { method: 'POST', body: JSON.stringify(input) }),
  attendanceMine: () =>
    apiFetch<{ courses: { course: string; held: number; attended: number }[]; recent: { course: string; at: string }[] }>('/v1/attendance/mine'),
  attendanceExport: (sessionId: string, course: string) =>
    apiDownload(`/v1/attendance/sessions/${sessionId}/register.csv`, `${course.replace(/\s+/g, '')}-register.csv`),
  // Class lists: student side
  classListMe: () => apiFetch<ClassListMe>('/v1/class-list/me'),
  classListClaim: (matric: string, ask?: { fullName: string; note?: string }) =>
    apiFetch<ClaimOutcome>('/v1/class-list/claim', { method: 'POST', body: JSON.stringify({ matric, ...(ask ? { ...ask, askHoc: true } : {}) }) }),
  classListCancelRequest: () => apiFetch<{ ok: boolean }>('/v1/class-list/request', { method: 'DELETE' }),
  classListEmailStart: (email: string) =>
    apiFetch<{ ok: boolean; email: string; matric: string }>('/v1/class-list/verify-email/start', { method: 'POST', body: JSON.stringify({ email }) }),
  classListEmailConfirm: (code: string, fullName?: string) =>
    apiFetch<ClaimOutcome & { verified: boolean; matric: string }>('/v1/class-list/verify-email/confirm', { method: 'POST', body: JSON.stringify({ code, fullName }) }),
  // Class lists: HOC side
  classList: () => apiFetch<ClassListData>('/v1/class-list'),
  classListParse: (input: { text: string } | { filename: string; data: string }) =>
    apiFetch<ClassListParse>('/v1/class-list/parse', { method: 'POST', body: JSON.stringify(input) }, 0, 60000),
  classListSave: (rows: { name: string; matric: string }[], source?: string) =>
    apiFetch<{ ok: boolean; added: number; restored: number; unchanged: number; nameDiffers: number; linked: number }>('/v1/class-list/entries', { method: 'POST', body: JSON.stringify({ rows, source }) }, 0, 60000),
  classListEdit: (id: string, patch: { name?: string; matric?: string }) =>
    apiFetch<{ ok: boolean }>(`/v1/class-list/entries/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  classListRemove: (id: string) => apiFetch<{ ok: boolean }>(`/v1/class-list/entries/${id}`, { method: 'DELETE' }),
  classListRestore: (id: string) => apiFetch<{ ok: boolean }>(`/v1/class-list/entries/${id}/restore`, { method: 'POST', body: '{}' }),
  classListUnclaim: (id: string) => apiFetch<{ ok: boolean }>(`/v1/class-list/entries/${id}/unclaim`, { method: 'POST', body: '{}' }),
  classListAnswer: (id: string, action: 'approve' | 'reject', note?: string) =>
    apiFetch<{ ok: boolean }>(`/v1/class-list/claims/${id}`, { method: 'POST', body: JSON.stringify({ action, note }) }),
};

