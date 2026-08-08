/**
 * Migrate ImageUploads base64 → ImgBB URLs.
 * - Reads ImageUploads node from Firebase DB
 * - Uploads each base64 to ImgBB
 * - Updates Equipment.FotoURL / HistoryLog.PhotoURLs to new URLs
 * - Removes migrated entries from ImageUploads
 * Requires: firebase-admin + service account, or firebase CLI token
 * 
 * SAFETY: dry-run by default. Pass --apply to write changes.
 */
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const APPLY = process.argv.includes('--apply');

// --- Load config ---
let serviceAccount = null;
try {
  serviceAccount = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));
} catch (e) {
  console.error('❌ serviceAccountKey.json not found. Download from Firebase Console → Project settings → Service accounts → Generate new private key.');
  process.exit(1);
}

const env = readFileSync('.env', 'utf8');
const dbUrl = env.match(/VITE_FIREBASE_DATABASE_URL[=:]\s*["']?([^"'\s]+)/)?.[1];
const imgbbKey = env.match(/VITE_IMGBB_API_KEY[=:]\s*["']?([^"'\s]+)/)?.[1];
if (!dbUrl || !imgbbKey) { console.error('❌ Missing env vars'); process.exit(1); }

const app = initializeApp({ credential: cert(serviceAccount), databaseURL: dbUrl });
const db = getDatabase(app);

async function uploadToImgBB(base64, name) {
  const raw = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
  const form = new FormData();
  form.append('key', imgbbKey);
  form.append('image', raw);
  form.append('name', name);
  const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
  const j = await r.json();
  if (!j.success) throw new Error('ImgBB: ' + (j.error?.message || 'unknown'));
  return j.data.url;
}

async function main() {
  console.log(APPLY ? '🔥 APPLY MODE — will write changes' : '🧪 DRY RUN — no writes');
  
  const snap = await db.ref('ImageUploads').get();
  const uploads = snap.val() || {};
  const ids = Object.keys(uploads);
  console.log('ImageUploads found:', ids.length);

  const equipSnap = await db.ref('Equipment').get();
  const equipment = equipSnap.val() || {};
  const logSnap = await db.ref('HistoryLog').get();
  const logs = logSnap.val() || {};

  let migrated = 0, failed = 0;

  for (const id of ids) {
    const entry = uploads[id];
    const data = entry?.data || entry?.dataUrl || '';
    if (!data || !data.startsWith('data:')) {
      console.log(`  ⏭️  ${id}: not a data URL, skip`);
      continue;
    }
    try {
      console.log(`  📤 ${id}: uploading ${Math.round(data.length / 1024)}KB...`);
      const url = await uploadToImgBB(data, id);
      console.log(`    → ${url}`);

      // Update references
      const updates = {};
      // Equipment with matching FotoURL
      for (const [eqId, eq] of Object.entries(equipment)) {
        if (eq.FotoURL && eq.FotoURL.includes(data.slice(0, 80))) {
          updates[`Equipment/${eqId}/FotoURL`] = url;
          console.log(`    ✓ Equipment ${eqId} FotoURL updated`);
        }
      }
      // HistoryLog with PhotoURLs containing this data
      for (const [logId, log] of Object.entries(logs)) {
        const urls = log.PhotoURLs || log.PhotoURL || '';
        const asStr = typeof urls === 'string' ? urls : JSON.stringify(urls);
        if (asStr.includes(data.slice(0, 80))) {
          if (Array.isArray(urls)) {
            updates[`HistoryLog/${logId}/PhotoURLs`] = urls.map(u => u === data ? url : u);
          } else {
            updates[`HistoryLog/${logId}/PhotoURLs`] = [url];
          }
          console.log(`    ✓ Log ${logId} PhotoURLs updated`);
        }
      }
      // Remove from ImageUploads
      updates[`ImageUploads/${id}`] = null;

      if (APPLY) await db.ref().update(updates);
      migrated++;
    } catch (e) {
      failed++;
      console.error(`  ❌ ${id}: ${e.message}`);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, failed: ${failed}`);
  if (!APPLY) console.log('\nRe-run with --apply to write changes.');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
