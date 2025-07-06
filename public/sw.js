const CACHE_NAME = 'hki-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/hki-logo-black.png',
  '/hki-logo-white.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(err => {
            console.warn(`Failed to cache ${url}:`, err);
          }))
        );
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for Next.js development assets and API routes
  if (url.pathname.startsWith('/_next/') || 
      url.pathname.startsWith('/api/') ||
      url.search.includes('?v=') ||
      url.hostname === 'localhost') {
    event.respondWith(fetch(event.request));
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});