/* Citation Check service worker: keeps the app itself loading offline. Lookups need the network;
   the page says so when it's offline. API responses are never cached. */
const CACHE = 'citation-check-v1';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'cite-core.js', 'manifest.webmanifest', 'icon.svg',
  'fonts/instrument-sans-latin.woff2', 'fonts/instrument-sans-latin-ext.woff2', 'fonts/instrument-serif-latin.woff2', 'icons/icon-192.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
