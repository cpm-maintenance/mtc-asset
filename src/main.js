import './js/firebase-config.js';
import { app } from './js/app.js';
import './css/style.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Alpine from 'alpinejs';
import { componentLoader } from './js/utils/component-loader.js';
import { requestNotificationPermission, registerFCMToken, setupForegroundListener, checkAllNotifications, removeFCMToken, sendBrowserNotification, resetNotifBlocker } from './js/modules/notification.js';

// Sentry Error Tracking (Production only) — lazy import, 435KB gak dibundle kalo DSN kosong
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN && import.meta.env.PROD) {
  const Sentry = await import('@sentry/browser').then(m => {
    m.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.0,
      defaultIntegrations: false,
      autoSessionTracking: false,
      integrations: [],
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 0.0,
    });
    return m;
  });
  window.Sentry = {
    setUser: (u) => Sentry.setUser?.(u),
    captureException: (e, c) => Sentry.captureException?.(e, c),
    withScope: (cb) => Sentry.withScope?.(cb),
    setContext: (k, v) => Sentry.setContext?.(k, v),
  };
  console.log('[Sentry] Initialized, env:', import.meta.env.MODE);
} else {
  window.Sentry = {
    setUser: () => {},
    captureException: (e) => console.warn('[Sentry] Not available:', e),
    withScope: () => {},
    setContext: () => {},
  };
  if (!SENTRY_DSN) console.log('[Sentry] DSN not configured — skipping init. Set VITE_SENTRY_DSN in .env');
}

window.Alpine = Alpine;

// Create single instance
const appInstance = app();
window.app = appInstance;

// Register for Alpine
Alpine.data('app', () => appInstance);

// Add Alpine magic helper for page loading
Alpine.magic('loadPage', () => {
  return async (pageName, container) => {
    try {
      const html = await componentLoader.loadPage(pageName);
      if (container) {
        container.innerHTML = html;
      }
      return html;
    } catch (error) {
      console.error(`Failed to load page ${pageName}:`, error);
      return `<div class="text-red-500 p-4">Error loading page: ${pageName}</div>`;
    }
  };
});

// Add Alpine directive for dynamic page loading
Alpine.directive('page', (el, { expression }, { evaluateLater, effect }) => {
  const getPageName = evaluateLater(expression);
  
  effect(() => {
    getPageName(async (pageName) => {
      if (pageName) {
        try {
          const html = await componentLoader.loadPage(pageName);
          el.innerHTML = html;
          // CRITICAL: Tell Alpine to process the new DOM nodes
          // Without this, x-show, x-for, x-model, etc won't work
          Alpine.initTree(el);
        } catch (error) {
          console.error(`Failed to load page ${pageName}:`, error);
          el.innerHTML = `<div class="text-red-500 p-4">Error loading page: ${pageName}</div>`;
        }
      }
    });
  });
});

// Global debug
window.appState = appInstance;
window.componentLoader = componentLoader;

// Track the promise that resolves when Firebase initial data is loaded
let resolveFirebaseReady;
window._firebaseReady = new Promise(resolve => {
  resolveFirebaseReady = resolve;
});

// Expose resolver so data.js can call it after first load
window._firebaseReadyResolve = resolveFirebaseReady;

console.log('Alpine App Registered');
console.log('Component Loader Ready');

// Start Alpine immediately (AFTER registering everything)
Alpine.start();
console.log('Alpine Started');

// ============================================================
// Initialize FCM Push Notifications
// ============================================================
// Use a small delay to ensure Firebase listeners are ready
setTimeout(() => {
  // Only register FCM if permission already granted — don't auto-request (Chrome blocks from setTimeout)
  if (Notification.permission === 'granted') {
    registerFCMToken().then(token => {
      if (token) {
        console.log('[FCM] Registered, token:', token.substring(0, 20) + '...');
        setupForegroundListener();
      }
    });
  } else {
    console.log('[FCM] Permission not granted — skipping auto-register. Will register on user click.');
  }

  // Run initial check after data loads
  setTimeout(checkAllNotifications, 5000);

  // Periodic checks every 5 minutes
  setInterval(checkAllNotifications, 5 * 60 * 1000);
}, 2000);

// Expose Sentry for manual error capture from Alpine modules
window.Sentry = Sentry;

// Expose notification functions
window.notificationAPI = {
  requestNotificationPermission,
  registerFCMToken,
  checkAllNotifications,
  removeFCMToken,
  sendBrowserNotification,
  resetNotifBlocker,
};

// ============================================================
// Initialize Notifications
// ============================================================
setTimeout(() => {
  if (Notification.permission === 'granted') {
    registerFCMToken().then(token => {
      if (token) setupForegroundListener();
    });

    console.log('[Notif] Notification system initialized');
  } else if (Notification.permission === 'default') {
    console.log('[Notif] Permission not yet requested');
  } else {
    console.log('[Notif] Permission denied');
  }
}, 4000);

// ============================================================
// PWA Install Prompt
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  if (window.app) {
    window.app.installPromptEvent = e;
    window.app.showInstallButton = true;
  }
  console.log('[PWA] Install prompt available');
});

window.addEventListener('appinstalled', () => {
  if (window.app) {
    window.app.installPromptEvent = null;
    window.app.showInstallButton = false;
  }
  console.log('[PWA] App installed successfully');
});
