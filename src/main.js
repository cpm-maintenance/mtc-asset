import './js/firebase-config.js';
import { app } from './js/app.js';
import './css/style.css';
import Alpine from 'alpinejs';
import { componentLoader } from './js/utils/component-loader.js';

// Sentry Error Tracking (Production only)
import * as Sentry from '@sentry/browser';
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE, // 'development' vs 'production'
    tracesSampleRate: import.meta.env.PROD ? 0.5 : 0.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
  console.log('[Sentry] Initialized, env:', import.meta.env.MODE);
} else {
  console.log('[Sentry] DSN not configured — skipping init. Set VITE_SENTRY_DSN in .env');
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

// Expose Sentry for manual error capture from Alpine modules
window.Sentry = Sentry;
