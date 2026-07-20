// Vercel serverless — FCM push via Firebase Admin SDK
// Uses FCM tokens stored in Firebase RTDB at _fcmTokens/{uid}
//
// ENV VAR required (Vercel Dashboard):
//   FIREBASE_SERVICE_ACCOUNT = full JSON service account key from Firebase Console
//     Project Settings → Service Accounts → Generate new private key

import { cert, initializeApp, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';

const DATABASE_URL = 'https://mtc-asset-default-rtdb.asia-southeast1.firebasedatabase.app';

function initAdmin() {
  try { return getApp(); } catch {}
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({
    credential: cert(sa),
    databaseURL: DATABASE_URL,
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Support both direct {title,body} and OneSignal {headings,contents} format
  let title = req.body.title || req.body.headings?.en || req.body.headings?.default;
  let body = req.body.body || req.body.contents?.en || req.body.contents?.default;
  const { data = {} } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  try {
    const app = initAdmin();

    // Read all FCM tokens
    const db = getDatabase(app);
    const snap = await db.ref('_fcmTokens').once('value');
    const entries = snap.val();
    if (!entries) return res.json({ ok: true, sent: 0, reason: 'no tokens' });

    const tokens = Object.values(entries)
      .map(e => e.token)
      .filter(Boolean);

    if (tokens.length === 0) return res.json({ ok: true, sent: 0, reason: 'no tokens' });

    const messages = tokens.map(token => ({
      token,
      data: {
        title,
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: JSON.stringify([200, 100, 200]),
        requireInteraction: 'true',
        tag: data.tag || 'mtc-push',
        clickAction: data.url || '/',
        ...data,
      },
      webpush: {
        headers: { Urgency: 'high' },
        fcmOptions: { link: data.url || '/' },
      },
    }));

    const messaging = getMessaging(app);
    const result = await messaging.sendEach(messages);

    return res.json({
      ok: true,
      sent: result.successCount,
      failed: result.failureCount,
      errors: result.responses
        .filter(r => r.error)
        .map(r => ({ code: r.error.code, message: r.error.message })),
    });
  } catch (e) {
    console.error('[FCM Push] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
