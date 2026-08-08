import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/Coding/MTC-Asset/scripts/backup.js';
let s = readFileSync(p, 'utf8');

const old = `  // Check if there's anything to commit
  const hasChanges = execSync('git diff --cached --quiet', { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    
    run(\`git commit -m "📦 Backup: \${dateStr} \${timeStr}

Automated backup of source code and Firebase data"\`);
    run('git push');
    console.log('\\n✅ Backup completed successfully!');
  } catch {
    console.log('\\n⚠️  No changes to commit');
  }`;

const repl = `  // Check if there's anything to commit
  let hasChanges = false;
  try {
    execSync('git diff --cached --quiet', { cwd: ROOT, stdio: 'pipe' });
  } catch {
    hasChanges = true; // exit 1 = ada perubahan staged
  }

  if (!hasChanges) {
    console.log('\\n⚠️  No changes to commit');
  } else {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    
    run(\`git commit -m "📦 Backup: \${dateStr} \${timeStr}
\${''}
Automated backup of source code and Firebase data"\`);
    run('git push');
    console.log('\\n✅ Backup completed successfully!');
  }`;

let t = s.replace(/\r\n/g, '\n');
if (!t.includes(old)) { console.error('PATTERN NOT FOUND'); process.exit(1); }
t = t.replace(old, repl);
writeFileSync(p, t.replace(/\n/g, '\r\n'));
console.log('OK: backup.js fixed');
