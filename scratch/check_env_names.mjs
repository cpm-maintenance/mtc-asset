import { readFileSync } from 'fs';
const s = readFileSync('.env', 'utf8');
// Show only variable NAMES (not values) for security
const names = s.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(/[=:]/)[0].trim());
console.log('Env var names:', names.join(', '));
// Check imgbb exact line format
const m = s.match(/^.*[Ii][Mm][Gg][Bb][Bb].*$/m);
console.log('ImgBB line format:', m ? m[0].replace(/=.*/, '=***') : 'not found');
