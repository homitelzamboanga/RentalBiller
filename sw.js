// RentalRMS Service Worker v2.0
const CACHE_VERSION = '2.0';
const CACHE_NAME = `rentalrms-v${CACHE_VERSION}`;

const ASSETS = ['./', './index.html', './manifest.json'];

const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing version:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching core assets');
                return cache.addAll(ASSETS)
                    .then(() => {
                        return Promise.allSettled(
                            CDN_ASSETS.map(url => 
                                fetch(url, { mode: 'cors' })
                                    .then(response => {
                                        if (response.ok) return cache.put(url, response);
                                    })
                                    .catch(() => console.log('[SW] Could not cache:', url))
                            )
                        );
                    });
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
    if (!url.protocol.startsWith('http')) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (request.mode === 'navigate') return caches.match('./index.html');
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// FIXED: Listen for both 'skipWaiting' string and {action: 'skipWaiting'} object
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    // Handle string message (old format)
    if (event.data === 'skipWaiting') {
        console.log('[SW] Skip waiting via string message');
        self.skipWaiting();
        return;
    }

    // Handle object message (new format from main.js)
    if (event.data && event.data.action === 'skipWaiting') {
        console.log('[SW] Skip waiting via action message');
        self.skipWaiting();
        return;
    }

    // Handle SKIP_WAITING type (Workbox format)
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skip waiting via SKIP_WAITING type');
        self.skipWaiting();
        return;
    }
});
