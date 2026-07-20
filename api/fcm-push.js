// Vercel serverless — FCM push via Firebase Admin SDK
// Uses FCM tokens stored in Firebase RTDB at _fcmTokens/{uid}
//
// ENV VAR required (Vercel Dashboard):
//   FIREBASE_SERVICE_ACCOUNT = full JSON service account key from Firebase Console
//     Project Settings → Service Accounts → Generate new private key

import * as admin from 'firebase-admin';

const DATABASE_URL = 'https://mtc-asset-default-rtdb.asia-southeast1.firebasedatabase.app';

function initAdmin() {
  if (admin.apps.length) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(sa),
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

  const { title, body, data = {} } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  try {
    initAdmin();

    // Read all FCM tokens
    const snap = await admin.database().ref('_fcmTokens').once('value');
    const entries = snap.val();
    if (!entries) return res.json({ ok: true, sent: 0, reason: 'no tokens' });

    const tokens = Object.values(entries)
      .map(e => e.token)
      .filter(Boolean);

    if (tokens.length === 0) return res.json({ ok: true, sent: 0, reason: 'no tokens' });

    const messages = tokens.map(token => ({
      token,
      notification: { title, body },
      data: { ...data, clickAction: data.url || '/' },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          icon: '/logo.png',
          badge: '/logo.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: data.tag || 'mtc-push',
        },
        fcmOptions: { link: data.url || '/' },
      },
    }));

    const result = await admin.messaging().sendEach(messages);

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
