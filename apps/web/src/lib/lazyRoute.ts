import { lazy, type ComponentType } from 'react';

// Route chunks are content-hashed. A tab left open across a deploy (or opened
// from a cached shell) can request a chunk the new build no longer ships —
// "Failed to fetch dynamically imported module" — which used to blow up the
// first screen after sign-in (usually /notifications). One silent reload
// picks up the new index.html and its chunk map; a repeat within 10s falls
// through to ErrorBoundary so a genuinely broken build cannot loop forever.
const RELOAD_KEY = 'unify:chunk-reload-at';

async function attempt<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (first) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      return await fn();
    } catch {
      throw first;
    }
  }
}

export function lazyRoute<T extends ComponentType<any>>(fn: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await attempt(fn);
    } catch (err) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
      throw err;
    }
  });
}


// Warm the code for the screens people open next (other tabs, games,
// Revision) once the app is idle, so the first tap is instant instead of a
// fetch. Skipped on Data Saver and 2G, and on browsers without idle callbacks
// it waits a few seconds instead. Each import resolves to the same module the
// lazy route asks for later, so nothing downloads twice.
export function preloadWhenIdle(loaders: (() => Promise<unknown>)[]): void {
  if (typeof window === 'undefined') return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '')) return;
  const run = () => {
    let i = 0;
    const next = () => {
      const load = loaders[i++];
      if (!load) return;
      load().catch(() => {}).finally(() => schedule(next));
    };
    next();
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const schedule = (cb: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 4000 }) : window.setTimeout(cb, 300));
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 6000 });
  else window.setTimeout(run, 3500);
}
