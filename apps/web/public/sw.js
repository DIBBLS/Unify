// Unify no longer uses a service worker (SPA shell + API backend).
// This file exists only to dislodge stale unify-v* workers that browsers
// registered during the legacy static era: it clears their caches,
// unregisters itself, and reloads controlled tabs once.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('unify-')).map((k) => caches.delete(k)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      await self.clients.claim();
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
