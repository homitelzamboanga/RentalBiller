// RentalRMS Service Worker v3.0
const CACHE_VERSION = '3.0';
const CACHE_NAME = `rentalrms-v${CACHE_VERSION}`;

// Added logic to cache the root and specific assets
const ASSETS = [
    './', 
    './index.html', 
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing version:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching core assets');
                return cache.addAll(ASSETS);
            })
            .then(() => {
                console.log('[SW] All assets cached');
                return self.skipWaiting();
            })
    );
});

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
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    // Only cache http/https requests
    if (!url.protocol.startsWith('http')) return;

    event.respondWith(
        // Network first strategy for HTML to get updates, cache first for assets
        fetch(request)
            .then((response) => {
                // If valid response, clone and cache
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    // If HTML request fails offline, serve index
                    if (request.mode === 'navigate') return caches.match('./index.html');
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});
