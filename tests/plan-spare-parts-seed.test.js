/**
 * Unit test `scripts/plan-spare-parts-seed.mjs` (S38g).
 *
 * Skrip ini menyusun payload master `SpareParts` dari data operator. Yang dikunci:
 * nama diambil dari sumber terlengkap, stok dihitung IN − OUT (tidak pernah
 * negatif), dan id yang belum punya nama ditandai `needsReview` — bukan diisi
 * nama karangan.
 */
import { describe, it, expect } from 'vitest';
import { buildSeed, namesFromRequisitions, stockFromPartLogs } from '../scripts/plan-spare-parts-seed.mjs';

describe('namesFromRequisitions', () => {
    it('memilih nama terpanjang untuk id yang sama', () => {
        const names = namesFromRequisitions({
            R1: { items: [{ partId: 'P-1', itemName: 'Seal' }] },
            R2: { items: [{ partId: 'P-1', itemName: 'Seal Mechanical 45mm' }] },
        });

        expect(names.get('P-1')).toBe('Seal Mechanical 45mm');
    });

    it('membuang item tanpa partId', () => {
        const names = namesFromRequisitions({ R1: { items: [{ partId: '', itemName: 'X' }] } });

        expect(names.size).toBe(0);
    });

    it('aman untuk requisition tanpa items', () => {
        expect(namesFromRequisitions({ R1: {}, R2: null }).size).toBe(0);
    });
});

describe('stockFromPartLogs', () => {
    it('menghitung IN dikurangi OUT dan mengumpulkan equipment', () => {
        const acc = stockFromPartLogs({
            L1: { partId: 'P-1', qty: 5, type: 'IN', equipmentId: 'EQ-1', partName: 'Seal' },
            L2: { partId: 'P-1', qty: 2, type: 'OUT', equipmentId: 'EQ-2' },
        });

        expect(acc.get('P-1').stok).toBe(3);
        expect([...acc.get('P-1').equipment].sort()).toEqual(['EQ-1', 'EQ-2']);
        expect(acc.get('P-1').names).toEqual(['Seal']);
    });

    it('mengabaikan baris tanpa partId', () => {
        expect(stockFromPartLogs({ L1: { qty: 5, type: 'IN' } }).size).toBe(0);
    });
});

describe('buildSeed', () => {
    it('menggabungkan nama requisition dengan stok partlog', () => {
        const { parts, stats } = buildSeed({
            requisitions: { R1: { items: [{ partId: '2810-CV-009', itemName: 'Gearbox;H5Y307-20' }] } },
            partLogs: { L1: { partId: '2810-CV-009', qty: 1, type: 'IN', equipmentId: '2810-CV-009' } },
        });

        expect(stats).toMatchObject({ total: 1, fromPartLogs: 0, withoutName: 0, withStock: 1 });
        expect(parts['2810-CV-009']).toMatchObject({
            PartID: '2810-CV-009',
            NamaPart: 'Gearbox;H5Y307-20',
            Stok: 1,
            MinStock: 0,
            EquipmentIDs: ['2810-CV-009'],
            needsReview: false,
        });
    });

    it('memprioritaskan partName dari partlog', () => {
        const { parts } = buildSeed({
            requisitions: { R1: { items: [{ partId: 'P-1', itemName: 'Nama Pendek' }] } },
            partLogs: { L1: { partId: 'P-1', qty: 1, type: 'IN', partName: 'Nama Lengkap Dari Log' } },
        });

        expect(parts['P-1'].NamaPart).toBe('Nama Lengkap Dari Log');
        expect(parts['P-1'].seededFrom).toBe('partlog');
    });

    it('menandai needsReview saat nama belum ada, tanpa mengarang', () => {
        const { parts, stats } = buildSeed({ requisitions: { R1: { items: [{ partId: 'P-9', itemName: '' }] } } });

        expect(parts['P-9'].NamaPart).toBe('P-9');
        expect(parts['P-9'].needsReview).toBe(true);
        expect(stats.withoutName).toBe(1);
    });

    it('stok tidak pernah negatif', () => {
        const { parts } = buildSeed({ partLogs: { L1: { partId: 'P-1', qty: 4, type: 'OUT' } } });

        expect(parts['P-1'].Stok).toBe(0);
    });

    it('ikut memasukkan id dari PartsUsed walau namanya belum ada', () => {
        const { parts, stats } = buildSeed({
            requisitions: { R1: { items: [{ partId: 'P-011', itemName: 'Pump' }] } },
            logs: { L1: { PartsUsed: [{ id: 'P-010', qty: 1 }] } },
        });

        expect(Object.keys(parts).sort()).toEqual(['P-010', 'P-011']);
        expect(parts['P-010']).toMatchObject({ NamaPart: 'P-010', needsReview: true });
        expect(stats.withoutName).toBe(1);
    });

    it('aman tanpa sumber apa pun', () => {
        expect(buildSeed().stats.total).toBe(0);
    });
});
