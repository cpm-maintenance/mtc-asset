/**
 * MTC-ASSET Quick Backup Script (Node.js)
 * 
 * Cara pakai:
 *   npm run backup
 * 
 * Akan backup Firebase data + commit + push ke GitHub
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', encoding: 'utf-8', timeout: 120000, ...opts });
    return true;
  } catch (err) {
    if (opts.optional) {
      console.log(`  ⚠️  (optional) ${err.message}`);
      return false;
    }
    throw err;
  }
}

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║     MTC-ASSET COMPLETE BACKUP         ║');
console.log(`║     ${new Date().toLocaleString()}            ║`);
console.log('╚══════════════════════════════════════╝');
console.log('');

try {
  // Step 1: Backup Firebase data
  console.log('Step 1/4: 📥 Backup Firebase Database');
  if (existsSync(join(ROOT, 'node_modules', 'firebase'))) {
    run('node scripts/backup-firebase.js', { optional: true });
  }

  // Step 2: Check git status
  console.log('\nStep 2/4: 📝 Check git status');
  run('git status', { optional: true });

  // Step 3: Stage all files
  console.log('\nStep 3/4: 📦 Stage files');
  run('git add -A');

  // Step 4: Commit & Push
  console.log('\nStep 4/4: 🚀 Commit & Push');
  
  // Check if there's anything to commit
  const hasChanges = execSync('git diff --cached --quiet', { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    
    run(`git commit -m "📦 Backup: ${dateStr} ${timeStr}

Automated backup of source code and Firebase data"`);
    run('git push');
    console.log('\n✅ Backup completed successfully!');
  } catch {
    console.log('\n⚠️  No changes to commit');
  }

} catch (err) {
  console.error('\n❌ Backup failed:', err.message);
  process.exit(1);
}
