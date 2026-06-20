#!/usr/bin/env node
/**
 * MTC-ASSET Firebase Database Backup Script
 * 
 * Backup semua data Firebase Realtime Database ke file JSON
 * 
 * Cara pakai:
 *   npm run backup:firebase
 * 
 * Output: backups/backup-YYYY-MM-DD_HH-mm-ss.json
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const BACKUP_DIR = join(PROJECT_ROOT, 'backups');

// ========================================
// CONFIG
// ========================================
const MAX_BACKUPS = 30;
const FIREBASE_PROJECT = 'mtc-asset';

// Semua node di Firebase Realtime Database yang akan di-backup
const DB_NODES = [
  'Equipment',
  'SpareParts',
  'HistoryLog',
  'Performance',
  'Users',
  'Stats',
  'Settings',
  'AI_Settings',
  'ImageUploads',
];

// ========================================
// HELPERS
// ========================================

function pad(n) { return String(n).padStart(2, '0'); }

function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function formatBytes(bytes) {
  const kb = bytes / 1024;
  return kb > 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(1) + ' KB';
}

/**
 * Jalankan firebase CLI command
 * Gunakan firebase langsung (bukan npx) karena sudah terinstall global
 */
function execFirebase(args) {
  const cmd = `firebase ${args.join(' ')} --project ${FIREBASE_PROJECT}`;
  try {
    const stdout = execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return stdout;
  } catch (err) {
    const msg = err.stderr ? err.stderr.toString() : err.message;
    throw new Error(msg);
  }
}

function fetchNodeData(nodeName) {
  try {
    const raw = execFirebase(['database:get', `/${nodeName}`, '--pretty']);
    if (!raw || raw.trim() === 'null' || raw.trim() === '') {
      return { data: {}, count: 0 };
    }
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const keys = Object.keys(data);
      // Filter out keys starting with _ (internal)
      const validKeys = keys.filter(k => !k.startsWith('_'));
      const filtered = {};
      for (const k of validKeys) filtered[k] = data[k];
      return { data: filtered, count: validKeys.length };
    }
    return { data: data || {}, count: 1 };
  } catch (err) {
    throw err;
  }
}

// ========================================
// MAIN
// ========================================

function backup() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║     MTC-ASSET FIREBASE BACKUP        ║');
  console.log(`║     ${new Date().toLocaleString()}          ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // 1. Buat folder backup
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('📁 Created:', BACKUP_DIR);
  }

  const timestamp = getTimestamp();
  const backupData = {
    _metadata: {
      exportedAt: new Date().toISOString(),
      project: FIREBASE_PROJECT,
      version: '1.0.0',
      nodes: DB_NODES,
    },
  };

  // 2. Backup per node
  console.log('⏳ Fetching data from Firebase...\n');

  let totalRecords = 0;
  for (const node of DB_NODES) {
    process.stdout.write(`  📦 ${node}... `);
    try {
      const { data, count } = fetchNodeData(node);
      backupData[node] = data;
      totalRecords += count;
      
      if (count > 0) {
        console.log(`✅ ${count} records`);
      } else {
        console.log('⚠️  (empty)');
      }
    } catch (err) {
      console.log('❌ FAILED');
      console.log(`     Error: ${err.message.split('\n')[0]}`);
      backupData[node] = {};
    }
  }

  // 3. Simpan file
  const filename = `backup-${timestamp}.json`;
  const filePath = join(BACKUP_DIR, filename);
  const jsonStr = JSON.stringify(backupData, null, 2);
  writeFileSync(filePath, jsonStr, 'utf-8');

  const fileSize = Buffer.byteLength(jsonStr, 'utf-8');
  console.log(`\n💾 Saved: backups/${filename}`);
  console.log(`   Size: ${formatBytes(fileSize)}`);
  console.log(`   Total records: ${totalRecords}`);

  // 4. Update latest reference
  writeFileSync(join(BACKUP_DIR, 'LATEST.txt'), filename, 'utf-8');

  // 5. Cleanup backup lama
  console.log('\n🧹 Cleaning old backups...');
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort();

  if (files.length > MAX_BACKUPS) {
    const toRemove = files.slice(0, files.length - MAX_BACKUPS);
    for (const oldFile of toRemove) {
      unlinkSync(join(BACKUP_DIR, oldFile));
      console.log(`  🗑️  Removed: ${oldFile}`);
    }
  } else {
    console.log(`  ✅ ${files.length} backups stored (max ${MAX_BACKUPS})`);
  }

  console.log('\n✅ Backup completed successfully!');
  return filePath;
}

// ========================================
// EXECUTE
// ========================================

try {
  backup();
} catch (err) {
  console.error('\n❌ Backup failed:', err.message);
  process.exit(1);
}
