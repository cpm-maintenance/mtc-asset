import './js/firebase-config.js';
import { createLoginScreen } from './js/modules/login.js';
import './css/fonts.css';
import './css/style.css';
import './css/tactical.css';
import './css/tactical-icons.css';
import Alpine from 'alpinejs';
import { componentLoader } from './js/utils/component-loader.js';
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

// ============================================================
// Reaktivitas: selalu ekspos PROXY, jangan objek mentah
// ============================================================
// `Alpine.data(name, () => objek)` membuat proxy sendiri, jadi menulis
// `objek.isLoading = false` dari `main.js` mengubah objek mentah tanpa
// men-trigger efek: `:disabled="isLoading"` tertinggal di nilai lama dan tombol
// login mati walau state-nya benar. Bungkus sekali di sini, ekspos proxy-nya.
const react = (o) => (typeof Alpine.reactive === 'function' ? Alpine.reactive(o) : o);

// --- Layar login (eager) ---
// Chunk `app-*.js` dimuat malas, jadi layar login butuh komponennya sendiri.
// Isinya di-spread dari `auth.js`/`ui.js` — modul yang sama dengan `app()`.
const loginScreen = react(createLoginScreen());
window.__loginScreen = loginScreen;
window.app = loginScreen; // diganti instance app begitu chunk malas terpasang
Alpine.data('login', () => loginScreen);

// --- Chunk aplikasi (malas) ---
/** @type {Promise<any>|null} */
let appPromise = null;
/**
 * Muat `app.js` + 13 mixin + `bootstrap.js` sebagai chunk terpisah, sekali saja.
 * Idempoten seperti `window.__loadDataLayer()`.
 * @returns {Promise<any>} instance app (proxy reaktif)
 */
window.__loadApp = () => {
  if (appPromise) return appPromise;
  appPromise = import('./js/app.js')
    .then(({ app }) => {
      const instance = react(app());
      window.app = instance;
      window.appState = instance;
      // WAJIB terdaftar sebelum `Alpine.initTree(host)`: fragmen shell membawa
      // wrapper `<div x-data="app()">`, dan `Alpine.data` harus sudah ada saat
      // wrapper itu diproses.
      Alpine.data('app', () => instance);
      // Toast stack tinggal di index.html (scope `login()`), sedangkan
      // `showNotification()` pasca-login dipanggil dari instance app. Satu larik
      // untuk keduanya, kalau tidak toast berhenti tampil setelah login.
      // `ui.js` menghapus entri dengan `splice()` supaya referensi ini tidak putus.
      loginScreen.notifications = instance.notifications;
      // `beforeinstallprompt` bisa sudah terpicu sebelum chunk ini selesai.
      if (window.__installPromptEvent) {
        instance.installPromptEvent = window.__installPromptEvent;
        instance.showInstallButton = true;
      }
      logger.debug('[app] chunk aplikasi terpasang');
      return instance;
    })
    .catch((err) => {
      appPromise = null; // izinkan percobaan ulang (mis. offline sesaat)
      logger.warn('[app] gagal memuat chunk aplikasi:', err);
      throw err;
    });
  return appPromise;
};

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

// ============================================================
// Notifikasi (FCM + sapuan periodik) — dimuat MALAS, pasca-auth
// ============================================================
// `notification.js` = 8,1 KiB gzip dan tidak melakukan apa pun yang berguna
// sebelum ada user, tapi dulu ia ikut `modulepreload` di layar login (13,5% dari
// seluruh muatan login). `firebase/messaging` di dalamnya sudah impor dinamis,
// jadi yang dikeluarkan di sini memang logika modulnya, bukan SDK-nya.
/** @type {Promise<any>|null} */
let notificationsPromise = null;
/**
 * Muat modul notifikasi sekali, isi `window.notificationAPI`, lalu arm FCM.
 * Idempoten seperti `window.__loadDataLayer()`.
 * @returns {Promise<any>}
 */
