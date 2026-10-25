/**
 * Unit test `scripts/audit-dangling-parts.mjs` (S38g).
 *
 * Skrip ini dipakai untuk memutuskan data mana yang perlu diperbaiki manual, jadi
 * dua hal yang paling penting dikunci: parsing `PartsUsed` bentuk legacy (array,
 * string JSON, string ter-encode dua kali) dan definisi "part ada" (key RTDB
 * **atau** field `PartID`).
 */
import { describe, it, expect } from 'vitest';
import { findDanglingParts, parsePartsUsed } from '../scripts/audit-dangling-parts.mjs';

describe('parsePartsUsed', () => {
    it('membaca array objek', () => {
        expect(parsePartsUsed([{ id: 'P1', qty: 2 }])).toEqual([{ id: 'P1', qty: 2 }]);
    });

    it('membaca string JSON', () => {
        expect(parsePartsUsed('[{"id":"P1","qty":3}]')).toEqual([{ id: 'P1', qty: 3 }]);
    });

    it('membaca string yang ter-encode dua kali', () => {
        const double = JSON.stringify(JSON.stringify([{ id: 'P2', qty: 1 }]));
        expect(parsePartsUsed(double)).toEqual([{ id: 'P2', qty: 1 }]);
    });

    it('menganggap bentuk rusak / kosong sebagai daftar kosong', () => {
        expect(parsePartsUsed(undefined)).toEqual([]);
        expect(parsePartsUsed('')).toEqual([]);
        expect(parsePartsUsed('[]')).toEqual([]);
        expect(parsePartsUsed('{bukan json')).toEqual([]);
        expect(parsePartsUsed({ id: 'P1' })).toEqual([]);
    });

    it('membuang entri tanpa id dan memberi qty default 0', () => {
        expect(parsePartsUsed([{ id: '', qty: 5 }, { id: 'P1' }])).toEqual([{ id: 'P1', qty: 0 }]);
    });
});

describe('findDanglingParts', () => {
    const parts = {
        'KEY-1': { PartID: 'KEY-1', NamaPart: 'Seal', Stok: 1, MinStock: 2 },
        'KEY-2': { PartID: 'PID-2', NamaPart: 'Bearing', Stok: 4, MinStock: 1 },
    };

    it('menemukan referensi ke part yang tidak ada', () => {
        const logs = { L1: { woNumber: 'WO-1', PartsUsed: [{ id: 'GHOST', qty: 2 }] } };

        const res = findDanglingParts(logs, parts);

        expect(res.logsScanned).toBe(1);
        expect(res.refsScanned).toBe(1);
        expect(res.dangling).toEqual([{ logId: 'L1', woNumber: 'WO-1', partId: 'GHOST', qty: 2 }]);
        expect(res.missing[0]).toMatchObject({ partId: 'GHOST', refs: 1, qty: 2, logs: ['L1'] });
    });

    it('menerima part yang cocok lewat key RTDB maupun field PartID', () => {
        const logs = {
            L1: {
                PartsUsed: [
                    { id: 'KEY-1', qty: 1 },
                    { id: 'PID-2', qty: 3 },
                ],
            },
        };

        const res = findDanglingParts(logs, parts);

        expect(res.refsScanned).toBe(2);
        expect(res.dangling).toEqual([]);
    });

    it('mengagregasi beberapa log yang menunjuk id sama', () => {
        const logs = {
            L1: { PartsUsed: '[{"id":"GHOST","qty":1}]' },
            L2: { PartsUsed: [{ id: 'GHOST', qty: 4 }] },
            L3: { PartsUsed: [{ id: 'KEY-1', qty: 9 }] },
        };

        const res = findDanglingParts(logs, parts);

        expect(res.missing).toHaveLength(1);
        expect(res.missing[0]).toMatchObject({ partId: 'GHOST', refs: 2, qty: 5 });
        expect(res.missing[0].logs).toEqual(['L1', 'L2']);
    });

    it('aman untuk koleksi kosong atau log tanpa PartsUsed', () => {
        expect(findDanglingParts({}, {})).toMatchObject({ logsScanned: 0, refsScanned: 0, dangling: [] });
        expect(findDanglingParts({ L1: {} }, parts)).toMatchObject({ logsScanned: 1, refsScanned: 0 });
    });
});
