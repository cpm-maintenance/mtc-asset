import { readFileSync, writeFileSync } from 'fs';

const fixes = [
  {
    p: 'd:/Coding/MTC-Asset/src/js/modules/export.js',
    old: `const equipData = structuredClone(equip);`,
    repl: `const equipData = JSON.parse(JSON.stringify(equip));`
  },
  {
    p: 'd:/Coding/MTC-Asset/src/js/modules/export.js',
    old: `const logsData = structuredClone(this.logs || []);`,
    repl: `const logsData = JSON.parse(JSON.stringify(this.logs || []));`
  },
  {
    p: 'd:/Coding/MTC-Asset/src/js/modules/export.js',
    old: `const pmData = structuredClone(this.pmList || []);`,
    repl: `const pmData = JSON.parse(JSON.stringify(this.pmList || []));`
  },
  {
    p: 'd:/Coding/MTC-Asset/src/js/modules/export.js',
    old: `const partsData = structuredClone(this.allParts || []);`,
    repl: `const partsData = JSON.parse(JSON.stringify(this.allParts || []));`
  },
  {
    p: 'd:/Coding/MTC-Asset/src/js/modules/export.js',
    old: `const list = structuredClone(this.pmList || []);`,
    repl: `const list = JSON.parse(JSON.stringify(this.pmList || []));`
  },
  {
    p: 'd:/Coding/MTC-Asset/src/js/modules/data.js',
    old: `logToDelete = structuredClone(rawData);`,
    repl: `logToDelete = JSON.parse(JSON.stringify(rawData));`
  }
];

for (const { p, old, repl } of fixes) {
  let s = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  if (!s.includes(old)) { console.error('NOT FOUND in', p, ':', old.slice(0, 60)); process.exit(1); }
  s = s.replace(old, repl);
  writeFileSync(p, s.replace(/\n/g, '\r\n'));
  console.log('OK:', p, '→', old.slice(0, 40) + '…');
}
