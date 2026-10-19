#!/usr/bin/env node
// Migrasi data legacy: field berakhiran URL/Url/URLs di RTDB yang masih ter-escape
// (`https:&#x2F;&#x2F;...`) dikembalikan ke URL asli. Fix commit 9038829 hanya
// berlaku untuk tulisan baru; skrip ini membersihkan baris lama.
//
// Pakai:
//   node scripts/migrate-fotourl.mjs                 # dry-run (default, tidak menulis)
//   node scripts/migrate-fotourl.mjs --apply         # tulis balik
//   node scripts/migrate-fotourl.mjs --node Equipment,HistoryLog
//
// Idempoten: jalan kedua kali melaporkan 0 field legacy.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const PROJECT = 'mtc-asset';
const DEFAULT_NODES = ['Equipment', 'SpareParts', 'HistoryLog', 'Performance', 'Users', 'logs'];
const URL_KEY = /urls?$/i;

/** Entitas HTML yang mungkin tersisa dari sanitizeInput lama. */
const ENTITIES = [
  ['&#x2F;', '/'],
  ['&#x2f;', '/'],
  ['&#47;', '/'],
  ['&quot;', '"'],
  ['&#x27;', "'"],
  ['&#39;', "'"],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&amp;', '&'],
];

/** Decode nilai legacy. String tanpa entitas dikembalikan apa adanya. */
export function decodeLegacyUrl(value) {
  if (typeof value !== 'string' || !value.includes('&')) return value;
  let out = value;
  for (const [from, to] of ENTITIES) out = out.split(from).join(to);
  return out;
}

/** True kalau nilai masih mengandung entitas hasil escaping. */
export function isLegacyValue(value) {
  return typeof value === 'string' && /&(?:#x?2f|#47|amp|quot|#x?27|#39|lt|gt);/i.test(value);
}

/**
 * Telusuri pohon RTDB dan kumpulkan path yang perlu ditulis ulang.
 * @param {unknown} tree
 * @param {string} [prefix] path akar ('' untuk node itu sendiri)
 * @returns {{updates: Record<string, unknown>, samples: Array<{path: string, from: string, to: string}>, scanned: number}}
 */
export function collectLegacyUpdates(tree, prefix = '') {
  const updates = {};
  const samples = [];
  let scanned = 0;

  const visit = (node, path, key) => {
    if (node === null || node === undefined) return;

    if (typeof node === 'string') {
      if (!URL_KEY.test(key || '')) return;
      scanned++;
      if (!isLegacyValue(node)) return;
      const next = decodeLegacyUrl(node);
      if (next === node) return;
      updates[path] = next;
      if (samples.length < 5) samples.push({ path, from: node.slice(0, 60), to: next.slice(0, 60) });
      return;
    }

    if (Array.isArray(node)) {
      if (!URL_KEY.test(key || '')) return;
      const next = node.map((item) => (typeof item === 'string' ? decodeLegacyUrl(item) : item));
      const changed = next.some((item, i) => item !== node[i]);
      scanned += node.length;
      if (!changed) return;
      updates[path] = next;
      if (samples.length < 5) {
        samples.push({ path, from: JSON.stringify(node).slice(0, 60), to: JSON.stringify(next).slice(0, 60) });
      }
      return;
    }

    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) visit(v, path ? `${path}/${k}` : k, k);
    }
  };

  visit(tree, prefix, '');
  return { updates, samples, scanned };
}

/** Pecah objek update jadi potongan agar satu perintah CLI tidak kepanjangan. */
export function chunkUpdates(updates, size = 100) {
  const entries = Object.entries(updates);
  const out = [];
  for (let i = 0; i < entries.length; i += size) out.push(Object.fromEntries(entries.slice(i, i + size)));
  return out;
}

// Entry JS firebase-tools dipanggil lewat node langsung: execFile + argumen array
// (tanpa shell) supaya nilai dari RTDB tidak pernah diinterpretasi sebagai perintah.
const FIREBASE_JS =
  process.env.FIREBASE_JS || join(process.env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');

function cli(args) {
  return execFileSync(process.execPath, [FIREBASE_JS, ...args, '--project', PROJECT], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120000,
    windowsHide: true,
  });
}

function readNode(node) {
  const raw = cli(['database:get', `/${node}`]);
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed === 'null') return null;
  return JSON.parse(trimmed);
}

function writeNode(node, updates) {
  // --force: lewati prompt konfirmasi interaktif (stdio pipa, tidak ada TTY).
  return cli(['database:update', `/${node}`, '--data', JSON.stringify(updates), '--force']);
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const nodeArg = argv.find((a) => a.startsWith('--node=')) || (argv.includes('--node') ? `--node=${argv[argv.indexOf('--node') + 1]}` : '');
  const nodes = nodeArg ? nodeArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_NODES;

  let totalScanned = 0;
  let totalLegacy = 0;
  const plan = [];

  for (const node of nodes) {
    let tree;
    try {
      tree = readNode(node);
    } catch (err) {
      console.log(`[migrate] ${node}: SKIP (${String(err.message).split('\n')[0].slice(0, 80)})`);
      continue;
    }
    if (!tree) {
      console.log(`[migrate] ${node}: kosong`);
      continue;
    }
    const { updates, samples, scanned } = collectLegacyUpdates(tree);
    const legacy = Object.keys(updates).length;
    totalScanned += scanned;
    totalLegacy += legacy;
    console.log(`[migrate] ${node}: ${scanned} field URL, ${legacy} legacy`);
    for (const s of samples) console.log(`           ${s.path}\n             dari: ${s.from}\n             jadi: ${s.to}`);
    if (legacy) plan.push({ node, updates });
  }

  console.log(`[migrate] total: ${totalScanned} field URL diperiksa, ${totalLegacy} legacy`);
  if (!apply) {
    console.log('[migrate] DRY-RUN — tidak ada penulisan. Tambahkan --apply untuk menulis.');
    return;
  }
  if (!plan.length) {
    console.log('[migrate] tidak ada yang perlu ditulis (idempoten).');
    return;
  }
  for (const { node, updates } of plan) {
    for (const chunk of chunkUpdates(updates)) {
      writeNode(node, chunk);
      console.log(`[migrate] ${node}: ${Object.keys(chunk).length} field ditulis`);
    }
  }
  console.log('[migrate] selesai. Jalankan ulang tanpa --apply untuk memastikan 0 legacy.');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('migrate-fotourl.mjs')) main();
