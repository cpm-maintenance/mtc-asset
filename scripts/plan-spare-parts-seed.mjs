#!/usr/bin/env node
// @ts-check
/**
 * plan-spare-parts-seed.mjs — susun rencana isi node `SpareParts` (S38g).
 *
 * Node `SpareParts` di RTDB produksi **kosong**, sehingga setiap `PartsUsed`
 * pada `HistoryLog` menunjuk part yang tidak ada dan setiap transaksi stok
 * ditolak `.validate` (`permission_denied`). Skrip ini menyusun **rencana**
 * master part dari data yang benar-benar dimiliki operator:
 *
 *   - nama part  : `SparePartLogs.partName` (prioritas) lalu `Requisitions.items[].itemName`
 *   - stok awal  : Σ qty `SparePartLogs` tipe IN dikurangi tipe OUT (bila ada)
 *   - EquipmentIDs: `SparePartLogs.equipmentId` yang menyertai part itu
 *
 * **Skrip ini tidak menulis apa pun ke RTDB.** Keluarannya berkas JSON yang
 * harus ditinjau manusia dulu; penulisan dilakukan terpisah dan sadar.
 *
 * Pemakaian:
 *   npx firebase database:get /Requisitions --project mtc-asset \
 *     --instance mtc-asset-default-rtdb --output Requisitions.json
 *   npx firebase database:get /SparePartLogs --project mtc-asset \
 *     --instance mtc-asset-default-rtdb --output SparePartLogs.json
 *   node scripts/plan-spare-parts-seed.mjs --requisitions Requisitions.json \
 *     --partlogs SparePartLogs.json --out spare-parts-seed.json
 */
import fs from 'node:fs';
import { parsePartsUsed } from './audit-dangling-parts.mjs';

/**
 * Kumpulkan id part + nama dari item requisition.
 * @param {Record<string, any>} requisitions
 * @returns {Map<string, string>}
 */
export function namesFromRequisitions(requisitions) {
    /** @type {Map<string, string>} */
    const names = new Map();
    for (const req of Object.values(requisitions || {})) {
        const items = Array.isArray(req?.items) ? req.items : [];
        for (const item of items) {
            const id = String(item?.partId ?? '').trim();
            const name = String(item?.itemName ?? '').trim();
            if (!id) continue;
            // Id tetap dicatat walau namanya kosong: bagian penyusun payload perlu
            // tahu part ini ada, hanya belum punya nama resmi (needsReview).
            const prev = names.get(id) || '';
            if (!names.has(id)) names.set(id, '');
            // Nama terpanjang biasanya yang paling lengkap (varian pendek muncul lebih dulu)
            if (name.length > prev.length) names.set(id, name);
        }
    }
    return names;
}

/**
 * Hitung stok awal + equipment terkait dari `SparePartLogs`.
 * @param {Record<string, any>} partLogs
 * @returns {Map<string, { stok: number, equipment: Set<string>, names: string[] }>}
 */
export function stockFromPartLogs(partLogs) {
    /** @type {Map<string, { stok: number, equipment: Set<string>, names: string[] }>} */
    const acc = new Map();
    for (const row of Object.values(partLogs || {})) {
        const id = String(row?.partId ?? '').trim();
        if (!id) continue;
        const entry = acc.get(id) || { stok: 0, equipment: new Set(), names: [] };
        const qty = Number(row?.qty) || 0;
        if (String(row?.type || '').toUpperCase() === 'OUT') entry.stok -= qty;
        else entry.stok += qty;
        if (row?.equipmentId) entry.equipment.add(String(row.equipmentId));
        if (row?.partName) entry.names.push(String(row.partName));
        acc.set(id, entry);
    }
    return acc;
}

/**
 * Gabungkan semua sumber menjadi payload `SpareParts` siap-tinjau.
 * @param {{ requisitions?: Record<string, any>, partLogs?: Record<string, any> }} sources
 * @returns {{ parts: Record<string, any>, stats: { total: number, fromPartLogs: number, withoutName: number, withStock: number } }}
 */
export function buildSeed(sources = {}) {
    const fromReqs = namesFromRequisitions(sources.requisitions || {});
    const fromLogs = stockFromPartLogs(sources.partLogs || {});

    /** @type {Record<string, any>} */
    const parts = {};
    const ids = new Set([...fromReqs.keys(), ...fromLogs.keys()]);

    // Referensi di PartsUsed ikut dimasukkan supaya setelah seed tidak ada lagi
    // id menggantung — walau namanya belum diketahui (needsReview).
    for (const log of Object.values(sources.logs || {})) {
        for (const item of parsePartsUsed(log?.PartsUsed)) ids.add(item.id);
    }

    for (const id of ids) {
        const logEntry = fromLogs.get(id);
        const nameFromLog = logEntry?.names?.sort((a, b) => b.length - a.length)[0] || '';
        const namaPart = nameFromLog || fromReqs.get(id) || id;
        const stok = Math.max(0, logEntry?.stok ?? 0);

        parts[id] = {
            PartID: id,
            NamaPart: namaPart,
            Stok: stok,
            MinStock: 0,
            EquipmentIDs: [...(logEntry?.equipment ?? [])],
            isLowStock: false,
            seededFrom: nameFromLog ? 'partlog' : 'requisition',
            // Nama yang hanya berisi id berarti belum ada sumber nama resmi.
            needsReview: namaPart === id,
        };
    }

    const values = Object.values(parts);
    return {
        parts,
        stats: {
            total: values.length,
            fromPartLogs: values.filter((p) => p.seededFrom === 'partlog').length,
            withoutName: values.filter((p) => p.needsReview).length,
            withStock: values.filter((p) => p.Stok > 0).length,
        },
    };
}

/** @param {string[]} argv */
function parseArgs(argv) {
    /** @type {Record<string, string>} */
    const out = {};
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '';
    }
    return out;
}

/** @param {string} file */
function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.requisitions && !args.partlogs && !args.logs) {
        console.error(
            'Pemakaian: node scripts/plan-spare-parts-seed.mjs --requisitions <Requisitions.json> [--partlogs <SparePartLogs.json>] [--logs <HistoryLog.json>] [--out seed.json]'
        );
        process.exit(2);
    }

    const { parts, stats } = buildSeed({
        requisitions: args.requisitions ? readJson(args.requisitions) : {},
        partLogs: args.partlogs ? readJson(args.partlogs) : {},
        logs: args.logs ? readJson(args.logs) : {},
    });

    console.log('[seed] part unik        :', stats.total);
    console.log('[seed] nama dari partlog :', stats.fromPartLogs);
    console.log('[seed] belum ada nama   :', stats.withoutName);
    console.log('[seed] punya stok > 0   :', stats.withStock);
    console.log('[seed] contoh (10 pertama):');
    for (const part of Object.values(parts).slice(0, 10)) {
        console.log(`  - ${part.PartID} | ${part.NamaPart.slice(0, 60)} | stok ${part.Stok}`);
    }

    if (args.out) {
        fs.writeFileSync(args.out, JSON.stringify(parts, null, 2));
        console.log('[seed] payload ditulis ke', args.out, '(BELUM diterapkan ke RTDB)');
    }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('plan-spare-parts-seed.mjs')) main();
