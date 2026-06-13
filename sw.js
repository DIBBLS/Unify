const CACHE = 'unify-v7';

// Only truly static, versioned assets go in the cache
const SHELL = [
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/responsive.css',
  './css/layout.css',
  './css/pages/dashboard-v2.styles.css',
  './css/pages/Auth.styles.css',
  './js/theme.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all tabs to reload so they get fresh content
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  const path = url.pathname;

  // NEVER cache: HTML pages, JS data files, firebase config
  const neverCache =
    request.destination === 'document' ||
    path.endsWith('.html') ||
    path === '/' ||
    /\/(Coursecontent\.JS|courses\.js|course2\.js|script\.js|firebase-config\.js)$/i.test(path);

  if (neverCache) {
    // Network only — always fresh
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets (CSS, images, fonts, versioned JS)
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      });
    })
  );
});
