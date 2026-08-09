/**
 * Migrasi FotoURL base64 inline → ImgBB URL (Phase A2)
 * Equipment: FotoURL = data:image/... → upload ImgBB → update URL
 * Juga HistoryLog.PhotoURLs bila base64 inline
 * Pakai: $env:SEED_ADMIN_PASS='...'; node scripts/migrate-imgbb.mjs
 * Idempotent — skip yang sudah URL (bukan data:)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) throw new Error('.env tidak ditemukan');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const IMGBB_KEY = env.VITE_IMGBB_API_KEY;

async function uploadToImgBB(dataUrl, name) {
  // Decode HTML entities (&#x2F; → /) dari backup RTD
  const decoded = dataUrl
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  const rawB64 = decoded.split('base64,')[1] || decoded;
  // Bersihkan whitespace/URL-safe chars
  const clean = rawB64.replace(/\s+/g, '');
  const form = new FormData();
  form.append('key', IMGBB_KEY);
  form.append('image', clean);
  form.append('name', name);
  const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
  const j = await r.json();
  if (!j.success) throw new Error(j.error?.message || 'ImgBB fail');
  return j.data.url;
}

async function main() {
  const auth = getAuth(app);
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@planner.com';
  const adminPass = process.env.SEED_ADMIN_PASS;
  if (!adminPass) { console.error('❌ Set SEED_ADMIN_PASS'); process.exit(1); }
  await signInWithEmailAndPassword(auth, adminEmail, adminPass);
  console.log(`✓ Auth sebagai ${adminEmail}`);

  const rootRef = ref(db);

  // Equipment
  const eqSnap = await get(child(rootRef, 'Equipment'));
  const equipment = eqSnap.val() || {};
  const eqBase64 = Object.entries(equipment).filter(([, e]) => e.FotoURL && String(e.FotoURL).startsWith('data:'));
  console.log(`Equipment base64 inline: ${eqBase64.length}/${Object.keys(equipment).length}`);

  let migrated = 0, failed = 0;
  for (const [eqId, eq] of eqBase64) {
    try {
      const url = await uploadToImgBB(eq.FotoURL, `eq_${eqId}`);
      await set(ref(db, `Equipment/${eqId}/FotoURL`), url);
      console.log(`  ✓ ${eqId} → ${url.slice(0, 60)}...`);
      migrated++;
      // rate limit ImgBB (1 req/detik gratis)
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`  ✗ ${eqId}: ${e.message}`);
      failed++;
    }
  }

  // HistoryLog PhotoURLs base64
  const logSnap = await get(child(rootRef, 'HistoryLog'));
  const logs = logSnap.val() || {};
  let logMigrated = 0;
  for (const [logId, log] of Object.entries(logs)) {
    const urls = log.PhotoURLs;
    if (!urls) continue;
    const arr = Array.isArray(urls) ? urls : [urls];
    const b64 = arr.filter(u => u && String(u).startsWith('data:'));
    if (!b64.length) continue;
    const newUrls = [];
    for (const u of b64) {
      try {
        const url = await uploadToImgBB(u, `log_${logId}`);
        newUrls.push(url);
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) { console.error(`  ✗ log ${logId}: ${e.message}`); failed++; }
    }
    const merged = [...arr.filter(u => !String(u).startsWith('data:')), ...newUrls];
    await set(ref(db, `HistoryLog/${logId}/PhotoURLs`), merged);
    if (newUrls.length) { console.log(`  ✓ log ${logId}: ${newUrls.length} foto`); logMigrated++; }
  }

  console.log(`\n✅ Migrasi selesai: Equipment=${migrated}, Logs=${logMigrated}, Gagal=${failed}`);
  process.exit(0);
}

main().catch(e => { console.error('❌ Migrate error:', e); process.exit(1); });
