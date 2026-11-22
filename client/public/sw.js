/* See My EX-pense service worker: offline app shell + push notifications. */
const CACHE = 'sme-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-maskable-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const putInCache = (request, response) => {
  if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response));
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only our own static files. The API is never cached (data is per user and must be fresh).
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: network first so updates arrive at once; the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache('/', response.clone());
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Hashed build files never change: cache first. Icons and the manifest: cached copy, refreshed in the background.
  const isAsset = url.pathname.startsWith('/assets/');
  const isStatic = /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname);
  if (!isAsset && !isStatic) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        putInCache(request, response.clone());
        return response;
      });
      if (cached) {
        if (!isAsset) network.catch(() => {});
        return cached;
      }
      return network;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'See My EX-pense', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-maskable-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => (w.navigate ? w.navigate(target) : w));
      return self.clients.openWindow(target);
    })
  );
});
