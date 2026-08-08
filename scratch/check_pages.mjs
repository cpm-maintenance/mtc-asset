// Deeper: check how pages are loaded (fetch/x-html) and audit.js usage
import fs from 'fs';
const idx = fs.readFileSync('index.html', 'utf8');
for (const kw of ['AuditTrail', 'MTBFMTTR', 'MonthlyPlan', 'PlanningBoard', 'TechnicianWorkload', 'pages/', 'x-html', 'fetch(']) {
  const m = idx.match(new RegExp('.{0,50}' + kw + '.{0,60}', 'g')) || [];
  console.log('=== ' + kw + ' (' + m.length + ') ===');
  m.slice(0, 3).forEach(x => console.log('  ', x.replace(/\r/g, '')));
}
// audit.js usage
const js = fs.readFileSync('src/js/app.js', 'utf8');
const m2 = js.match(/.{0,40}audit.{0,60}/g) || [];
console.log('=== audit in app.js (' + m2.length + ') ===');
m2.slice(0, 3).forEach(x => console.log('  ', x.replace(/\r/g, '')));
