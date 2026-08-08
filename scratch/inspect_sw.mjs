import { readFileSync } from 'fs';

const s = readFileSync('dist/sw.js', 'utf8');
console.log('size:', s.length);
const m = s.match(/url:\s*["'][^"']+["']/g) || [];
console.log('precache url entries:', m.length);
const interesting = m.filter(x => /page|Equipment|index|\.html/i.test(x));
console.log('html-ish:', interesting.length);
console.log(interesting.slice(0, 25).join('\n'));
console.log('---');
// Workbox navigateFallback?
console.log('has NavigationRoute:', s.includes('NavigationRoute'));
console.log('has navigateFallback:', s.includes('navigateFallback'));
console.log('has createHandlerBoundToURL:', s.includes('createHandlerBoundToURL'));
