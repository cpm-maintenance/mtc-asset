// @ts-check
/**
 * db.js — facade Firebase lama (App + Auth + Database).
 *
 * Dipecah di S33p: App+Auth di `firebase-core.js` (eager, dipakai layar login),
 * Database di `data-layer.js` (malas, dimuat setelah auth). Berkas ini tetap ada
 * supaya pemanggil lama tidak berubah — dan supaya jalurnya tetap MALAS:
 * tidak ada satu pun impor statis ke `db.js` di jalur login.
 */
export { app, auth } from './firebase-core.js'
export { signOut, onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, createUserWithEmailAndPassword, sendPasswordResetEmail } from './firebase-core.js'
export { db } from './data-layer.js'
export { ref, onValue, onChildAdded, set, update, remove, get, query, limitToLast, runTransaction, orderByChild, endAt, equalTo, endBefore } from './data-layer.js'
