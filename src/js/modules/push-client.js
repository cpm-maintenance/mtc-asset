// @ts-check
/**
 * Push client — kirim push lewat proxy serverless FCM (/api/fcm-push).
 *
 * Badan request sengaja tetap memakai nama field ala OneSignal
 * (`headings` / `contents`) karena `/api/fcm-push` menerima KEDUA format —
 * lihat api/fcm-push.js:33-34. `app_id` tidak dikirim: endpoint FCM mengabaikannya.
 *
 * SDK OneSignal sudah dibuang (kode mati, tree-shaken). FCM adalah jalur push
 * yang benar-benar aktif — lihat src/js/modules/notification.js.
 */
const PUSH_PROXY_URL = import.meta.env.VITE_PUSH_PROXY_URL || 'https://mtc-asset.vercel.app/api/fcm-push';

/**
 * Kirim push notification ke semua perangkat terdaftar.
 * Fire-and-forget: kegagalan hanya dicatat, tidak pernah melempar.
 *
 * @param {string} title
 * @param {string} body
 * @param {Record<string, any>} [data]
 */
export async function sendPushViaProxy(title, body, data = {}) {
  try {
    await fetch(PUSH_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headings: { en: title },
        contents: { en: body },
        included_segments: ['All'],
        data,
        icon: '/logo.png',
      }),
    });
  } catch (e) {
    console.warn('[PushProxy] Error:', /** @type {any} */ (e).message);
  }
}
