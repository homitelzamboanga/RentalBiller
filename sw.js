// RentalRMS Service Worker v3.8.0
// Native App Experience, Rate Logic with Add-Ons & Calculator
const CACHE_VERSION = '3.8.0';
const CACHE_NAME = `rentalrms-v${CACHE_VERSION}`;

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

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
          caches.open(CACHE_NAME).then((cache) => { cache.put(request, responseClone); });
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') { self.skipWaiting(); }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-payments') { console.log('[SW] Syncing pending payments...'); }
});

self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'RentalRMS', {
        body: data.body || 'New notification from RentalRMS',
        icon: '/icon-192.png', badge: '/icon-192.png',
        vibrate: [100, 50, 100], data: { url: data.url || '/' }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(event.notification.data.url);
      })
  );
});
