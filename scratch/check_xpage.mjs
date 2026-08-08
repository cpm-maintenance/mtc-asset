// Find x-page directive implementation
import fs from 'fs';
const idx = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('src/js/app.js', 'utf8');
const all = idx + js;
const m = all.match(/.{0,80}(directive\(|x-page|loadPage|fetch\().{0,100}/gi) || [];
console.log('matches:', m.length);
m.slice(0, 12).forEach(x => console.log('---', x.replace(/\r/g, '')));
