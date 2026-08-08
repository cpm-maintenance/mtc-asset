// Find where x-page directive is registered (Alpine.directive)
import fs from 'fs';
import path from 'path';
function walk(d, out) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js)$/.test(f)) out.push(p);
  }
}
const files = [];
walk('src', files);
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  if (s.includes('directive(') || s.includes("'x-page'") || s.includes('x-page')) {
    const m = s.match(/.{0,60}(directive\([^)]*x-page|"x-page"|'x-page').{0,120}/g) || [];
    if (m.length) {
      console.log('=== ' + f + ' ===');
      m.slice(0, 3).forEach(x => console.log('  ', x.replace(/\r/g, '')));
    }
  }
}
