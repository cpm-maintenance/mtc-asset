// @ts-check
/**
 * firebase-config.js — Window bridge for Alpine.js
 * Imports centralized Firebase singleton from db.js and exposes instances & helpers to window.*
 */
import {
  db, storage, auth, messaging,
  ref, refStorage, uploadBytes, getDownloadURL,
  onValue, onChildAdded, set, update, remove,
  get, query, limitToLast, runTransaction,
  orderByChild, endAt, equalTo, endBefore,
  signOut, onAuthStateChanged, signInWithEmailAndPassword,
  setPersistence, browserSessionPersistence, browserLocalPersistence, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail
} from './db.js';

// Expose Firebase functions to global window for Alpine.js
window.db = db;
window.storage = storage;
window.auth = auth;
window.messaging = messaging;
window.ref = ref;
window.refStorage = refStorage;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;
window.onValue = onValue;
window.onChildAdded = onChildAdded;
window.set = set;
window.update = update;
window.remove = remove;
window.get = get;
window.query = query;
window.limitToLast = limitToLast;
window.runTransaction = runTransaction;
window.orderByChild = orderByChild;
window.endAt = endAt;
window.equalTo = equalTo;
window.endBefore = endBefore;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.setPersistence = setPersistence;
window.browserSessionPersistence = browserSessionPersistence;
window.browserLocalPersistence = browserLocalPersistence;
window.GoogleAuthProvider = GoogleAuthProvider;
window.signInWithPopup = signInWithPopup;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.sendPasswordResetEmail = sendPasswordResetEmail;

export { db, storage, auth };
