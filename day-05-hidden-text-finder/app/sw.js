/* Hidden Text Finder service worker: keeps the app working offline. It caches the app's own files
   only; the CVs you check are never stored here or anywhere else. */
const CACHE = 'hidden-text-v1';
const CORE = ['./', 'index.html', 'app.css', 'app.js', 'theme.js', 'phrases.js', 'detect-pdf.js', 'detect-docx.js', 'icons.js',
  'lib/fflate.js', 'lib/pdfjs/pdf.min.mjs', 'lib/pdfjs/pdf.worker.min.mjs', 'manifest.webmanifest', 'icon.svg',
  'fonts/plex-latin.woff2', 'fonts/plex-latin-ext.woff2', 'icons/icon-192.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  // Fonts, character maps and decoders are cached the first time a file needs them.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
    return r;
  })));
});
