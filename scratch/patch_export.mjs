import { readFileSync, writeFileSync } from 'fs';

const files = [
  { p: 'd:/Coding/MTC-Asset/src/js/firebase-config.js', importLine: 2, exportLine: 34 },
  { p: 'd:/Coding/MTC-Asset/src/js/db.js', importLine: 8, exportLine: 44 }
];

for (const { p, importLine, exportLine } of files) {
  let s = readFileSync(p, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const lines = s.split(nl);

  // Import: add onChildAdded, onChildChanged after onValue
  lines[importLine - 1] = lines[importLine - 1].replace('onValue', 'onValue, onChildAdded');

  // Export: add onChildAdded after onValue
  lines[exportLine - 1] = lines[exportLine - 1].replace('onValue', 'onValue, onChildAdded');

  writeFileSync(p, lines.join(nl));
  console.log('OK:', p);
}
