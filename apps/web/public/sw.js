// Unify Learn offline worker: shell + readable content stay available offline.
// Versioned cache; documents network-first (never a stale app), static assets
// cache-first. API GETs are served "network, but never make the user wait":
// fresh when the network answers within 4s, otherwise the last copy THIS USER
// saw (per-user keys: phones are shared, one student must never be handed
// another's data). Live endpoints (attendance sessions, admin) are never
// cached. Writes (POST/PUT/DELETE) always bypass.
// The build id is stamped in at build time (vite.config.ts), so every release
// is a new worker with its own cache and the previous build's cache is deleted.
const BUILD = '__BUILD_ID__';
const CACHE = 'unify-app-' + BUILD;
const CONTENT = 'unify-content-v1';
const API_CACHE = 'unify-api-v1';
const API_WAIT_MS = 4000;
// Never replayed from cache: live data, one-time actions, admin tooling.
const NO_CACHE = [/^\/v1\/attendance\/(sessions|checkin)/, /^\/v1\/admin\//];
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
      // CONTENT survives upgrades: saved weeks must never vanish because
      // the app shell moved on.
      await Promise.all(keys.filter((k) => k !== CACHE && k !== CONTENT && k !== API_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Whose request is it? The Supabase JWT 'sub' (never trusted, only used to
// partition the cache). Anonymous endpoints share one 'anon' partition.
function cacheOwner(request) {
  try {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
    const payload = token.split('.')[1];
    if (!payload) return 'anon';
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.sub === 'string' && json.sub ? json.sub : 'anon';
  } catch {
    return 'anon';
  }
}

async function apiFirst(e, request, url) {
  if (NO_CACHE.some((rx) => rx.test(url.pathname))) return fetch(request).catch(() => Response.error());
  const key = new Request(url.href + (url.search ? '&' : '?') + '__u=' + cacheOwner(request));
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(key);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    })
    .catch(() => null);
  // Let the refresh finish (and update the cache) even if we answered early.
  e.waitUntil(network);
  if (!cached) return (await network) || Response.error();
  // We have a copy: wait a few seconds for fresh data, then stop making the
  // user wait. Real errors (401 etc.) are always passed through.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), API_WAIT_MS));
  const fresh = await Promise.race([network, timeout]);
  return fresh || cached;
}

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
      url.pathname.startsWith('/boxboy/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/og-image.png' ||
      url.pathname === '/favicon.svg');
  // Offline math + typography: MathJax (script + its font files, same
  // version-pinned path) and Google Fonts. Cached on first online visit,
  // then equations render with zero network. Immutable URLs → cache-first.
  const isMathCdn =
    url.origin === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/mathjax@3/');
  const isFontCdn =
    (url.origin === 'fonts.googleapis.com' && url.pathname === '/css2') ||
    url.origin === 'fonts.gstatic.com';
  // Narrator audio + diagrams from Supabase Storage: immutable uploads
  // (timestamped paths) go cache-first so saved weeks play offline.
  const isStorageMedia =
    url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/');
  if (isApi) {
    e.respondWith(apiFirst(e, request, url));
    return;
  }
  if (!isAsset && !isMathCdn && !isFontCdn && !isStorageMedia) return;

  e.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((res) => {
          // Opaque (no-cors) CDN responses have status 0 but are perfectly
          // cacheable — the MathJax <script> arrives this way.
          if (res && (res.ok || res.type === 'opaque')) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => null);
      // Versioned bundles, MathJax, fonts and storage media: cache-first.
      // Content: fresh first, cached fallback.
      if ((isAsset || isMathCdn || isFontCdn || isStorageMedia) && cached) return cached;
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
    (async () => {
      // Push-driven bell: tell every open tab to refresh its unread badge
      // NOW instead of waiting for the next poll (see _layout.tsx).
      try {
        const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const w of wins) {
          try {
            w.postMessage({ type: 'unify-notif' });
          } catch {
            // one deaf tab must not block the rest
          }
        }
      } catch {
        // postMessage unsupported — badge falls back to polling
      }
      await self.registration.showNotification(title, {
        body,
        icon: '/icons/v3/icon-192.png',
        badge: '/icons/v3/favicon-32.png',
        data: { url },
      });
    })()
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
