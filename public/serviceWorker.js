// Service Worker for offline support
const CACHE_NAME = 'zimstreama-v1';
const OFFLINE_URL = '/offline.html';

// Files to pre-cache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.log('Precache failed:', err);
        // Don't fail if precache fails
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
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
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // DEVELOPMENT MODE: Always fetch from network, disable caching
  // This ensures you always get the latest build during development
  event.respondWith(
    fetch(request).catch(() => {
      // If network fails, return a simple error response
      return new Response(
        JSON.stringify({ error: 'Network unavailable' }),
        { status: 503, statusText: 'Service Unavailable' }
      );
    })
  );
});

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    // Cache successful responses
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    // Treat 404 as offline - try cache first
    if (response.status === 404) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('Got 404, returning cached version');
        return cachedResponse;
      }
    }
    return response;
  } catch (error) {
    console.log('Network request failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page or error response
    return new Response(
      JSON.stringify({ error: 'Offline - Resource not cached' }),
      { status: 503, statusText: 'Service Unavailable' }
    );
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    // Treat 404 as offline - return cached if available
    if (response.status === 404) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('Got 404, returning cached version');
        return cachedResponse;
      }
      // No cache available, check if it's HTML and return offline page
      if (request.headers.get('accept')?.includes('text/html')) {
        return caches.match(OFFLINE_URL) || 
          new Response('Offline', { status: 503 });
      }
    }
    return response;
  } catch (error) {
    console.log('Cache and network failed:', error);
    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match(OFFLINE_URL) || 
        new Response('Offline', { status: 503 });
    }
    return new Response(
      JSON.stringify({ error: 'Offline' }),
      { status: 503 }
    );
  }
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