window.__loadNotifications = () => {
  if (notificationsPromise) return notificationsPromise;
  notificationsPromise = import('./js/modules/notification.js')
    .then((m) => {
      // Dipakai `bootstrap.onUser()` (sapuan notifikasi) dan tombol di fragmen
      // shell — keduanya baru hidup setelah login.
      window.notificationAPI = {
        requestNotificationPermission: m.requestNotificationPermission,
        registerFCMToken: m.registerFCMToken,
        checkAllNotifications: m.checkAllNotifications,
        removeFCMToken: m.removeFCMToken,
        sendBrowserNotification: m.sendBrowserNotification,
        resetNotifBlocker: m.resetNotifBlocker,
      };
      armNotifications(m);
      return m;
    })
    .catch((err) => {
      notificationsPromise = null; // izinkan percobaan ulang (mis. offline sesaat)
      logger.warn('[notif] gagal memuat modul notifikasi:', err);
      throw err;
    });
  return notificationsPromise;
};

/**
 * Daftar FCM + jadwalkan sapuan periodik. Dipanggil sekali, setelah modul
 * termuat — bukan lagi saat boot layar login.
 * @param {any} m modul `notification.js`
 */
function armNotifications(m) {
  // Jeda kecil supaya listener Firebase lain sempat terpasang lebih dulu.
  setTimeout(() => {
    // Hanya daftar kalau izin SUDAH diberikan — jangan meminta izin dari
    // setTimeout (Chrome memblokir permintaan izin di luar gestur pengguna).
    if (Notification.permission === 'granted') {
      m.registerFCMToken().then((token) => {
        if (token) {
          logger.debug('[FCM] Registered, token:', token.substring(0, 20) + '...');
          m.setupForegroundListener();
        }
      });
    } else {
      logger.debug('[FCM] Permission not granted — skipping auto-register. Will register on user click.');
    }

    // Sapuan pertama tetap milik `bootstrap.onUser()`; di sini hanya periodiknya,
    // supaya tidak ada dua sapuan yang jalan berdekatan.
    setInterval(m.checkAllNotifications, 5 * 60 * 1000);
  }, 2000);
}

// ============================================================
// App shell — sidebar/main/footer/modal dimuat sebagai fragmen
// ============================================================
// index.html sengaja hanya membawa layar login (+ toast stack): 128 KB markup
// shell aplikasi tidak ikut diparse/di-style/di-layout sebelum paint pertama.
// Fragmen diambil sekali, di-inject ke placeholder `#app-shell`, lalu di-init
// dengan `Alpine.initTree()` supaya x-show/x-for/x-page di dalamnya hidup.
const APP_SHELL_URL = '/pages/app-shell.html';
/** Teks fragmen, diambil sekali. */
let shellHtml = null;
/** @type {Promise<string>|null} */
let shellFetch = null;
/** @type {Promise<void>|null} */
let shellInit = null;

