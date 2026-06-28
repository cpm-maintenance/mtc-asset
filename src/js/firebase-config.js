import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update, remove, get, query, limitToLast, runTransaction, orderByChild, endAt, equalTo, endBefore } from "firebase/database";
import { getStorage, ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signOut, onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, createUserWithEmailAndPassword } from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const appFirebase = initializeApp(firebaseConfig);
const db = getDatabase(appFirebase);
const storage = getStorage(appFirebase);
const auth = getAuth(appFirebase);

const messaging = getMessaging(appFirebase);

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
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;

export { db, storage, auth };
