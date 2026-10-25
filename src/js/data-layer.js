// @ts-check
/// <reference types="vite/client" />
/**
 * data-layer.js — SDK Realtime Database + seluruh helper-nya. CHUNK MALAS.
 *
 * Jangan impor berkas ini secara statis dari jalur login: begitu ada satu
 * `import ... from './data-layer.js'` statis, Vite menaruh SDK RTDB (~34 KiB
 * gzip) kembali ke muatan login dan TBT naik lagi. Pemuatnya satu-satunya:
 * `window.__loadDataLayer()` di `firebase-config.js`, dipanggil `bootstrap.js`
 * tepat setelah `onAuthStateChanged` memberi user.
 *
 * Modul lain tetap boleh `await import('./db.js')` (facade) — jalur itu malas
 * karena tidak ada yang mengimpor `db.js` secara statis lagi.
 * (Dikunci `tests/data-layer-lazy.test.js`.)
 */
import { getApp } from 'firebase/app'
import { connectDatabaseEmulator } from 'firebase/database'
import {
  getDatabase, ref, onValue, onChildAdded, onChildRemoved, set, update, remove,
  get, query, limitToLast, runTransaction,
  orderByChild, endAt, equalTo, endBefore
} from 'firebase/database'

const db = getDatabase(getApp())

if (import.meta.env.VITE_USE_EMULATORS === '1') {
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
}

export { db }
export { ref, onValue, onChildAdded, onChildRemoved, set, update, remove, get, query, limitToLast, runTransaction, orderByChild, endAt, equalTo, endBefore }
