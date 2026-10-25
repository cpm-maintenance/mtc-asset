#!/usr/bin/env node
// @ts-check
/**
 * audit-dangling-parts.mjs — cari referensi spare part yang menggantung (S38g).
 *
 * Latar belakang: `PartsUsed` pada `HistoryLog` menyimpan `{ id, qty }`. Bila
 * part dengan id itu sudah tidak ada di `SpareParts`, transaksi stok ke
 * `SpareParts/<id>/Stok` ditolak rules (`.validate` menuntut NamaPart + Stok +
 * MinStock) — inilah `Restore parts stock error: permission_denied` saat hapus
 * WO (S38f). Sejak S38f transaksi dibatalkan dengan aman, tetapi stok part yang
 * hilang tetap tidak kembali, dan approve WO untuk part yang sama juga akan
 * melewati pemotongan stok.
 *
 * Skrip ini **hanya membaca** dan melaporkan: log mana yang menunjuk part tidak
 * ada, berapa qty yang terpengaruh, dan id apa saja yang hilang. Tidak menulis
 * apa pun ke RTDB.
 *
 * Pemakaian:
 *   npx firebase database:get /HistoryLog --project mtc-asset \
 *     --instance mtc-asset-default-rtdb --output HistoryLog.json
 *   npx firebase database:get /SpareParts --project mtc-asset \
 *     --instance mtc-asset-default-rtdb --output SpareParts.json
 *   node scripts/audit-dangling-parts.mjs --logs HistoryLog.json --parts SpareParts.json
 *
 * Opsi: `--json <berkas>` menulis laporan mesin-terbaca, `--top <n>` membatasi
 * daftar id yang dicetak (default 20).
 */
import fs from 'node:fs';

/**
 * `PartsUsed` di RTDB bisa berbentuk array, string JSON, atau string JSON yang
 * ter-encode dua kali (data legacy). Bentuk apa pun yang tidak bisa diparse
 * dianggap kosong — audit tidak boleh gagal karena satu record rusak.
 *
 * @param {unknown} raw
 * @returns {Array<{ id: string, qty: number }>}
 */
export function parsePartsUsed(raw) {
    if (!raw) return [];

    /** @param {unknown} value */
    const coerce = (value) => {
        if (!Array.isArray(value)) return [];
        return value
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
                id: String(/** @type {any} */ (item).id ?? ''),
                qty: Number(/** @type {any} */ (item).qty) || 0,
            }))
            .filter((item) => item.id !== '');
    };

    // String bisa ter-encode lebih dari sekali (data legacy): parse berulang
    // sampai hasilnya array, maksimal tiga tingkat.
    let value = raw;
    for (let depth = 0; depth < 3; depth += 1) {
        if (Array.isArray(value)) return coerce(value);
        if (typeof value !== 'string') return [];

        const text = value.trim();
        if (text === '' || text === '[]') return [];

        try {
            value = JSON.parse(text);
        } catch {
            return [];
        }
    }
    return Array.isArray(value) ? coerce(value) : [];
}

/**
 * Bandingkan referensi part di log dengan daftar part yang benar-benar ada.
 * Part dianggap ada bila id-nya cocok dengan **key** `SpareParts` atau dengan
 * field `PartID` di dalamnya (kedua konvensi dipakai di data nyata).
 *
 * @param {Record<string, any>} logs
 * @param {Record<string, any>} parts
 * @returns {{ logsScanned: number, refsScanned: number, dangling: Array<{ logId: string, woNumber: string, partId: string, qty: number }>, missing: Array<{ partId: string, refs: number, qty: number, logs: string[] }> }}
 */
export function findDanglingParts(logs, parts) {
    const known = new Set();
    for (const [key, value] of Object.entries(parts || {})) {
        known.add(String(key));
        if (value && typeof value === 'object' && value.PartID) known.add(String(value.PartID));
    }

    const dangling = [];
    let logsScanned = 0;
    let refsScanned = 0;

    for (const [logId, log] of Object.entries(logs || {})) {
        logsScanned += 1;
        for (const item of parsePartsUsed(log?.PartsUsed)) {
            refsScanned += 1;
            if (known.has(item.id)) continue;
            dangling.push({ logId, woNumber: String(log?.woNumber || ''), partId: item.id, qty: item.qty });
        }
    }

    /** @type {Map<string, { partId: string, refs: number, qty: number, logs: string[] }>} */
    const byId = new Map();
    for (const row of dangling) {
        const entry = byId.get(row.partId) || { partId: row.partId, refs: 0, qty: 0, logs: [] };
        entry.refs += 1;
        entry.qty += row.qty;
        entry.logs.push(row.logId);
        byId.set(row.partId, entry);
    }

    const missing = [...byId.values()].sort((a, b) => b.refs - a.refs);
    return { logsScanned, refsScanned, dangling, missing };
}

/** @param {string[]} argv */
function parseArgs(argv) {
    /** @type {Record<string, string>} */
    const out = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg.startsWith('--')) out[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '';
    }
    return out;
}

/** @param {string} file */
function readJson(file) {
    const text = fs.readFileSync(file, 'utf-8');
    return JSON.parse(text);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.logs || !args.parts) {
        console.error('Pemakaian: node scripts/audit-dangling-parts.mjs --logs <HistoryLog.json> --parts <SpareParts.json> [--json out.json] [--top 20]');
        process.exit(2);
    }

    const logs = readJson(args.logs);
    const parts = readJson(args.parts);
    const result = findDanglingParts(logs, parts);
    const top = Number(args.top) || 20;

    console.log('[audit] log dipindai      :', result.logsScanned);
    console.log('[audit] referensi part    :', result.refsScanned);
    console.log('[audit] referensi menggantung:', result.dangling.length, '(id unik:', result.missing.length + ')');

    if (result.missing.length === 0) {
        console.log('[audit] bersih — semua PartsUsed menunjuk part yang ada.');
    } else {
        console.log('[audit] id part yang hilang (top ' + top + '):');
        for (const row of result.missing.slice(0, top)) {
            console.log(
                `  - ${row.partId}: ${row.refs} referensi, total qty ${row.qty}, log: ${row.logs.slice(0, 5).join(', ')}${row.logs.length > 5 ? ', …' : ''}`
            );
        }
    }

    if (args.json) {
        fs.writeFileSync(args.json, JSON.stringify(result, null, 2));
        console.log('[audit] laporan JSON ditulis ke', args.json);
    }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('audit-dangling-parts.mjs')) main();
