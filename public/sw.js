/* RönneKoll service worker — makes the app installable and opens it fast/offline.
 * Only the app itself is cached. SharePoint data (graph.microsoft.com) and the token are never cached. */
const VERSION = 'rk-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const BASE = new URL('./', self.location).pathname; // e.g. /ronnekoll-admin/

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([BASE, `${BASE}manifest.webmanifest`, `${BASE}icons/icon-192.png`])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never touch Microsoft Graph / login traffic.
  if (/graph\.microsoft\.com|login\.microsoftonline\.com/.test(url.hostname)) return;

  // Fonts and icons from Google: cache, refresh in the background.
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, ASSETS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages: network first (always newest app), fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return res; })
        .catch(async () => (await caches.match(req)) || (await caches.match(BASE)) || Response.error()),
    );
    return;
  }

  // Build files have content hashes: cache forever.
  if (url.pathname.includes('/_next/static/') || url.pathname.includes('/icons/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)); return res; })));
    return;
  }

  event.respondWith(staleWhileRevalidate(req, SHELL));
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}
