// @vitest-environment jsdom
/**
 * Tata letak modal "New System Entry" (form log/WO) — S39f.
 *
 * Sebelum dirapikan, satu modal memakai empat ukuran label berbeda
 * (`text-[8px]`, `text-[9px]`, `text-[10px]`, token 12px) dan dua tinggi
 * kontrol (`p-3` 40 px vs `p-4` 48 px) padahal lapisan token `--field-h`
 * sudah menetapkan 44 px untuk semua kontrol. Label 8–9 px juga di bawah
 * ambang keterbacaan 12 px yang dipakai audit Lighthouse.
 *
 * Tes ini membaca fragmen dan mengunci invariannya, bukan tampilan pixel:
 * ukuran sebenarnya diverifikasi di build (`:is(input…) { height: var(--field-h) }`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const shell = readFileSync(resolve(process.cwd(), 'public/pages/app-shell.html'), 'utf8');

function modalMarkup() {
    const start = shell.indexOf('x-if="showLogModal"');
    const end = shell.indexOf('</form>', start);
    return shell.slice(start, end);
}

const modal = modalMarkup();

describe('modal New System Entry — tata letak konsisten', () => {
    it('setiap label memakai token 12px, bukan ukuran ad-hoc', () => {
        const labels = [...modal.matchAll(/<label class="([^"]*)"/g)].map((m) => m[1]);
        expect(labels.length).toBeGreaterThanOrEqual(15);
        for (const cls of labels) {
            expect(cls, `label tanpa token: ${cls}`).toContain('font-label-mono-sm');
            expect(cls, `label masih kecil: ${cls}`).not.toMatch(/text-\[(8|9|10)px\]/);
        }
    });

    it('tidak ada label teks di bawah 12px di seluruh modal', () => {
        expect(modal).not.toMatch(/text-\[8px\]/);
        expect(modal).not.toMatch(/text-\[9px\]/);
        // text-[10px] hanya boleh tersisa pada ikon di dalam tombol hapus foto.
        const small = [...modal.matchAll(/text-\[10px\]/g)];
        expect(small.length).toBeLessThanOrEqual(1);
    });

    it('kontrol tidak memaksa padding sendiri — tinggi diatur token --field-h', () => {
        const controls = [...modal.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)].map((m) => m[0]);
        expect(controls.length).toBeGreaterThanOrEqual(18);
        for (const tag of controls) {
            expect(tag, `kontrol dengan padding ad-hoc: ${tag.slice(0, 60)}`).not.toMatch(/\bp-[34]\b/);
        }
    });

    it('setiap blok x-show punya x-cloak supaya tidak berkedip sebelum Alpine boot', () => {
        const shown = [...modal.matchAll(/<[a-z]+[^>]*\sx-show="[^"]*"[^>]*>/gs)].map((m) => m[0]);
        expect(shown.length).toBeGreaterThanOrEqual(4);
        for (const tag of shown) {
            expect(tag, `x-show tanpa x-cloak: ${tag.slice(0, 60)}`).toContain('x-cloak');
        }
    });

    it('empat grup punya judul yang seragam', () => {
        const headers = [...modal.matchAll(/<h4 class="([^"]*)">([^<]*)</g)].map((m) => ({ cls: m[1], text: m[2].trim() }));
        expect(headers).toHaveLength(4);
        expect(headers.map((h) => h.text)).toEqual([
            '🗂️ Asset &amp; Activity',
            '⚡ Work Order Settings',
            '🏢 Department Request',
            '🧠 Diagnosis &amp; Briefing',
        ]);
        for (const h of headers) {
            expect(h.cls).toContain('font-label-mono-md');
        }
    });
});

describe('modal New System Entry — tata letak desktop (S39h)', () => {
    it('seksi 4-field memakai grid 2 kolom (form-grid--two), bukan 3 kolom penuh', () => {
        const twoCol = [...modal.matchAll(/class="form-grid form-grid--two[^"]*"/g)];
        expect(twoCol.length).toBe(4);
    });

    it('footer aksi menempel di dasar modal', () => {
        expect(modal).toContain('sticky bottom-0');
        expect(modal).toContain(':disabled="!isLogFormValid"');
        expect(modal).toContain('x-text="logFormErrorCount');
    });

    it('seksi Department Request terlipat (<details>) dan ditandai opsional', () => {
        const i = modal.indexOf('Department Request Section (opsional, terlipat)');
        expect(i).toBeGreaterThan(-1);
        const end = modal.indexOf('</details>', i);
        expect(end, 'penutup </details> tidak ditemukan').toBeGreaterThan(i);
        const block = modal.slice(i, end);
        expect(block).toContain('<details');
        expect(block).toContain('<summary');
        expect(block).toContain('Opsional · 4 field');
        // keempat field Department Request ada di dalam blok terlipat
        expect(block).toContain('logForm.requestSource');
        expect(block).toContain('logForm.approvedBy');
    });

    it('tiga field wajib bertanda * dan aria-required', () => {
        expect(modal.match(/aria-hidden="true">\*<\/span>/g)).toHaveLength(3);
        expect(modal.match(/aria-required="true"/g)).toHaveLength(3);
    });

    it('field numerik rata kanan dengan satuan di dalam field', () => {
        for (const unit of ['hrs', '$', 'HM']) {
            expect(modal).toContain(`>${unit}</span>`);
        }
        expect(modal.match(/text-right font-label-mono-md/g)).toHaveLength(5);
    });

    it('setiap pesan error punya x-show + x-text dan tidak tampil sebelum boot', () => {
        for (const key of ['equipmentId', 'date', 'desc', 'dueDate', 'estimatedHours', 'actualHours']) {
            const show = modal.match(new RegExp(`x-show="logFormErrors\\.${key}"`, 'g')) || [];
            const text = modal.match(new RegExp(`x-text="logFormErrors\\.${key}"`, 'g')) || [];
            expect(show.length, `x-show ${key}`).toBe(1);
            expect(text.length, `x-text ${key}`).toBe(1);
        }
        expect(modal.match(/logFormErrors\.[a-zA-Z]+" x-text="logFormErrors/g)).toBeTruthy();
    });
});
