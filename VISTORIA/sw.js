// Offline support: pre-cache the app shell, then serve cache-first and refresh in the background.
// Bump VERSION whenever any file changes so phones pick up the new copy (the old cache is deleted).
const VERSION = 'v7';
const CACHE = `vistoria-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/htm-preact.js',
  'vendor/fflate.js',
  'vendor/jspdf.umd.min.js',
  'js/app.js',
  'js/ui.js',
  'js/version.js',
  'js/db.js',
  'js/model.js',
  'js/store.js',
  'js/files.js',
  'js/hash.js',
  'js/photos.js',
  'js/photoui.js',
  'js/manifest.js',
  'js/report.js',
  'js/demophotos.js',
  'js/backup.js',
  'js/seed.js',
  'js/components.js',
  'js/views/home.js',
  'js/views/setup.js',
  'js/views/inspection.js',
  'js/views/room.js',
  'js/views/special.js',
  'js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vistoria-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || caches.match('index.html'));
      return hit || net;
    })
  );
});
