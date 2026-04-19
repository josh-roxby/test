// Tempo service worker.
// Strategy:
//   - HTML / JS / CSS / manifest: network-first (always try fresh), fall back to cache offline.
//     This prevents stale code after a deploy — the biggest PWA gotcha.
//   - Images and other same-origin GETs: cache-first (they rarely change).
//   - Pre-cache the minimal app shell so first offline load works.
// Bump VERSION when you want to force-clear old caches.

const VERSION = 'tempo-shell-v3';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isAppShellRequest(request, url) {
  if (request.mode === 'navigate') return true;
  return /\.(html|js|css|json)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isAppShellRequest(request, url)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw new Error('offline and no cached response');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

// ---- Web Push ---------------------------------------------------------------

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Tempo', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Tempo';
  const options = {
    body: data.body || '',
    tag: data.tag || 'tempo-notification',
    icon: './icon.svg',
    badge: './icon.svg',
    data: { url: data.url || '/' },
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      try {
        const u = new URL(client.url);
        if (u.origin !== self.location.origin) continue;
        if ('navigate' in client) {
          try { await client.navigate(targetUrl); } catch {}
        }
        return client.focus();
      } catch {}
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});

// Fired when the browser rotates/invalidates the subscription. We can't
// re-subscribe from the SW without the cached reminder preferences, so we
// clean up the old endpoint server-side and let the client re-subscribe on
// next load.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      if (event.oldSubscription?.endpoint) {
        await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: event.oldSubscription.endpoint }),
        });
      }
    } catch (err) {
      console.warn('pushsubscriptionchange cleanup failed', err);
    }
  })());
});
