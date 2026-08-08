/**
 * db.js — Centralized Firebase singleton
 * Single source of truth for all Firebase instances & functions.
 * Module lain WAJIB import dari sini, bukan dari window.*
 */
import { initializeApp } from 'firebase/app'
import {
  getDatabase, ref, onValue, onChildAdded, set, update, remove,
  get, query, limitToLast, runTransaction,
  orderByChild, endAt, equalTo, endBefore
} from 'firebase/database'
import { getStorage, ref as refStorage, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  getAuth, signOut, onAuthStateChanged,
  signInWithEmailAndPassword, setPersistence,
  browserSessionPersistence, createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

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
const storage = getStorage(app)
const auth = getAuth(app)
const messaging = getMessaging(app)

export { app }
export { db }
export { storage }
export { auth }
export { messaging }
// DB functions
export { ref, onValue, onChildAdded, set, update, remove, get, query, limitToLast, runTransaction, orderByChild, endAt, equalTo, endBefore }
// Storage functions
export { refStorage, uploadBytes, getDownloadURL }
// Auth functions
export { signOut, onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, createUserWithEmailAndPassword, sendPasswordResetEmail }
// Messaging functions
export { getToken, onMessage }
