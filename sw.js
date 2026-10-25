// MTC-ASSET Service Worker — custom (strategi injectManifest via vite-plugin-pwa)
// No OneSignal — app uses FCM directly via Firebase Messaging

// Nama cache menyertakan brand + versi rilis. Naikkan angka versi saat rilis
// besar supaya cache lama dibuang bersih di handler 'activate'.
const CACHE_NAME = 'mtc-asset-v57';

// Halaman fallback terakhir saat navigasi offline dan app shell pun tidak ada
// di cache. Wajib SELF-CONTAINED (tanpa CDN) — kalau tidak, halaman ini sendiri
// gagal dirender saat offline. Lihat public/offline.html.
const OFFLINE_URL = '/offline.html';

// ============================================================
// CATATAN AUDIT (Q-2) — kenapa Firebase RTDB TIDAK di-cache di SW ini
// ============================================================
// Data RTDB tidak lewat `fetch()`: SDK memakai WebSocket (wss://) + long-polling
// XHR ke `*.firebasedatabase.app`, jadi handler `fetch` di sini TIDAK PERNAH
// menerimanya — menambahkan `caches.match` untuk RTDB hanya akan jadi dead code.
// Yang lebih penting: RTDB **sudah** offline-capable di sisi SDK — data yang
// pernah tersinkron disimpan otomatis di IndexedDB (~10 MB, LRU), dan setiap
// write saat offline diantre lalu dikirim ulang setelah reconnect. Catatan:
// `enableIndexedDbPersistence()` itu API **Firestore**, bukan RTDB; pada SDK web
// modular v9+ (repo ini pakai firebase 12) tidak ada opt-in untuk RTDB karena
// persistence-nya memang otomatis.
// Jadi jangan tambahkan aturan runtime cache untuk firebase di file ini. Yang
// benar: andalkan SDK + indikator `isOnline` aplikasi (dari `/.info/connected`).
// ============================================================

// Aset build ber-hash: /assets/**, /fonts/**, /icons/**.
const HASHED_ASSET = /^\/(assets|fonts|icons)\//;

// vite-plugin-pwa mengganti `self.__WB_MANIFEST` dengan daftar aset hasil build
// (HTML, components, icons, dan SELURUH bundle JS/CSS). Dulu nilai ini hanya
// ditulis sebagai statement kosong sehingga dibuang — akibatnya bundle tidak
// pernah ter-precache dan aplikasi blank saat offline.
const WB_MANIFEST = self.__WB_MANIFEST || [];
const WB_URLS = WB_MANIFEST.map((entry) => (typeof entry === 'string' ? entry : entry.url));

// App shell wajib + seluruh aset build, tanpa duplikat.
const PRECACHE_ASSETS = Array.from(new Set([
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  ...WB_URLS,
]));

// Install — precache tahan-banting: satu aset gagal (mis. 404) tidak
// membatalkan seluruh instalasi service worker.
// `cache: 'reload'` WAJIB: tanpa itu `cache.add()` boleh dilayani HTTP cache
// browser sehingga fragment basi (mis. /pages/*.html) ikut ter-precache.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
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

// Fetch Strategy: Network First — cache fallback for app, stale-while-revalidate for CDN
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Cache CDN assets (CropperJS) with stale-while-revalidate
  if (url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchAndCache = fetch(event.request).then((response) => {
          // Clone synchronously: the nested .then may run after the page has consumed the body.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        });
        return cached || fetchAndCache;
      })
    );
    return;
  }

  // Page fragments (component-loader /pages/**) — network-first, cache fallback.
  // `cache: 'no-store'` wajib: fragment tidak punya hash di nama file, jadi
  // respons HTTP cache (max-age) bisa mengembalikan versi basi → UI tidak
  // berubah walau sudah deploy. Header /pages/** di firebase.json juga no-cache.
  if (url.includes('/pages/') && url.endsWith('.html')) {
    const OFFLINE = new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return fetch(event.request, { cache: 'no-store' }).then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => cached || OFFLINE);
      })
    );
    return;
  }

  // Aset build ber-hash (/assets/**, /fonts/**, /icons/**) — CACHE-FIRST.
  // Nama berkasnya mengandung hash konten dan semuanya sudah di-precache, jadi
  // menariknya lewat jaringan setiap kali hanya membuang bandwidth di link
  // tambang yang putus-nyambung. Cache miss (mis. chunk lazy yang baru dipakai
  // setelah deploy baru) tetap jatuh ke jaringan seperti biasa.
  if (HASHED_ASSET.test(new URL(url).pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // Default: network first for app routes
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        // Navigasi: app shell dulu, baru halaman offline.
        // CATATAN: rantai ini WAJIB berurutan lewat .then() — menulis
        // `caches.match('/index.html') || caches.match('/')` salah, karena
        // promise selalu truthy sehingga cabang kedua tidak pernah dievaluasi
        // dan navigasi bisa berakhir tanpa respons.
        if (event.request.mode === 'navigate') {
          return caches
            .match('/index.html')
            .then((shell) => shell || caches.match('/'))
            .then((shell) => shell || caches.match(OFFLINE_URL))
            .then(
              (page) =>
                page ||
                new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
            );
        }
        return new Response('', { status: 404, statusText: 'Not Found' });
      });
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
