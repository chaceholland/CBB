// College Baseball Tracker - Service Worker
// Provides offline support and performance optimization

const CACHE_VERSION = 'cbb-tracker-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/schedule.html',
  '/analytics.html',
  '/analytics_charts.js',
  '/manifest.json',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap',
  // External libraries
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Data files to cache with network-first strategy
const DATA_FILES = [
  '/data/pitchers.json',
  '/data/teams.json',
  '/data/schedule.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Install failed:', err))
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('cbb-tracker-') &&
                     cacheName !== STATIC_CACHE &&
                     cacheName !== DATA_CACHE &&
                     cacheName !== IMAGE_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy: Cache First for static assets
  if (STATIC_ASSETS.some(asset => url.pathname.includes(asset))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy: Network First for data files
  if (DATA_FILES.some(file => url.pathname.includes(file))) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Strategy: Cache First for images (headshots)
  if (url.pathname.includes('/headshots/') || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Strategy: Network First for API calls
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// Cache First Strategy - for static assets
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache First failed:', error);

    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      return new Response(getOfflinePage(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    throw error;
  }
}

// Network First Strategy - for data files
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      return new Response(getOfflinePage(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    throw error;
  }
}

// Offline fallback page
function getOfflinePage() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - CBB Tracker</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #fafaf8 0%, #f1f5f9 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      color: #0f172a;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 3rem 2rem;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.15);
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #0f172a;
    }
    p {
      font-size: 1rem;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 2rem;
    }
    .btn {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 0.875rem 2rem;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn:hover {
      background: #059669;
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>You're Offline</h1>
    <p>The College Baseball Tracker needs an internet connection to load new data. Your cached data may still be available.</p>
    <a href="/" class="btn">Try Again</a>
  </div>
</body>
</html>
  `;
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
