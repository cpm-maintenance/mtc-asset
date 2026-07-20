// OneSignal SW must be imported FIRST for background push to work
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'goldtrack-v2';
// self.__WB_MANIFEST will be replaced by workbox with the precache manifest
self.__WB_MANIFEST;
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate & Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Strategy: Network First (Fixes update issues)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// ============================================================
// FCM Background Push — notif muncul walau app tertutup
// ============================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    // Data-only FCM payload (reliable on mobile)
    const payload = event.data.json();
    const data = payload.data || payload || {};

    const title = data.title || 'MTC.Asset';
    const options = {
      body: data.body || '',
      icon: data.icon || '/logo.png',
      badge: data.badge || '/logo.png',
      vibrate: data.vibrate ? JSON.parse(data.vibrate) : [200, 100, 200],
      requireInteraction: data.requireInteraction !== 'false',
      tag: data.tag || 'mtc-push',
      data: {
        url: data.clickAction || '/',
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('[SW Push] Error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
