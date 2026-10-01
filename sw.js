// Service Worker for Gemini Multimodal Image Studio (PWA)
const CACHE_NAME = 'gemini-studio-v2.7';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept dev server internals, HMR, APIs, or non-GET requests
  if (
    event.request.method !== 'GET' ||
    url.includes('/@') ||
    url.includes('/node_modules/') ||
    url.includes('googleapis.com') ||
    url.includes('_aistudio') ||
    url.includes(':3000') ||
    url.includes(':8080') ||
    url.includes('localhost')
  ) {
    return;
  }

  // Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
