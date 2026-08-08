import { readFileSync } from 'fs';

// Load key from .env
const env = readFileSync('.env', 'utf8');
const m = env.match(/(IMGBB|IMG_BB|imgbb)[^=]*[=:]\s*["']?([^"'\s]+)/i);
const key = m ? m[2] : null;
console.log('Key:', key ? key.slice(0, 10) + '...' : 'NOT FOUND');

if (!key) process.exit(1);

// 1x1 red pixel PNG (smallest valid test image)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const form = new FormData();
form.append('key', key);
form.append('image', new Blob([png], { type: 'image/png' }), 'test.png');

try {
  const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
  const j = await r.json();
  console.log('Status:', r.status);
  if (j.success) {
    console.log('✅ ImgBB ACTIVE — URL:', j.data.url);
    console.log('Display URL:', j.data.display_url);
  } else {
    console.log('❌ ImgBB response:', JSON.stringify(j));
  }
} catch (e) {
  console.error('❌ Request failed:', e.message);
}
