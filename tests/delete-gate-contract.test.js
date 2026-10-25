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

/**
 * Tag `<div ...>` terdekat yang **membungkus** sebuah tombol.
 *
 * Gate tidak selalu duduk di tag tombolnya: di `Performance.html` kedua tombol
 * hapus berada di dalam `<div x-show="isAdminOrSupervisor">`. Pemeriksaan yang
 * hanya membaca tag `<button>` melaporkan "tanpa gate" padahal gate-nya ada di
 * induk — dan sebaliknya, menghapus induk itu tidak tertangkap tes mana pun.
 */
function enclosingDiv(html, index) {
    let i = index;
    let depth = 0;
    while (i > 0) {
        const close = html.lastIndexOf('</div>', i);
        const open = html.lastIndexOf('<div', i);
        if (open > close) {
            if (depth === 0) {
                const end = html.indexOf('>', open);
                return html.slice(open, end + 1);
            }
            depth -= 1;
            i = open;
        } else if (close >= 0) {
            depth += 1;
            i = close;
        } else {
            return '';
        }
    }
    return '';
}

/** Tombol + gate efektifnya: `x-show` di tag tombol, atau di div pembungkusnya. */
function gatedDeleteButtons(html, node) {
    const pattern = new RegExp(`<button[^>]*deleteItem\\('${node}'[^>]*>`, 'g');
    return [...html.matchAll(pattern)].map((m) => ({
        tag: m[0],
        gate: m[0].includes('x-show="') ? m[0] : enclosingDiv(html, m.index),
    }));
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

    // Dua node di bawah gate-nya duduk di `<div>` pembungkus, bukan di tag
    // `<button>`. Diuji lewat `gatedDeleteButtons` supaya menghapus div itu
    // langsung merah — bukan lolos karena tag tombolnya tidak diperiksa.
    const ancestorGated = [
        { node: 'Performance', file: 'public/pages/Performance.html' },
        { node: 'SpareParts', file: 'public/pages/SpareParts.html' },
    ];

    for (const { node, file } of ancestorGated) {
        it(`${node}: supervisor boleh menulis, gate boleh di induk tapi wajib ada`, () => {
            expect(writeRule(node)).toContain("'supervisor'");

            const buttons = gatedDeleteButtons(read(file), node);
            expect(buttons.length, `${file}: tombol hapus ${node} tidak ditemukan`).toBeGreaterThan(0);
            for (const { gate } of buttons) {
                expect(gate, `${file}: tombol hapus ${node} tanpa gate isAdminOrSupervisor`).toContain(
                    'x-show="isAdminOrSupervisor"'
                );
            }
        });
    }
});
