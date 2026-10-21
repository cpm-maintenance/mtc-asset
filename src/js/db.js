// @ts-check
/// <reference types="vite/client" />
/**
 * db.js — Centralized Firebase singleton
 * Single source of truth for all Firebase instances & functions.
 * Module lain WAJIB import dari sini, bukan dari window.*
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator } from 'firebase/auth'
import { connectDatabaseEmulator } from 'firebase/database'
import {
  getDatabase, ref, onValue, onChildAdded, set, update, remove,
  get, query, limitToLast, runTransaction,
  orderByChild, endAt, equalTo, endBefore
} from 'firebase/database'
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
const db = getDatabase(app)
// `getAuth()` menyertakan `popupRedirectResolver` di dependensi default. Di browser
// mobile resolver itu menginisialisasi iframe `__/auth/iframe` + `apis.google.com/js/api.js`
// (93 + 35 KB, ~3,6 s) saat boot — padahal belum ada tombol SSO yang ditekan.
// `initializeAuth` hanya mendaftarkan persistensi; resolver diambil di jalur SSO
// (`loginWithSSO`) sebagai argumen ketiga `signInWithPopup`.
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
})

// E2E: pakai Firebase Emulator (auth + database) supaya tes tidak menyentuh produksi
// dan tidak butuh kredensial asli. Aktif hanya bila VITE_USE_EMULATORS=1.
if (import.meta.env.VITE_USE_EMULATORS === '1') {
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

export { app }
export { db }
export { auth }
// DB functions
export { ref, onValue, onChildAdded, set, update, remove, get, query, limitToLast, runTransaction, orderByChild, endAt, equalTo, endBefore }
// Auth functions
export { signOut, onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, createUserWithEmailAndPassword, sendPasswordResetEmail }

