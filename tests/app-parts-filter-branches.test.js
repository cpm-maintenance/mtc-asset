// @vitest-environment jsdom
/**
 * Cabang filter/sort master part di `app.js` (S39, Langkah 3).
 *
 * Semua tes lama memberi `allParts` berisi record lengkap dan tanpa filter,
 * jadi sisi kanan setiap `x || ''`, cabang `EquipmentIDs` berbentuk string,
 * dan tiga nilai `partStatusFilter` tidak pernah dieksekusi. Fixture di sini
 * sengaja tidak lengkap supaya jalur fallback-nya ikut jalan.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../src/js/app.js';
import { makeApp } from './helpers/app-harness.js';

const PARTS = [
    {
        PartID: 'P-1',
        NamaPart: 'Gearbox',
        NamaSingkat: 'GB',
        PartNumber: 'H5Y307',
        Lokasi: 'Area A',
        Stok: 5,
        MinStock: 2,
        Harga: 1000,
        EquipmentIDs: ['EQ-1'],
    },
    // EquipmentIDs berupa string tunggal (bentuk data lama), tanpa Harga
    { PartID: 'P-2', NamaPart: 'Roller', Stok: 0, MinStock: 1, EquipmentIDs: 'EQ-2' },
    // EquipmentID tunggal, MinStock 0 → selalu "optimal"
    { PartID: 'P-3', NamaPart: 'Seal', Stok: 3, MinStock: 0, Harga: 0, EquipmentID: 'EQ-3' },
];

const partsApp = (over = {}) => makeApp({ allParts: PARTS, ...over });
const ids = (rows) => rows.map((p) => p.PartID);

describe('filteredAllParts — guard dan pencarian', () => {
    it('allParts bukan array → daftar kosong', () => {
        expect(makeApp({ allParts: null }).filteredAllParts).toEqual([]);
        expect(makeApp({ allParts: 'x' }).filteredAllParts).toEqual([]);
        expect(makeApp({ allParts: undefined }).filteredAllParts).toEqual([]);
    });

    it('record null di allParts dilewati, bukan melempar', () => {
        const s = makeApp({ allParts: [null, PARTS[0]] });
        expect(ids(s.filteredAllParts)).toEqual(['P-1']);
        expect(s.filteredAllPartsCount).toBe(1);
    });

    it('search mencocokkan nama, id, nama singkat, part number, dan lokasi', () => {
        const hit = (q) => ids(partsApp({ searchPart: q }).filteredAllParts);
        expect(hit('gear')).toEqual(['P-1']); // NamaPart
        expect(hit('p-2')).toEqual(['P-2']); // PartID
        expect(hit('gb')).toEqual(['P-1']); // NamaSingkat
        expect(hit('h5y')).toEqual(['P-1']); // PartNumber
        expect(hit('area a')).toEqual(['P-1']); // Lokasi
        expect(hit('tidak-ada')).toEqual([]);
        expect(hit('')).toEqual(['P-1', 'P-2', 'P-3']); // `!searchLower` = true
    });
});

describe('filteredAllParts — filter equipment', () => {
    it('EquipmentIDs array, string tunggal, dan EquipmentID semuanya terbaca', () => {
        expect(ids(partsApp({ partFilterEquip: 'EQ-1' }).filteredAllParts)).toEqual(['P-1']);
        expect(ids(partsApp({ partFilterEquip: 'EQ-2' }).filteredAllParts)).toEqual(['P-2']);
        expect(ids(partsApp({ partFilterEquip: 'EQ-3' }).filteredAllParts)).toEqual(['P-3']);
        expect(partsApp({ partFilterEquip: 'EQ-X' }).filteredAllParts).toEqual([]);
        expect(partsApp({ partFilterEquip: '' }).filteredAllParts).toHaveLength(3);
    });
});

describe('filteredAllParts — status stok', () => {
    it('low: hanya part yang punya MinStock dan stok <= MinStock', () => {
        // P-2 (0 <= 1) masuk; P-3 punya MinStock 0 jadi tidak pernah "low".
        expect(ids(partsApp({ partStatusFilter: 'low' }).filteredAllParts)).toEqual(['P-2']);
        expect(partsApp({ partStatusFilter: 'low' }).filteredAllPartsCount).toBe(1);
    });

    it('zero: hanya stok 0', () => {
        expect(ids(partsApp({ partStatusFilter: 'zero' }).filteredAllParts)).toEqual(['P-2']);
        expect(partsApp({ partStatusFilter: 'zero' }).filteredAllPartsCount).toBe(1);
    });

    it('optimal: MinStock 0 atau stok di atas MinStock', () => {
        expect(ids(partsApp({ partStatusFilter: 'optimal' }).filteredAllParts)).toEqual(['P-1', 'P-3']);
        expect(partsApp({ partStatusFilter: 'optimal' }).filteredAllPartsCount).toBe(2);
    });

    it('status tak dikenal mengembalikan semua', () => {
        expect(partsApp({ partStatusFilter: 'lain' }).filteredAllParts).toHaveLength(3);
        expect(partsApp({ partStatusFilter: 'lain' }).filteredAllPartsCount).toBe(3);
    });
});

describe('filteredAllParts — urutan dan paginasi', () => {
    it('stock_asc / stock_desc mengurutkan menurut Stok', () => {
        expect(ids(partsApp({ partSortBy: 'stock_asc' }).filteredAllParts)).toEqual(['P-2', 'P-3', 'P-1']);
        expect(ids(partsApp({ partSortBy: 'stock_desc' }).filteredAllParts)).toEqual(['P-1', 'P-3', 'P-2']);
    });

    it('value memakai Stok × Harga dan memperlakukan Harga hilang sebagai 0', () => {
        // P-1 = 5 × 1000 = 5000; P-3 = 3 × 0 = 0; P-2 tanpa Harga → 0.
        // Sort menurun dan stabil, jadi dua nilai 0 tetap di urutan aslinya.
        expect(ids(partsApp({ partSortBy: 'value' }).filteredAllParts)).toEqual(['P-1', 'P-2', 'P-3']);
    });

    it('sortir default memakai NamaPart', () => {
        expect(ids(partsApp({ partSortBy: 'nama' }).filteredAllParts)).toEqual(['P-1', 'P-2', 'P-3']);
        expect(ids(partsApp({}).filteredAllParts)).toEqual(['P-1', 'P-2', 'P-3']);
    });

    it('partLimit memotong hasil dan canLoadMoreParts membandingkan jumlah terfilter', () => {
        const s = partsApp({ partLimit: 1 });
        expect(ids(s.filteredAllParts)).toEqual(['P-1']);
        expect(s.canLoadMoreParts).toBe(true);

        const all = partsApp({ partLimit: 30 });
        expect(all.canLoadMoreParts).toBe(false);
        expect(makeApp({ allParts: null }).canLoadMoreParts).toBe(false);
    });
});

describe('_partMap', () => {
    it('membangun peta sekali, melewati record null, dan membangun ulang saat allParts berganti', () => {
        const s = makeApp({ allParts: [null, ...PARTS] });
        const first = s._partMap();
        expect([...first.keys()]).toEqual(['P-1', 'P-2', 'P-3']);
        expect(s._partMap()).toBe(first); // cache dipakai

        s.allParts = [PARTS[0]];
        expect([...s._partMap().keys()]).toEqual(['P-1']);
    });
});

describe('state awal dari localStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('sidebarExpandedGroups memakai objek tersimpan bila valid', () => {
        localStorage.setItem('sidebarGroups', JSON.stringify({ Maintenance: true }));
        expect(app().sidebarExpandedGroups).toEqual({ Maintenance: true });
    });

    it('sidebarExpandedGroups jatuh ke default saat JSON rusak atau kosong', () => {
        localStorage.setItem('sidebarGroups', '{bukan json');
        expect(app().sidebarExpandedGroups).toEqual({ Maintenance: false, 'Logs & Reports': false });
        localStorage.removeItem('sidebarGroups');
        expect(app().sidebarExpandedGroups).toEqual({ Maintenance: false, 'Logs & Reports': false });
    });
});
