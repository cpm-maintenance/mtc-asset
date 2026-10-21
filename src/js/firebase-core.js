// @ts-check
/// <reference types="vite/client" />
/**
 * firebase-core.js — Firebase App + Auth saja: cukup untuk layar login.
 *
 * Dulu berkas ini satu dengan lapisan database (`db.js`). Pisahan ini alasan
 * performanya: SDK `firebase/database` (~34 KiB gzip) tidak dipakai sebelum
 * login, tapi ikut di-parse+execute di jalur login. Terukur terhadap produksi
 * (Lighthouse `--throttling-method=devtools`, `--blocked-url-patterns='*db-*'`):
 * memblokir chunk itu memotong main-thread 1318 -> 555 ms dan TBT 349 -> 0 ms.
 * Auth tetap eager (tombol login butuh), database jadi chunk malas
 * (`data-layer.js`, dimuat `window.__loadDataLayer()` setelah auth).
 *
 * `getAuth()` menyertakan `popupRedirectResolver` di dependensi default. Di browser
 * mobile resolver itu menginisialisasi iframe `__/auth/iframe` + `apis.google.com/js/api.js`
 * (93 + 35 KB, ~3,6 s) saat boot — padahal belum ada tombol SSO yang ditekan.
 * `initializeAuth` hanya mendaftarkan persistensi; resolver diambil di jalur SSO
 * (`loginWithSSO`) sebagai argumen ketiga `signInWithPopup`.
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator } from 'firebase/auth'
import {
  initializeAuth, indexedDBLocalPersistence, inMemoryPersistence,
  signOut, onAuthStateChanged,
  signInWithEmailAndPassword, setPersistence,
  browserSessionPersistence, browserLocalPersistence, createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
})

// E2E: pakai Firebase Emulator supaya tes tidak menyentuh produksi.
if (import.meta.env.VITE_USE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

export { app }
export { auth }
export { firebaseConfig }
export { signOut, onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, createUserWithEmailAndPassword, sendPasswordResetEmail }
