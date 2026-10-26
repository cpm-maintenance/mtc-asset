// @vitest-environment jsdom
/**
 * Aksi QR per kartu aset di menu Equipment (S45).
 *
 * Sebelumnya kartu tag hanya bisa dibuka dari **detail** aset: kartu Equipment
 * seluruhnya adalah target navigasi (`@click="goToDetail(...)"`), jadi butuh
 * dua klik untuk satu label. Kontrak yang dijaga di sini:
 *
 *  · kartu aset punya tombol QR sendiri, dan kliknya **tidak** ikut
 *    menavigasi (`@click.stop`);
 *  · tombol memakai ikon subset `qr_code_scanner` + `aria-label` **statis**
 *    (nama tidak boleh hanya bergantung pada `x-text`, pembaca layar butuh
 *    label yang ada sejak markup);
 *  · target sentuh ≥ 24×24 px;
 *  · `openEquipQR()` mengisi `selectedEquip` **sebelum** `generateQR()` —
 *    kartu tag membaca `selectedEquip` untuk ID/nama/lokasi, jadi urutan ini
 *    yang menentukan stiker tercetak lengkap atau kosong.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { uiModule } from '../src/js/modules/ui.js';

const equip = readFileSync(resolve(process.cwd(), 'public/pages/Equipment.html'), 'utf8');

/** Potongan markup satu kartu aset (grid stream), tanpa skeleton/tree. */
function cardTemplate() {
    // Batas diambil dari `<article>`, bukan `</template>` pertama: di dalam
    // kartu ada `<template x-if="e.FotoURL …">` yang menutup lebih dulu.
    const start = equip.indexOf('<article @click="goToDetail');
    expect(start).toBeGreaterThan(-1);
    const end = equip.indexOf('</article>', start);
    expect(end).toBeGreaterThan(start);
    return equip.slice(start, end);
}

describe('Equipment — aksi QR per kartu', () => {
    const card = cardTemplate();

    it('kartu memuat tombol QR yang memanggil openEquipQR dengan id aset', () => {
        expect(card).toMatch(/@click\.stop="openEquipQR\(e\.EquipmentID\)"/);
    });

    it('klik tombol tidak menavigasi: kartu tetap target goToDetail', () => {
        expect(card).toContain('@click="goToDetail(e.EquipmentID)"');
        // Hanya satu tombol di kartu, dan ia ber-`.stop` — kalau ada tombol
        // lain tanpa `.stop`, klik label akan membuka detail sekaligus.
        const buttons = card.match(/<button\b[^>]*>/g) || [];
        expect(buttons).toHaveLength(1);
        expect(buttons[0]).toContain('@click.stop');
    });

    it('label aksesibilitas statis, bukan hanya dari x-text', () => {
        expect(card).toMatch(/aria-label="[^"{][^"]*"/);
        expect(card).not.toContain(':aria-label');
        expect(card).toContain('title="Buka kartu tag QR"');
    });

    it('memakai ikon subset qr_code_scanner', () => {
        const subset = readFileSync(resolve(process.cwd(), 'src/css/icon-subset.txt'), 'utf8');
        expect(subset.split(/\s+/)).toContain('qr_code_scanner');
        expect(card).toContain('>qr_code_scanner<');
    });

    it('target sentuh ≥ 24×24 px', () => {
        const button = (card.match(/<button\b[^>]*>/g) || [''])[0];
        const h = /h-(\d+)/.exec(button);
        const w = /w-(\d+)/.exec(button);
        expect(h, 'tombol harus punya tinggi eksplisit').not.toBeNull();
        expect(w, 'tombol harus punya lebar eksplisit').not.toBeNull();
        // Skala Tailwind: 1 unit = 0.25rem = 4 px.
        expect(Number(h[1]) * 4).toBeGreaterThanOrEqual(24);
        expect(Number(w[1]) * 4).toBeGreaterThanOrEqual(24);
    });
});

describe('openEquipQR', () => {
    const equipment = [
        { EquipmentID: 'EQ-1', Nama: 'Pompa', Lokasi: 'Area A' },
        { EquipmentID: 'EQ-2', Nama: 'Crusher', Lokasi: 'Area B' },
    ];

    it('mengisi selectedEquip lalu memanggil generateQR dengan id yang sama', async () => {
        const seen = [];
        const ctx = {
            equipment,
            selectedEquip: { EquipmentID: 'EQ-2', Nama: 'Crusher' },
            generateQR: vi.fn(async (id) => {
                // Urutan penting: saat QR dibuat, selectedEquip harus sudah
                // menunjuk aset yang benar.
                seen.push({ id, name: ctx.selectedEquip?.Nama });
            }),
        };

        await uiModule.openEquipQR.call(ctx, 'EQ-1');

        expect(seen).toEqual([{ id: 'EQ-1', name: 'Pompa' }]);
        expect(ctx.selectedEquip).toMatchObject({ EquipmentID: 'EQ-1', Lokasi: 'Area A' });
    });

    it('id tak dikenal: selectedEquip tidak dirusak, QR tetap dibuat', async () => {
        const ctx = {
            equipment,
            selectedEquip: { EquipmentID: 'EQ-2', Nama: 'Crusher' },
            generateQR: vi.fn(async () => {}),
        };

        await uiModule.openEquipQR.call(ctx, 'EQ-GHOST');

        expect(ctx.selectedEquip).toMatchObject({ EquipmentID: 'EQ-2' });
        expect(ctx.generateQR).toHaveBeenCalledWith('EQ-GHOST');
    });

    it('equipment belum dimuat (null): tidak melempar', async () => {
        const ctx = { equipment: null, selectedEquip: null, generateQR: vi.fn(async () => {}) };
        await expect(uiModule.openEquipQR.call(ctx, 'EQ-1')).resolves.toBeUndefined();
        expect(ctx.generateQR).toHaveBeenCalledWith('EQ-1');
    });
});
