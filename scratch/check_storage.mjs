import { readFileSync } from 'fs';
const s = readFileSync('.env', 'utf8') + '\n' + readFileSync('.env.local', 'utf8');
const m = s.match(/STORAGE_BUCKET\s*[=:]\s*["']?([^"'\s]+)/);
console.log('storageBucket:', m ? m[1] : 'NOT FOUND');
if (m) {
  const r = await fetch('https://firebasestorage.googleapis.com/v0/b/' + m[1] + '/o');
  console.log('Bucket probe status:', r.status);
  const j = await r.json().catch(() => null);
  console.log('Response:', j && j.error ? j.error.message : (j && j.items ? 'bucket active, ' + j.items.length + ' files' : JSON.stringify(j).slice(0, 200)));
}
