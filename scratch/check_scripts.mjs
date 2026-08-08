// Find all js files loaded + where x-page resolved
import fs from 'fs';
const s = fs.readFileSync('index.html', 'utf8');
// module scripts
const scripts = s.match(/<script[^>]*src="[^"]*"[^>]*>/g) || [];
console.log('script srcs:', scripts.map(x => x.match(/src="([^"]*)"/)[1]).join('\n'));
