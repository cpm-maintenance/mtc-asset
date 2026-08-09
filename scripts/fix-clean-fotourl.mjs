#!/usr/bin/env node
/**
 * MTC-ASSET — Scan & fix FotoURL/PhotoURLs invalid di Firebase Realtime DB
 * Fix SW error "web.app/[" — data FotoURL rusak (bracket / non-URL)
 *
 *   node scripts/fix-clean-fotourl.mjs          # dry-run: scan + list
 *   node scripts/fix-clean-fotourl.mjs --apply  # hapus field invalid
 */
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROJECT = 'mtc-asset';
const NODE_SEARCH = ['Equipment', 'HistoryLog', 'ImageUploads'];

const APPLY = process.argv.includes('--apply');

function execFirebase(args) {
  const cmd = `firebase ${args.join(' ')} --project ${PROJECT}`;
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 30000, windowsHide: true });
}

function fetchNode(name) {
  const raw = execFirebase(['database:get', `/${name}`, '--pretty']);
  if (!raw || raw.trim() === 'null' || raw.trim() === '') return {};
  return JSON.parse(raw) || {};
}

function decodeEntity(s) {
  return s.replace(/&#[xX](\w+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function isValidUrl(u) {
  if (!u || typeof u !== 'string') return false;
  const s = decodeEntity(u.trim());
  return /^(https?:\/\/|data:image\/|blob:)/.test(s) && !/[\[\]{}<>]/.test(s);
}

function walk(node, prefix, found) {
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'FotoURL' || k === 'PhotoURLs') {
      if (Array.isArray(v)) {
        v.forEach((item, i) => { if (!isValidUrl(item)) found.push({ path: `${prefix}/${k}/${i}`, value: String(item).slice(0, 60) }); });
      } else if (!isValidUrl(v)) {
        found.push({ path: `${prefix}/${k}`, value: String(v).slice(0, 60) });
      }
    }
    if (typeof v === 'object' && v !== null) walk(v, prefix + '/' + k, found);
  }
}

function removeField(p) {
  // p contoh: "Equipment/2220-CR-001/FotoURL"  →  hapus leaf field
  execFirebase(['database:remove', `/${p}`, '--force']);
}

console.log('Scan invalid FotoURL/PhotoURLs...\n');
const found = [];
for (const node of NODE_SEARCH) {
  let data;
  try { data = fetchNode(node); } catch (e) { console.log(`⚠️  ${node} gagal dibaca: ${e.message.split('\n')[0]}`); continue; }
  walk(data, node, found);
}

if (!found.length) { console.log('✅ Tidak ada field invalid.'); process.exit(0); }

console.log(`${found.length} field invalid ditemukan:\n`);
found.forEach(f => console.log(`  ${f.path}\n    → ${f.value}`));

if (APPLY) {
  console.log('\nMenghapus...');
  const unique = [...new Map(found.map(f => [f.path, f])).values()];
  let ok = 0;
  for (const f of unique) {
    try { removeField(f.path); ok++; }
    catch (e) { console.log(`  ✗ ${f.path}: ${e.message.split('\n')[0]}`); }
  }
  console.log(`\n✅ ${ok}/${unique.length} dihapus.`);
} else {
  console.log('\n(dry-run — tambahkan --apply untuk menghapus)');
}
