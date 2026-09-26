// Increase this name whenever the app shell changes, so old offline assets are removed.
const CACHE_NAME = 'walk-rhythm-pwa-v3-20260926-1';
const CACHE_PREFIX = 'walk-rhythm-pwa-';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './media/silence.m4a',
  './media/awake.mp4'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy)));
        }
        return response;
      }).catch(() => caches.open(CACHE_NAME).then(cache => cache.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(request).then(async cached => {
      if (cached && request.headers.has('range')) {
        const bytes = await cached.arrayBuffer();
        const size = bytes.byteLength;
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range'));
        if (range) {
          const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
          const end = range[2] && range[1] ? Math.min(Number(range[2]), size - 1) : size - 1;
          if (start < size && start <= end) {
            return new Response(bytes.slice(start, end + 1), {
              status: 206,
              headers: {
                'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
                'Content-Range': `bytes ${start}-${end}/${size}`,
                'Content-Length': String(end - start + 1),
                'Accept-Ranges': 'bytes'
              }
            });
          }
        }
        return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
      }
      if (cached) return cached;
      return fetch(request).then(response => {
      if (response.status === 200 && !request.headers.has('range')) {
        const copy = response.clone();
        event.waitUntil(cache.put(request, copy));
      }
      return response;
      });
    }))
  );
});
