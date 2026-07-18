/**
 * OneSignal — Web Push Notification Module
 * 
 * Uses OneSignalDeferred pattern (v16+) for clean init.
 * Push config BEFORE script loads, SDK auto-initializes.
 */
const ONE_SIGNAL_APP_ID = '08770479-20e7-4414-8f10-abe1c1240bf7';

// Webhook proxy — Vercel Serverless FCM Push (see /api/fcm-push.js)
const PUSH_PROXY_URL = import.meta.env.VITE_PUSH_PROXY_URL || 'https://mtc-asset.vercel.app/api/fcm-push';

let _initCalled = false;
let _initComplete = false;
let _initResolve = null;

const _readyPromise = new Promise((resolve) => { _initResolve = resolve; });

/**
 * Init OneSignal — push config + load SDK once
 */
export async function initOneSignal() {
  if (_initComplete) return true;
  if (_initCalled) return _readyPromise;
  _initCalled = true;
  if (typeof window === 'undefined') return false;

  try {
    // Push config before script loads (OneSignalDeferred pattern)
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: ONE_SIGNAL_APP_ID,
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
        _initComplete = true;
        console.log('[OneSignal] Initialized');
        _initResolve(true);
      } catch (e) {
        console.warn('[OneSignal] Init error:', e.message);
        _initResolve(false);
      }
    });

    // Load SDK script once
    if (!document.querySelector('script[src*="OneSignalSDK.page.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  } catch (e) {
    console.warn('[OneSignal] Setup error:', e.message);
    _initResolve(false);
  }

  // Timeout fallback
  setTimeout(() => { if (!_initComplete) _initResolve(false); }, 10000);
  return _readyPromise;
}

/**
 * Subscribe user to push notifications
 */
export async function subscribeOneSignal() {
  await initOneSignal();
  try {
    return await window.OneSignal?.Notifications?.requestPermission(true);
  } catch {
    return false;
  }
}

/**
 * Send push notification via Vercel proxy
 */
export async function sendPushViaProxy(title, body, data = {}) {
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
