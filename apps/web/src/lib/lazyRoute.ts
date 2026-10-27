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
