const CACHE_NAME = 'unify-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/Auth.html',
  '/Onboarding.html',
  '/timetable.html',
  '/profile.html',
  '/predictor.html',
  '/course.html',
  '/Learn.html',
  '/notes.html',
  '/404.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/responsive.css',
  '/js/theme.js',
  '/courses.js',
  '/style.css',
];

// Domains that must never be intercepted
const PASSTHROUGH_DOMAINS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'gstatic.com',
  'www.gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll failures are non-fatal — offline shell still works
      Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Pass Firebase / Google APIs straight through
  if (PASSTHROUGH_DOMAINS.some((d) => url.hostname.includes(d))) return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // HTML navigation — network first, fall back to cache then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/dashboard.html'))
        )
    );
    return;
  }

  // Same-origin static assets — cache first, update in background
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          }
          return res;
        });
        return cached || networkFetch;
      })
    );
  }
});
