/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = 'taxi-tera-cache-v8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // CRITICAL: Bypass Vite dev server modules, source code, and hot updates
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.jsx')
  ) {
    return;
  }

  // Intercept and cache Leaflet Map tiles (Carto, OpenStreetMap, MapTiler)
  const isTile = url.hostname.includes('basemaps.cartocdn.com') || 
                 url.hostname.includes('tile.openstreetmap.org') ||
                 url.hostname.includes('api.maptiler.com');

  const isCdn = url.hostname.includes('cdnjs.cloudflare.com') || 
                url.hostname.includes('fonts.googleapis.com') || 
                url.hostname.includes('fonts.gstatic.com');

  const isLocalAsset = url.origin === self.location.origin;

  // 1. Navigation / HTML requests - Network first with Offline SPA Cache Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // 2. Map Tiles - Cache First (critical for low internet & offline performance)
  if (isTile) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Fast-path: check exact match or query-independent match
        const exactMatch = (await cache.match(event.request)) || (await cache.match(event.request, { ignoreSearch: true }));
        if (exactMatch) {
          return exactMatch;
        }

        // Subdomain-agnostic match
        const targetPath = url.pathname;
        const allKeys = await cache.keys();
        const altKey = allKeys.find((k) => {
          try {
            return new URL(k.url).pathname === targetPath;
          } catch {
            return false;
          }
        });
        if (altKey) {
          const altMatch = await cache.match(altKey);
          if (altMatch) return altMatch;
        }

        // Fetch live tile from network reliably
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch (err) {
          // Allow network error to bubble to Leaflet so it can trigger tileerror fallback
          throw err;
        }
      })
    );
    return;
  }

  // 3. Static Assets & CDN libraries - Stale While Revalidate
  if (isCdn || isLocalAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              cache.put(event.request, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }
        const netRes = await networkFetch;
        return netRes || fetch(event.request);
      })
    );
  }
});