/** Ambil fragmen (tanpa menyalin ke DOM). Aman dipanggil sebagai prefetch. */
function fetchAppShell() {
  if (shellFetch) return shellFetch;
  shellFetch = fetch(APP_SHELL_URL, { credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${APP_SHELL_URL}`);
      return res.text();
    })
    .then((html) => {
      shellHtml = html;
      return html;
    })
    .catch((err) => {
      shellFetch = null; // izinkan percobaan ulang (mis. offline sesaat)
      logger.warn('[shell] gagal memuat app shell:', err);
      throw err;
    });
  return shellFetch;
}

/**
 * Pasang fragmen ke `#app-shell` lalu init dengan `Alpine.initTree()`.
 *
 * JANGAN dipanggil sebelum `window.__loadApp()`: fragmen membawa wrapper
 * `<div x-data="app()">`, dan `Alpine.data('app')` baru terdaftar setelah chunk
 * aplikasi selesai dimuat. Prefetch cukup `fetchAppShell()`.
 */
window.__loadAppShell = () => {
  if (shellInit) return shellInit;
  shellInit = (async () => {
    const html = shellHtml || (await fetchAppShell());
    const host = document.getElementById('app-shell');
    if (!host) throw new Error('placeholder #app-shell tidak ditemukan');
    if (host.dataset.loaded) return;
    // Aman: fragmen statis same-origin dari build kita sendiri
    // (`public/pages/app-shell.html`), bukan masukan pengguna. Pola yang sama
    // dipakai `componentLoader.loadPage()` untuk /pages/*.html.
    host.innerHTML = html;
    host.dataset.loaded = '1';
    Alpine.initTree(host);
    logger.debug('[shell] app shell terpasang');
  })().catch((err) => {
    shellInit = null; // izinkan percobaan ulang
    logger.warn('[shell] gagal memasang app shell:', err);
    throw err;
  });
  return shellInit;
};

// Prefetch saat interaksi pertama: kunjungan pasif ke layar login tidak
// membayar 128 KB ini, tapi sesi yang benar-benar login sudah punya cache-nya.
// Hanya teks fragmen yang diambil — `initTree` menunggu chunk `app-*.js`.
const SHELL_TRIGGERS = ['pointerdown', 'keydown', 'touchstart', 'focusin'];
const prefetchAppShell = () => {
  for (const ev of SHELL_TRIGGERS) window.removeEventListener(ev, prefetchAppShell);
  fetchAppShell().catch(() => {});
};
for (const ev of SHELL_TRIGGERS) window.addEventListener(ev, prefetchAppShell, { passive: true });

// ============================================================
// Gate auth — satu-satunya pemilik urutan boot pasca-login
// ============================================================
// Listener ini tinggal di sini, bukan di `bootstrap.js`, karena `bootstrap.js`
// ikut chunk `app-*.js` yang malas: listener yang tinggal di sana tidak akan
// pernah terpasang pada layar login. Urutannya wajib dan tidak boleh ditukar:
//   lapisan data → chunk app → fragmen shell (+ initTree) → onUser → gate.
// `initTree` harus selesai SEBELUM `isLoggedIn` dibuka (pelajaran S33m): kalau
// gate dibuka lebih dulu, `x-page` belum punya target dan shell tampil kosong.
window.onAuthStateChanged(window.auth, async (/** @type {any} */ user) => {
  if (!user) {
    loginScreen.isLoggedIn = false;
    loginScreen.user = null;
    loginScreen.isLoading = false;
    // Sesi berakhir setelah app pernah termuat (logout): tutup juga shell.
    if (window.app && window.app !== loginScreen) {
      window.app.isLoggedIn = false;
      window.app.user = null;
      window.app.isLoading = false;
    }
    return;
  }

  try {
    // SDK RTDB tidak ikut muatan login (S33p) — pasang sebelum consumer pertama.
    if (typeof window.__loadDataLayer === 'function') {
      await window.__loadDataLayer();
    }
    const instance = await window.__loadApp();
    await window.__loadAppShell();
    // Pekerjaan pasca-auth milik bootstrap.js (checkUserRole, listener RTDB,
    // AI settings, PM schedule, requisitions, sapuan notifikasi).
    if (typeof instance.onUser === 'function') {
      await instance.onUser(user);
    }
    // Gate dibuka paling akhir — setelah shell ter-init.
    loginScreen.isLoggedIn = true;
    loginScreen.user = user;
    loginScreen.isLoading = false;
  } catch (err) {
    logger.warn('[auth] boot pasca-login gagal:', err);
    loginScreen.isLoading = false;
  }
});

// Start Alpine immediately (AFTER registering everything)
Alpine.start();
logger.debug('Alpine Started');

// ============================================================
// PWA Install Prompt
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  // Disimpan juga di window: event ini biasanya terpicu sebelum chunk `app-*.js`
  // selesai dimuat, dan `__loadApp()` memindahkannya ke instance app.
  window.__installPromptEvent = e;
  if (window.app) {
    window.app.installPromptEvent = e;
    window.app.showInstallButton = true;
  }
  logger.debug('[PWA] Install prompt available');
});

window.addEventListener('appinstalled', () => {
  window.__installPromptEvent = null;
  if (window.app) {
    window.app.installPromptEvent = null;
    window.app.showInstallButton = false;
  }
  logger.debug('[PWA] App installed successfully');
});
