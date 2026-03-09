// RentalRMS Service Worker v2.1
// IMPORTANT: Change CACHE_VERSION when deploying updates to force cache refresh
const CACHE_VERSION = '2.1';
const CACHE_NAME = `rentalrms-v${CACHE_VERSION}`;

// Core assets to cache
const ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// External CDN assets (cached separately for better update handling)
const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];

// Install Event: Cache core assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing version:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching core assets');
                // Cache local assets first
                return cache.addAll(ASSETS)
                    .then(() => {
                        // Try to cache CDN assets, but don't fail if they're unavailable
                        return Promise.allSettled(
                            CDN_ASSETS.map(url => 
                                fetch(url, { mode: 'cors' })
                                    .then(response => {
                                        if (response.ok) {
                                            return cache.put(url, response);
                                        }
                                    })
                                    .catch(() => console.log('[SW] Could not cache:', url))
                            )
                        );
                    });
            })
            .then(() => {
                console.log('[SW] All assets cached, skipping waiting');
                return self.skipWaiting();
            })
    );
});

// Activate Event: Cleanup old caches and take control
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating version:', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Claiming all clients');
            return self.clients.claim();
        })
    );
});

// Fetch Event: Network-First Strategy with Cache Fallback
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) return;
    
    event.respondWith(
        fetch(request)
            .then((response) => {
                // If network fetch is successful, update the cache
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // If offline, try to serve from cache
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // If it's a navigation request and we don't have it cached,
                    // return the cached index.html (for SPA routing)
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    
                    // Return a simple offline response for other requests
                    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                });
            })
    );
});

// Message Event: Listen for skip waiting command
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        console.log('[SW] Skip waiting requested');
        self.skipWaiting();
    }
});
