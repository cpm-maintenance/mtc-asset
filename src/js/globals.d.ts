/**
 * @file Ambient declarations untuk migrasi TypeScript bertahap.
 *
 * Mendeklarasikan global browser yang di-set runtime oleh app (mis. via
 * firebase-config.js & Alpine init) supaya file ber-`// @ts-check` tidak
 * error TS2339 saat mengakses `window.app`, `window.appState`, dll.
 */

export {};

declare global {
  interface Window {
    /** Alpine root component (di-set di bootstrap). */
    app?: any;
    /** Alias state global (fallback lama). */
    appState?: any;
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
  }
}
