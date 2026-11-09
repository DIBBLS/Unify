// Keeps the installed app on the newest build, quietly.
//
// Every build gets an id (see vite.config.ts). The service worker file changes
// with it, so the browser sees a new worker; the old worker's caches are
// deleted when the new one activates. This module goes looking for updates
// (on open, on coming back to the app, on reconnect, every couple of minutes),
// and when a newer build is running it reloads the page onto it.
//
// It never yanks the page away mid-typing: if a text field is focused, the
// reload waits until the person leaves the field or hides the app.

const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
const CHECK_EVERY_MS = 2 * 60 * 1000;
const LOOP_KEY = 'unify.update.reloaded';

export function startAutoUpdate(): void {
  if (!('serviceWorker' in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  let waiting = false;
  let reg: ServiceWorkerRegistration | undefined;

  const editing = (): boolean => {
    const a = document.activeElement as HTMLElement | null;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
  };
  const reloadNow = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };
  const apply = () => {
    if (document.hidden || !editing()) reloadNow();
    else waiting = true;
  };

  // A new worker took over: the page is running old code against new caches.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) apply();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && waiting) reloadNow();
  });
  document.addEventListener('focusout', () => {
    if (waiting) window.setTimeout(() => { if (!editing()) reloadNow(); }, 0);
  });

  const checkVersion = async () => {
    if (BUILD === 'dev') return;
    try {
      const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const v = (await res.json()) as { build?: string };
      if (!v.build || v.build === BUILD) return;
      void reg?.update().catch(() => {});
      // One reload per minute at most, so a slow CDN can never cause a loop.
      const last = Number(sessionStorage.getItem(LOOP_KEY) || 0);
      if (Date.now() - last < 60000) return;
      sessionStorage.setItem(LOOP_KEY, String(Date.now()));
      apply();
    } catch {
      // offline: try again later
    }
  };

  const check = () => {
    void reg?.update().catch(() => {});
    void checkVersion();
  };

  const boot = () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((r) => {
        reg = r;
        check();
      })
      .catch(() => {});
    window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
  };

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
}
