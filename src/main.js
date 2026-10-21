import './js/firebase-config.js';
import { app } from './js/app.js';
import './css/style.css';
import './css/tactical.css';
import './css/tactical-icons.css';
import Alpine from 'alpinejs';
import { componentLoader } from './js/utils/component-loader.js';
import { requestNotificationPermission, registerFCMToken, setupForegroundListener, checkAllNotifications, removeFCMToken, sendBrowserNotification, resetNotifBlocker } from './js/modules/notification.js';
import { logger } from './js/logger.js';

// Sentry Error Tracking (Production only) — lazy import, 435KB gak dibundle kalo DSN kosong.
//
// PENTING: dulu blok ini memakai `await import('@sentry/browser')` di TOP-LEVEL,
// jadi boot seluruh app tertahan sampai chunk Sentry (119 KB terkompresi)
// selesai diunduh — dan app tidak bisa boot sama sekali kalau chunk itu gagal.
// Sekarang: stub sinkron dipasang lebih dulu (error awal di-buffer), lalu Sentry
// dimuat setelah paint pertama supaya keluar dari jalur kritis.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
/** @type {any[][]} */
const sentryBacklog = [];
window.Sentry = {
  setUser: (u) => { sentryBacklog.push(['user', u]); },
  captureException: (e, c) => { sentryBacklog.push(['error', e, c]); },
  withScope: () => {},
  setContext: (k, v) => { sentryBacklog.push(['ctx', k, v]); },
  captureMessage: (msg, opts) => { sentryBacklog.push(['msg', msg, opts]); },
};

if (SENTRY_DSN && import.meta.env.PROD) {
  const initSentry = () => {
    import('@sentry/browser').then((m) => {
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
      window.Sentry = {
        setUser: (u) => m.setUser?.(u),
        captureException: (e, c) => m.captureException?.(e, c),
        withScope: (cb) => m.withScope?.(cb),
        setContext: (k, v) => m.setContext?.(k, v),
        captureMessage: (msg, opts) => m.captureMessage?.(msg, opts),
      };
      // Kirim ulang yang sempat tertampung saat Sentry belum siap.
      sentryBacklog.forEach(([kind, a, b]) => {
        try {
          if (kind === 'user') m.setUser?.(a);
          else if (kind === 'error') m.captureException?.(a, b);
          else if (kind === 'ctx') m.setContext?.(a, b);
          else if (kind === 'msg') m.captureMessage?.(a, b);
        } catch { /* telemetry tidak boleh menjatuhkan app */ }
      });
      sentryBacklog.length = 0;
      logger.debug('[Sentry] Initialized, env:', import.meta.env.MODE);
    }).catch((e) => logger.warn('[Sentry] Gagal dimuat:', e));
  };
  // Sentry bukan jalur kritis paint pertama: chunk `prod-*.js` (27 KiB) tidak
  // boleh ikut di muatan login. `requestIdleCallback(..., {timeout: 3000})` selalu
  // kalah cepat dari render halaman login mobile, jadi blok itu terukur selalu
  // terunduh. Dipicu interaksi pertama pengguna, plus jaring pengaman 30 s
  // supaya sesi pasif tetap mengirim telemetry.
  const SENTRY_TRIGGERS = ['pointerdown', 'keydown', 'touchstart'];
  let sentryArmed = false;
  const armSentry = () => {
    if (sentryArmed) return;
    sentryArmed = true;
    for (const ev of SENTRY_TRIGGERS) window.removeEventListener(ev, armSentry);
    initSentry();
  };
  for (const ev of SENTRY_TRIGGERS) window.addEventListener(ev, armSentry, { passive: true });
  setTimeout(armSentry, 30000);
} else if (!SENTRY_DSN) {
  logger.debug('[Sentry] DSN not configured — skipping init. Set VITE_SENTRY_DSN in .env');
}

// ============================================================
// RUM: Core Web Vitals → Sentry (production only, passive)
// ============================================================
if (import.meta.env.PROD && window.Sentry?.captureMessage) {
  try {
    const vitals = { lcp: 0, fid: 0, cls: 0, inp: 0, ttfb: 0 };
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const name = entry.name || entry.entryType;
        if (name === 'first-contentful-paint') vitals.fcp = entry.startTime;
        if (!vitals.lcp && entry.entryType === 'largest-contentful-paint') vitals.lcp = entry.startTime;
        if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) vitals.cls += entry.value;
        if (entry.entryType === 'event' && entry.processingEnd) {
          const delay = entry.processingEnd - entry.startTime;
          vitals.inp = Math.max(vitals.inp || 0, delay);
        }
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    observer.observe({ type: 'layout-shift', buffered: true });
    observer.observe({ type: 'first-contentful-paint', buffered: true });
    if (PerformanceObserver.supportedEntryTypes?.includes('event')) {
      observer.observe({ type: 'event', buffered: true });
    }
    // Report after page load settles
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) vitals.ttfb = nav.responseStart;
        window.Sentry.captureMessage('web-vitals', {
          level: 'info',
          extra: { ...vitals, url: location.pathname }
        });
      }, 3000);
    });
  } catch (e) {
    console.warn('[RUM] Vitals observer unavailable:', e);
  }
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

logger.debug('Alpine App Registered');
logger.debug('Component Loader Ready');

// Start Alpine immediately (AFTER registering everything)
Alpine.start();
logger.debug('Alpine Started');

// ============================================================
// Initialize FCM Push Notifications
// ============================================================
// Use a small delay to ensure Firebase listeners are ready
setTimeout(() => {
  // Only register FCM if permission already granted — don't auto-request (Chrome blocks from setTimeout)
  if (Notification.permission === 'granted') {
    registerFCMToken().then(token => {
      if (token) {
        logger.debug('[FCM] Registered, token:', token.substring(0, 20) + '...');
        setupForegroundListener();
      }
    });
  } else {
    logger.debug('[FCM] Permission not granted — skipping auto-register. Will register on user click.');
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
// PWA Install Prompt
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  if (window.app) {
    window.app.installPromptEvent = e;
    window.app.showInstallButton = true;
  }
  logger.debug('[PWA] Install prompt available');
});

window.addEventListener('appinstalled', () => {
  if (window.app) {
    window.app.installPromptEvent = null;
    window.app.showInstallButton = false;
  }
  logger.debug('[PWA] App installed successfully');
});
