import { readFileSync } from 'fs';
for (const f of ['.env', '.env.local']) {
  try {
    const s = readFileSync(f, 'utf8');
    const m = s.match(/(IMGBB|IMG_BB|imgbb)[^=]*[=:]\s*["']?([^"'\s]+)/i);
    if (m) console.log(f, '-> IMGBB key:', m[2].slice(0, 10) + '...');
    else console.log(f, '-> IMGBB key NOT FOUND');
  } catch (e) { console.log(f, '-> missing'); }
}
// Also check where imgbbUrl is used
import { readFileSync as rfs } from 'fs';
const eq = rfs('src/js/modules/equipment.js', 'utf8');
const idx = eq.indexOf('imgbb');
console.log('\n--- equipment.js imgbb context ---');
console.log(eq.slice(Math.max(0, idx - 200), idx + 400));
