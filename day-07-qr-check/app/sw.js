/* QR Check service worker: keeps the app working offline. Only the app's own files are cached; the
   codes you check and save stay in the page's own storage. */
const CACHE = 'qr-check-v2';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'qr-core.js', 'icons.js', 'manifest.webmanifest', 'icon.svg',
  'vendor/jsQR.js', 'vendor/qrcode.js', 'fonts/dm-sans-latin.woff2', 'fonts/dm-sans-latin-ext.woff2', 'icons/icon-192.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
    return r;
  })));
});
