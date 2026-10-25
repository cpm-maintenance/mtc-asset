/**
 * Kontrak: setiap transaksi stok `SpareParts/<id>/Stok` wajib menolak part yang
 * tidak ada dan qty yang bukan angka positif.
 *
 * Bug S38f (`Restore parts stock error: permission_denied`): transaksi menulis
 * `Stok` untuk part yang tidak ada, sehingga `.validate` node part
 * (`hasChildren(['NamaPart','Stok','MinStock'])`) gagal. Tiga lokasi menulis stok
 * harus memakai bentuk yang sama — tes ini membaca sumbernya supaya satu lokasi
 * tidak tertinggal saat kode baru ditambah.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const FILES = ['src/js/modules/data.js', 'src/js/modules/logs.js'];

/** Potongan kode sesudah setiap penyebutan path transaksi stok. */
function transactionSites() {
    const sites = [];
    for (const file of FILES) {
        const src = read(file);
        const marker = "'SpareParts/' + p.id + '/Stok'";
        let from = 0;
        for (;;) {
            const at = src.indexOf(marker, from);
            if (at === -1) break;
            sites.push({ file, snippet: src.slice(at, at + 1200) });
            from = at + marker.length;
        }
    }
    return sites;
}

describe('guard transaksi stok SpareParts', () => {
    it('menemukan ketiga lokasi penulisan stok', () => {
        expect(transactionSites().length).toBe(3);
    });

    it('setiap lokasi membatalkan transaksi untuk part yang tidak ada', () => {
        for (const { file, snippet } of transactionSites()) {
            expect(snippet, `${file}: guard curr === null hilang`).toContain('curr === null');
        }
    });

    it('setiap lokasi menolak qty yang bukan angka positif', () => {
        for (const { file, snippet } of transactionSites()) {
            expect(snippet, `${file}: guard Number.isFinite hilang`).toContain('Number.isFinite(qty)');
        }
    });

    it('setiap lokasi meng-clamp stok agar tidak negatif', () => {
        for (const { file, snippet } of transactionSites()) {
            expect(snippet, `${file}: Math.max hilang`).toContain('Math.max(0');
        }
    });
});
