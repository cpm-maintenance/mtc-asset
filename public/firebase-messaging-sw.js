/**
 * FCM Service Worker — Background push handling
 * 
 * This file MUST be in the root of the deployed site.
 * Firebase SDK is loaded via CDN using compat (not modular) because
 * service workers can't use ES module imports from node_modules.
 */
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

// Firebase config — values are injected at build time from env vars by the
// `inject-firebase-messaging-sw` Vite plugin (see vite.config.js).
// Do NOT hardcode real credentials here; keep the __PLACEHOLDER__ tokens.
const firebaseConfig = {
  apiKey: '__FIREBASE_API_KEY__',
  authDomain: '__FIREBASE_AUTH_DOMAIN__',
  databaseURL: '__FIREBASE_DATABASE_URL__',
  projectId: '__FIREBASE_PROJECT_ID__',
  storageBucket: '__FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__FIREBASE_APP_ID__',
  measurementId: '__FIREBASE_MEASUREMENT_ID__'
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
