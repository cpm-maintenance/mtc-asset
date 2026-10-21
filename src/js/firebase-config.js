// @ts-check
/**
 * firebase-config.js — Window bridge for Alpine.js
 *
 * Hanya **Auth** yang dipasang eager di sini: layar login memakainya
 * (`window.signInWithEmailAndPassword`), jadi ia memang jalur kritis.
 *
 * Seluruh lapisan RTDB (`window.db`, `ref`, `get`, `onValue`, ...) sekarang
 * dimuat lewat `window.__loadDataLayer()` — satu impor dinamis ke
 * `data-layer.js` yang dipanggil `bootstrap.js` setelah `onAuthStateChanged`
 * memberi user. Sebelum login tidak satu pun pemanggil sah butuh `window.db`,
 * dan menahan SDK-nya (34 KiB gzip + parse) adalah inti perbaikan TBT S33p.
 *
 * Urutan penting: pemuatan ini WAJIB selesai sebelum kode yang memakai
 * `window.db` berjalan (listener RTDB, audit trail). Pemanggilnya satu:
 * `bootstrap.js` — setelah shell terpasang, sebelum `setupFirebaseListeners()`.
 */
import {
  app as firebaseApp,
  auth,
  signOut, onAuthStateChanged, signInWithEmailAndPassword,
  setPersistence, browserSessionPersistence, browserLocalPersistence, createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from './firebase-core.js';

window.firebaseApp = firebaseApp;
window.auth = auth;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.setPersistence = setPersistence;
window.browserSessionPersistence = browserSessionPersistence;
window.browserLocalPersistence = browserLocalPersistence;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.sendPasswordResetEmail = sendPasswordResetEmail;

/** @type {Promise<any>|null} */
let dataLayerPromise = null;

/**
 * Muat SDK Realtime Database + pasang helper-nya ke `window.*`.
 * Idempoten: pemanggilan kedua mengembalikan promise yang sama.
 * @returns {Promise<any>} modul data-layer
 */
window.__loadDataLayer = function loadDataLayer() {
  if (dataLayerPromise) return dataLayerPromise;
  dataLayerPromise = import('./data-layer.js')
    .then((m) => {
      window.db = m.db;
      window.ref = m.ref;
      window.onValue = m.onValue;
      window.onChildAdded = m.onChildAdded;
      window.set = m.set;
      window.update = m.update;
      window.remove = m.remove;
      window.get = m.get;
      window.query = m.query;
      window.limitToLast = m.limitToLast;
      window.runTransaction = m.runTransaction;
      window.orderByChild = m.orderByChild;
      window.endAt = m.endAt;
      window.equalTo = m.equalTo;
      window.endBefore = m.endBefore;
      return m;
    })
    .catch((err) => {
      dataLayerPromise = null; // izinkan percobaan ulang (offline sesaat)
      throw err;
    });
  return dataLayerPromise;
};

export { auth };
