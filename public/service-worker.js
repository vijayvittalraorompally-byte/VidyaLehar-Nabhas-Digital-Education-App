const CACHE_NAME = 'ai-app-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches if any
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for other static assets (stale-while-revalidate)
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Adjust this condition if your API base is different
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/v1/')) {
    // Network-first for API
    event.respondWith(
      fetch(req)
        .then(resp => {
          // Optionally cache successful API responses:
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // For navigation requests (app shell)
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          // update cache
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return resp;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other assets: cache-first, and update in background
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(resp => {
        // update cache
        if (resp && resp.status === 200 && req.method === 'GET') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return resp;
      }).catch(() => null);

      // Return cached if present, otherwise network result
      return cached || networkFetch;
    })
  );
});
