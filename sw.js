// RentalRMS Service Worker v3.6.0
// Includes: Property Groups, Past Rentals, Custom rates, analytics, calendar, payment tracking
const CACHE_VERSION = '3.6.0';
const CACHE_NAME = `rentalrms-v${CACHE_VERSION}`;

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install - cache assets and force activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - purge ALL old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - network first for everything, cache fallback offline
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
          if (request.mode === 'navigate') return caches.match('/');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// Message - handle skip waiting from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-payments') {
    console.log('[SW] Syncing pending payments...');
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'RentalRMS', {
        body: data.body || 'New notification from RentalRMS',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' }
      })
    );
  }
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(event.notification.data.url);
      })
  );
});
