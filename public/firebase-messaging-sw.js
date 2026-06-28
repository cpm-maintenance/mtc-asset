/**
 * FCM Service Worker — Background push handling
 * 
 * This file MUST be in the root of the deployed site.
 * Firebase SDK is loaded via CDN using compat (not modular) because
 * service workers can't use ES module imports from node_modules.
 */
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

// Firebase config — values are injected at build time via env vars
const firebaseConfig = {
  apiKey: 'AIzaSyBCESkIsQCyaiNVGUKdZDA2jg-qr5-qRTo',
  authDomain: 'mtc-asset.firebaseapp.com',
  databaseURL: 'https://mtc-asset-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'mtc-asset',
  storageBucket: 'mtc-asset.appspot.com',
  messagingSenderId: '400206066339',
  appId: '1:400206066339:web:dd230c768d370dd74a4516',
  measurementId: 'G-XN3JFFEBZE'
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

/**
 * Handle background push messages (app not in focus)
 * When notification comes in background, this callback runs.
 * We can customize the notification before it's shown.
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message:', payload);

  const { notification, data } = payload;

  // Default notification from payload
  const title = notification?.title || 'MTC.NEXUS';
  const options = {
    body: notification?.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: data || {},
    tag: data?.tag || 'mtc-notification',
    // Action buttons
    actions: data?.actionUrl
      ? [{ action: 'open', title: '🔍 View Details' }]
      : [],
  };

  return self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.actionUrl || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if available
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new tab
        return clients.openWindow(urlToOpen);
      })
  );
});
