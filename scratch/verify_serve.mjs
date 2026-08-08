const r = await fetch('http://localhost:3000/src/js/modules/logs.js');
const s = await r.text();
console.log('logs.js uploadToImgBB:', s.includes('uploadToImgBB'));
console.log('logs.js blob skip:', s.includes("startsWith('blob:')"));
console.log('logs.js data keep:', s.includes("startsWith('data:')"));
const a = await fetch('http://localhost:3000/src/js/app.js');
const t = await a.text();
console.log('app.js migrateLegacyImages:', t.includes('migrateLegacyImages'));
