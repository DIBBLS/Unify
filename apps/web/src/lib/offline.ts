import { apiFetch, getApiUrl } from './api';
import { supabaseBrowser } from './supabase';

// Offline-first foundation.
// Two halves:
//  1. Write queue — progress / quiz / resume POSTs made while offline are
//     stashed in localStorage and flushed in order on reconnect (and on boot).
//     Local state already updates optimistically, so nothing is ever lost.
//  2. Saved weeks — the reader caches a week's payload into the same Cache
//     Storage the service worker reads, so saved weeks open with zero
//     network. The SW stays the single serving path (no dual logic).
const QUEUE_KEY = 'unify.offline.queue.v1';
const SAVED_KEY = 'unify.offline.weeks.v1';

type QueuedWrite = { path: string; body: string; ts: number };

function readQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((q) => q && typeof q.path === 'string') : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedWrite[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-100)));
  } catch {
    // storage full/blocked: drop the queue rather than crash
  }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function pendingCount(): number {
  return readQueue().length;
}

function notify() {
  try {
    window.dispatchEvent(new CustomEvent('unify-queue', { detail: { pending: pendingCount() } }));
  } catch {
    // non-DOM context: no listeners anyway
  }
}

// Stash a POST for later. Returns true when queued (caller resolves
// optimistically), false when online (caller should send live).
export function queueWrite(path: string, body: string): boolean {
  if (isOnline()) return false;
  const q = readQueue();
  // Progress toggles are idempotent on the server (upsert): collapse
  // duplicates so a long offline read bursts into one flush per topic.
  if (!q.some((w) => w.path === path && w.body === body)) {
    q.push({ path, body, ts: Date.now() });
    writeQueue(q);
  }
  notify();
  return true;
}

let flushing = false;

// POST every queued write in order. Failures stay queued for next time;
// a 401 means the session died, so the queue is dropped (re-login
// rebuilds state from the server anyway).
export async function flushQueue(): Promise<void> {
  if (flushing || !isOnline()) return;
  const q = readQueue();
  if (!q.length) return;
  flushing = true;
  try {
    const rest: QueuedWrite[] = [];
    for (const w of q) {
      try {
        await apiFetch(w.path, { method: 'POST', body: w.body }, 0, 15000);
      } catch (err) {
        if ((err as { status?: number })?.status === 401) {
          writeQueue([]);
          notify();
          return;
        }
        rest.push(w);
      }
    }
    writeQueue(rest);
    notify();
  } finally {
    flushing = false;
  }
}

export function savedWeeks(): { course: string; week: number }[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function isWeekSaved(course: string, week: number): boolean {
  const key = course.toUpperCase().trim();
  return savedWeeks().some((w) => w.course === key && w.week === week);
}

// Fetch a week's payload live and put it in Cache Storage under the exact
// request URL the reader uses, so the SW serves it offline. Marks the
// week saved only after the put succeeds.
export async function saveWeekOffline(course: string, week: number): Promise<void> {
  const base = getApiUrl();
  if (!base) throw new Error('API not configured.');
  const code = course.trim();
  const url = `${base}/v1/courses/${encodeURIComponent(code)}/weeks/${week}`;
  // The week endpoint is authed: send the session token or we cache a 401.
  let token: string | null = null;
  try {
    const { data } = await supabaseBrowser()?.auth.getSession() ?? { data: null };
    token = data?.session?.access_token ?? null;
  } catch {
    token = null;
  }
  const res = await fetch(url, { mode: 'cors', headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Could not download this week. Connect and retry.');
  if (!('caches' in window)) throw new Error('Offline storage is unavailable in this browser.');
  const cache = await caches.open('unify-content-v1');
  await cache.put(url, res);
  try {
    const list = savedWeeks().filter((w) => !(w.course === code.toUpperCase() && w.week === week));
    list.push({ course: code.toUpperCase(), week });
    localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(-30)));
  } catch {
    // marker optional; the cached payload is what matters
  }
}
