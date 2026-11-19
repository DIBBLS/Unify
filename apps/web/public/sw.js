// Unify Learn offline worker: shell + readable content stay available offline.
// Versioned cache. The app opens from the page saved on the phone (only when
// every file it needs is saved too) while the newest page downloads for next
// time; a reload always fetches fresh. Static assets cache-first.
// API GETs are served "network, but never make the user wait":
// fresh when the network answers within 2s, otherwise the last copy THIS USER
// saw (per-user keys: phones are shared, one student must never be handed
// another's data). Live endpoints (attendance sessions, admin) are never
// cached. Writes (POST/PUT/DELETE) always bypass.
// The build id is stamped in at build time (vite.config.ts), so every release
// is a new worker with its own cache and the previous build's cache is deleted.
const BUILD = '__BUILD_ID__';
const CACHE = 'unify-app-' + BUILD;
const CONTENT = 'unify-content-v1';
const API_CACHE = 'unify-api-v1';
// With a saved copy, wait this long for fresh data before showing the copy
// (the fresh answer still updates the cache for next time). 2 s keeps repeat
// visits quick on slow networks.
const API_WAIT_MS = 2000;
// Never replayed from cache: live data, one-time actions, admin tooling, and
// class lists (names + matric numbers stay off the device and are always current).
// Revision and progress must reflect the topic you just finished, never an older copy.
const NO_CACHE = [/^\/v1\/attendance\/(sessions|checkin|pass|course)/, /^\/v1\/admin\//, /^\/v1\/class-list/, /^\/v1\/learn\/revision/, /^\/v1\/progress/];
const SHELL = ['/', '/index.html', '/manifest.json'];

// The API origin is stamped in at build time from VITE_API_URL (vite.config.ts),
// so moving the backend is a Vercel env change. The fallback is today's host.
const API_ORIGIN = '__API_ORIGIN__'.startsWith('http') ? '__API_ORIGIN__' : 'https://unify-api-eu.onrender.com';

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

const isHtml = (res) => /text\/html/i.test((res.headers && res.headers.get('content-type')) || '');

// ---- Opening from the phone ----
// The saved page is only used when every script and style it names is saved
// too, so it can never open half-built. A reload (including the one lazyRoute
// does when a deploy removed a code chunk) always fetches the newest page.
const entryFiles = (html) => [...new Set((html.match(/\/assets\/[^"'\s>]+\.(?:js|css)/g) || []))];

async function readyShell() {
  const c = await caches.open(CACHE);
  const page = await c.match('/index.html');
  if (!page || !isHtml(page)) return null;
  const files = entryFiles(await page.clone().text());
  if (!files.length) return null;
  const saved = await Promise.all(files.map((f) => c.match(f)));
  return saved.every(Boolean) ? page : null;
}

// Keep the newest page, but only after its scripts and styles are saved.
async function saveShell(res) {
  const html = await res.text();
  const c = await caches.open(CACHE);
  for (const f of entryFiles(html)) {
    if (await c.match(f)) continue;
    const r = await fetch(f).catch(() => null);
    if (!r || !r.ok || isHtml(r)) return; // a deploy in flight: keep the old page
    await c.put(f, r);
  }
  await c.put('/index.html', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
}

async function shellFirst(e, request) {
  const network = fetch(request).then((res) => {
    if (res && res.ok && isHtml(res)) e.waitUntil(saveShell(res.clone()).catch(() => {}));
    return res;
  });
  const reload = request.cache === 'reload' || request.cache === 'no-cache' || request.cache === 'no-store';
  if (!reload) {
    const page = await readyShell().catch(() => null);
    if (page) {
      e.waitUntil(network.catch(() => {}));
      return page;
    }
  }
  try {
    return await network;
  } catch {
    return (await caches.match('/index.html')) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Navigations: the app opens from the copy on the phone (no wait on the
  // network), and the newest page is fetched in the background for next time.
  // Server routes (/api) always go to the network.
  if (request.mode === 'navigate') {
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    e.respondWith(shellFirst(e, request));
    return;
  }

  const sameOrigin = url.origin === location.origin;
  const isApi = url.origin === API_ORIGIN && url.pathname.startsWith('/v1/');
  const isAsset =
    sameOrigin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/boxboy/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/og-image.jpg' ||
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
        .then(async (res) => {
          // A script/style that arrives as HTML is a stale copy (the browser's own cache can hold
          // one from a deploy). Ask the server again, skipping and overwriting that copy.
          if (isAsset && res && isHtml(res) && !/\.html?$/.test(url.pathname)) {
            try { res = await fetch(new Request(request, { cache: 'reload' })); } catch { /* keep res */ }
          }
          return res;
        })
        .then((res) => {
          // Opaque (no-cors) CDN responses have status 0 but are perfectly
          // cacheable — the MathJax <script> arrives this way.
          // Never keep an HTML page under a script/style/image address: a deploy in flight (or a
          // missing file) can answer with index.html, and a cache-first copy would stick forever.
          const wrong = isAsset && res && isHtml(res) && !/\.html?$/.test(url.pathname);
          if (res && (res.ok || res.type === 'opaque') && !wrong) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => null);
      // Versioned bundles, MathJax, fonts and storage media: cache-first.
      // Content: fresh first, cached fallback.
      const poisoned = cached && isAsset && isHtml(cached) && !/\.html?$/.test(url.pathname);
      if (poisoned) { caches.open(CACHE).then((c) => c.delete(request)); }
      if ((isAsset || isMathCdn || isFontCdn || isStorageMedia) && cached && !poisoned) return cached;
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
      // Mark the home-screen icon even while the app is closed (the open
      // app replaces this dot with the real count on its next refresh).
      try {
        if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge();
      } catch {
        // badges unsupported
      }
      await self.registration.showNotification(title, {
        body,
        icon: '/icons/v5/icon-192.png',
        // Status-bar icon (Android draws only its outline, like WhatsApp's chat
        // bubble): a white U on transparent. A full-colour square here shows up
        // as a plain white block.
        badge: '/icons/v5/badge-96.png',
        data: { url },
      });
    })()
  );
});

// Tapping a notification opens the page it's about (the timetable for a
// class change, the week for new notes, the class board for an answer).
// A full address of the app becomes a path, so it opens inside the installed
// app; if the app is already open, that window comes forward and goes there
// (opening a second window would just show whatever page it was on).
function pathOf(raw) {
  const fallback = '/notifications';
  if (!raw) return fallback;
  try {
    const u = new URL(raw, self.location.origin);
    const ours = u.origin === self.location.origin || /\.vercel\.app$/i.test(u.hostname);
    if (!ours) return u.href;
    const path = u.pathname + u.search + u.hash;
    return u.pathname === '/dashboard' ? '/home' : path;
  } catch {
    return fallback;
  }
}
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = pathOf(e.notification.data && e.notification.data.url);
  e.waitUntil(
    (async () => {
      if (/^https?:/i.test(target)) { await clients.openWindow(target); return; }
      const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const mine = wins.filter((w) => { try { return new URL(w.url).origin === self.location.origin; } catch { return false; } });
      const w = mine.find((x) => x.focused) || mine[0];
      if (w) {
        try { await w.focus(); } catch { /* focus can be refused; still send it there */ }
        try { w.postMessage({ type: 'unify-open', url: target }); return; } catch { /* fall through */ }
        try { if (w.navigate) { await w.navigate(target); return; } } catch { /* fall through */ }
      }
      await clients.openWindow(target);
    })()
  );
});
