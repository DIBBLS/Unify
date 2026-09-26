// Unify Learn offline worker: shell + readable content stay available offline.
// Versioned cache; documents network-first (never a stale app), static assets
// cache-first, API GETs network-first with cache fallback. Writes (POST/PUT/
// DELETE) and everything else always bypass. v4 (push events + bump on any
// shell-affecting change so old clients pick up the new worker + fresh
// shell on next visit).
const CACHE = 'unify-app-v4';
const SHELL = ['/', '/index.html', '/manifest.json'];

// Update here if the backend moves (must match VITE_API_URL origin).
const API_ORIGIN = 'https://unify-api-z4zm.onrender.com';

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navigations: live app when online, cached shell when offline.
  // The cached shell is always from THIS worker version (old caches are
  // purged on activate), so offline boots never show a stale UI.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((r) => r || Response.error())
      )
    );
    return;
  }

  const sameOrigin = url.origin === location.origin;
  const isApi = url.origin === API_ORIGIN && url.pathname.startsWith('/v1/');
  const isAsset =
    sameOrigin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname === '/og-image.png' ||
      url.pathname === '/favicon.svg');
  if (!isAsset && !isApi) return;

  e.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => null);
      // Versioned bundles: cache-first. Content: fresh first, cached fallback.
      if (isAsset && cached) return cached;
      const fresh = await network;
      if (fresh) return fresh;
      if (cached) return cached;
      return Response.error();
    })()
  );
});

// Web Push: lock-screen notification from the backend fan-out. Tapping
// opens the linked page (falls back to /notifications).
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = {};
  }
  const title = (data && data.title) || 'Unify Learn';
  const body = (data && data.body) || 'Something new is waiting for you.';
  const url = (data && data.url) || '/notifications';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/notifications';
  e.waitUntil(
    (async () => {
      const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        try {
          const u = new URL(w.url);
          if (u.pathname === new URL(url, self.location.origin).pathname) {
            await w.focus();
            return;
          }
        } catch {
          // keep looking
        }
      }
      await clients.openWindow(url);
    })()
  );
});
