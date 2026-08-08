// Check if untracked files are actually used
import fs from 'fs';
import path from 'path';

const untracked = [
  'public/offline.html',
  'public/pages/AuditTrail.html',
  'public/pages/MTBFMTTR.html',
  'public/pages/MonthlyPlan.html',
  'public/pages/PlanningBoard.html',
  'public/pages/TechnicianWorkload.html',
  'src/js/db.js',
  'src/js/icons.js',
  'src/js/lucide-icons.js',
  'src/js/modules/audit.js',
];

function scan() {
  const files = [];
  for (const dir of ['src', 'public', 'index.html', 'sw.js', 'api']) {
    if (fs.statSync(dir).isDirectory()) walk(dir, files);
    else if (fs.existsSync(dir)) files.push(dir);
  }
  return files;
}
function walk(d, out) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|html|json)$/.test(f)) out.push(p);
  }
}

const files = scan();
const content = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');

for (const f of untracked) {
  const base = path.basename(f);
  const refs = (content.match(new RegExp(base.replace('.', '\\.'), 'g')) || []).length;
  // exclude self
  console.log(f, '-> refs in other files:', refs);
}
