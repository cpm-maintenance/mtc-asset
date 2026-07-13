/**
 * OneSignal — Web Push Notification Module
 * 
 * Handles:
 * 1. OneSignal SDK init + registration (subscribes device)
 * 2. Trigger push via webhook proxy (keeps API key server-side)
 */
const ONE_SIGNAL_APP_ID = '08770479-20e7-4414-8f10-abe1c1240bf7';

// Webhook proxy — deploy sendiri (lihat /onesignal-server/)
const PUSH_PROXY_URL = import.meta.env.VITE_PUSH_PROXY_URL || 'http://localhost:4000/push';

let _onesignalReady = false;
let _onesignalInitPromise = null;

/**
 * Init OneSignal SDK — call once after login
 */
export async function initOneSignal() {
  if (_onesignalInitPromise) return _onesignalInitPromise;
  if (typeof window === 'undefined') return false;

  _onesignalInitPromise = new Promise(async (resolve) => {
    try {
      // Load OneSignal SDK
      if (!window.OneSignal) {
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.defer = true;
        document.head.appendChild(script);
        await new Promise((r) => { script.onload = r; });
      }

      // Init
      await window.OneSignal.Deferred.setup({
        appId: ONE_SIGNAL_APP_ID,
        notifyButton: { enable: false },
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
      });

      _onesignalReady = true;
      console.log('[OneSignal] Initialized');
      resolve(true);
    } catch (e) {
      console.warn('[OneSignal] Init error:', e.message);
      resolve(false);
    }
  });
  return _onesignalInitPromise;
}

/**
 * Get OneSignal user ID (player ID) — returns null if not subscribed
 */
export async function getOneSignalUserId() {
  if (!_onesignalReady) await initOneSignal();
  try {
    const userId = await window.OneSignal.User.getOnesignalId();
    return userId || null;
  } catch {
    return null;
  }
}

/**
 * Subscribe user to push notifications
 */
export async function subscribeOneSignal() {
  if (!_onesignalReady) await initOneSignal();
  try {
    await window.OneSignal.Notifications.requestPermission();
    return true;
  } catch (e) {
    console.warn('[OneSignal] Subscribe error:', e.message);
    return false;
  }
}

/**
 * Send push notification via webhook proxy
 * Called from Firebase listeners when new data detected
 */
export async function sendPushViaProxy(title, body, data = {}) {
  // Send via webhook (server-side OneSignal API)
  try {
    await fetch(PUSH_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: ONE_SIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: body },
        included_segments: ['All'],
        data,
        icon: '/logo.png',
      }),
    });
  } catch (e) {
    console.warn('[PushProxy] Error:', e.message);
  }
}
