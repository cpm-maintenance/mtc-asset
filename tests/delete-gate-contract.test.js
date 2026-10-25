/**
 * Kontrak: tombol hapus yang **rules-nya mengizinkan supervisor** tidak boleh
 * disembunyikan dengan `x-show="isAdmin"`.
 *
 * Bug S38e: `database.rules.json` memberi `supervisor` hak tulis pada
 * `HistoryLog/$logId`, `Equipment/$equipmentId`, dan `Stats` — tetapi tombol
 * hapus di fragmen memakai `x-show="isAdmin"`, jadi supervisor tidak pernah
 * melihat tombolnya ("tidak bisa menghapus WO") padahal `deleteItem()` berhasil
 * bila dipanggil langsung (dibuktikan probe Playwright + emulator).
 *
 * Tes ini membaca fragmen **dan** `database.rules.json`, supaya gate UI dan
 * aturan tidak bisa menyimpang sendiri-sendiri.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const rules = JSON.parse(read('database.rules.json')).rules;

/** Semua tag pembuka yang memanggil `deleteItem('<node>', ...)`. */
function deleteButtons(html, node) {
    const pattern = new RegExp(`<button[^>]*deleteItem\\('${node}'[^>]*>`, 'g');
    return html.match(pattern) || [];
}

/** Aturan `.write` untuk node `<node>/<id>`. */
function writeRule(node) {
    const entry = rules[node];
    const child = Object.keys(entry).find((k) => k.startsWith('$'));
    return entry[child]['.write'];
}

describe('gate tombol hapus vs database.rules.json', () => {
    it('HistoryLog: supervisor boleh menulis, jadi tombolnya wajib terlihat', () => {
        expect(writeRule('HistoryLog')).toContain("'supervisor'");

        const fragments = ['public/pages/WorkOrders.html', 'public/pages/AllLogs.html'];
        for (const file of fragments) {
            const buttons = deleteButtons(read(file), 'HistoryLog');
            expect(buttons.length, `${file}: tombol hapus HistoryLog tidak ditemukan`).toBeGreaterThan(0);
            for (const btn of buttons) {
                expect(btn, `${file}: tombol hapus HistoryLog masih isAdmin`).toContain(
                    'x-show="isAdminOrSupervisor"'
                );
            }
        }
    });

    it('Equipment: supervisor boleh menulis, jadi tombolnya wajib terlihat', () => {
        expect(writeRule('Equipment')).toContain("'supervisor'");

        const buttons = deleteButtons(read('public/pages/EquipmentDetail.html'), 'Equipment');
        expect(buttons.length).toBeGreaterThan(0);
        for (const btn of buttons) {
            expect(btn).toContain('x-show="isAdminOrSupervisor"');
        }
    });
});
