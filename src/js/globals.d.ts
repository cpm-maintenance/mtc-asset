/**
 * @file Ambient declarations untuk migrasi TypeScript bertahap.
 *
 * Mendeklarasikan global browser yang di-set runtime oleh app (mis. via
 * firebase-config.js & Alpine init) supaya file ber-`// @ts-check` tidak
 * error TS2339 saat mengakses `window.app`, `window.appState`, dll.
 */

import type { AppState } from './appstate';

export {};

declare global {
  const Cropper: any;
  interface Window {
    /** API notifikasi (di-set notification module). */
    notificationAPI?: any;
    /** Alpine global (CDN bundle, dipakai window.Alpine.raw). */
    Alpine?: any;
    /** Chart.js constructor hasil lazy-import (di-set charts.js). */
    _chartJS?: any;
    /** Registry instance chart dashboard (di-set charts.js/bootstrap.js). */
    _appCharts: any;
    /** Registry instance chart KPI (di-set charts.js/bootstrap.js). */
    _appKpiCharts: any;
    /** Alpine root component (di-set di bootstrap). */
    app?: AppState;
    /** Alias state global (fallback lama). */
    appState?: AppState;
    /** Modul audit (di-set oleh audit.js). */
    auditModule?: any;
    /** Hook re-init Lucide icons. */
    __initLucide?: () => void;
    /** OneSignal deferred queue + SDK (v16). */
    OneSignalDeferred?: any[];
    OneSignal?: any;
    /** Singleton ComponentLoader (di-set component-loader.js). */
    componentLoader?: any;
    /** Sentry global (CDN). */
    Sentry?: any;
    /** Firebase globals (di-set oleh firebase-config.js). */
    db?: any;
    storage?: any;
    auth?: any;
    messaging?: any;
    ref?: any;
    refStorage?: any;
    uploadBytes?: any;
    getDownloadURL?: any;
    onValue?: any;
    onChildAdded?: any;
    set?: any;
    update?: any;
    remove?: any;
    get?: any;
    query?: any;
    limitToLast?: any;
    runTransaction?: any;
    orderByChild?: any;
    endAt?: any;
    equalTo?: any;
    endBefore?: any;
    signOut?: any;
    onAuthStateChanged?: any;
    signInWithEmailAndPassword?: any;
    setPersistence?: any;
    browserSessionPersistence?: any;
    createUserWithEmailAndPassword?: any;
    /** Resolver promise `_firebaseReady` (di-set main.js). */
    _firebaseReadyResolve?: (() => void) | null;
    /** Firebase Auth helper (CDN, di-set firebase-config.js). */
    sendPasswordResetEmail?: any;
    /** Modul export global (di-set export.js / fallback). */
    exportModule?: any;
    exportHistoryFallback?: () => void;
    /** CropperJS (lazy CDN). */
    Cropper?: any;
  }
}
