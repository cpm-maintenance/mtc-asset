// @vitest-environment jsdom
/**
 * Asset tag QR (S42): modal preview + label cetak harus berdesain kartu tag,
 * bukan QR telanjang.
 *
 * Kontrak yang dijaga:
 *  · modal memuat kata **SCAN ME** + kalimat penjelas, bingkai sudut emas, dan
 *    tetap memakai `qrCodeDataUrl` sebagai sumber gambar;
 *  · tombol unduh/cetak tetap ada dan ber-aria-label;
 *  · QR dibuat dengan `errorCorrectionLevel: 'H'` — badge tengah "MTC"
 *    menutup sebagian kode, dan tanpa redundansi tinggi scanner bisa gagal;
 *  · ada jalur fallback: kalau canvas tidak tersedia, QR polos tetap dipakai.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const shell = readFileSync(resolve(process.cwd(), 'public/pages/app-shell.html'), 'utf8');
const ui = readFileSync(resolve(process.cwd(), 'src/js/modules/ui.js'), 'utf8');

/** Potongan markup modal QR preview. */
function qrModal() {
    const start = shell.indexOf('<template x-if="showQRPreviewModal">');
    const end = shell.indexOf('</template>', start);
    return shell.slice(start, end);
}

describe('modal Asset Tag', () => {
    const modal = qrModal();

    it('memuat SCAN ME + penjelas bahasa Inggris', () => {
        expect(modal).toMatch(/>\s*Scan Me\s*</i);
        expect(modal).toContain('for detail information');
    });

    it('tidak lagi memuat kata "work order" di kartu tag', () => {
        expect(modal.toLowerCase()).not.toContain('work order');
    });

    it('memakai gambar QR dari state dan memberi alt', () => {
        expect(modal).toContain(':src="qrCodeDataUrl"');
        expect(modal).toContain('alt="Asset QR code"');
    });

    it('menampilkan identitas aset: ID, nama, lokasi', () => {
        expect(modal).toContain('selectedEquip?.EquipmentID');
        expect(modal).toContain('selectedEquip?.Nama');
        expect(modal).toContain('selectedEquip?.Lokasi');
    });

    it('tidak menampilkan status aset (Active/Operational) di kartu', () => {
        expect(modal).not.toContain('selectedEquip?.Status');
    });

    it('semua teks kartu huruf kapital', () => {
        // Kelas `uppercase` wajib ada di baris yang isinya bisa huruf kecil:
        // penjelas, ID, nama aset, dan lokasi.
        for (const needle of [
            'uppercase leading-tight tracking-[0.08em] text-[rgb(var(--tag-muted))]">for detail information',
            'uppercase tracking-[0.18em] text-[rgb(var(--tag-ink))]',
            'uppercase leading-tight tracking-[0.02em] text-[rgb(var(--tag-ink))]',
        ]) {
            expect(modal).toContain(needle);
        }
        expect(modal).toContain('text-[10px] uppercase tracking-[0.08em]');
    });

    it('punya bingkai sudut (4 penanda) dan garis emas atas', () => {
        const corners = modal.match(/border-\[rgb\(var\(--tag-gold\)\)\]/g) || [];
        expect(corners.length).toBeGreaterThanOrEqual(4);
        expect(modal).toContain('bg-gradient-to-r');
    });

    it('memakai token `.asset-tag`, bukan putih/hex hardcoded', () => {
        expect(modal).toContain('asset-tag');
        expect(modal).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(modal).not.toContain('bg-white');
    });

    it('tombol tutup, simpan, dan cetak tetap ada', () => {
        expect(modal).toContain('aria-label="Close QR preview"');
        expect(modal).toContain('@click="downloadQR()"');
        expect(modal).toContain('window.print()');
    });
});

describe('pembuatan QR', () => {
    it('memakai error correction H (toleran badge tengah)', () => {
        expect(ui).toContain("errorCorrectionLevel: 'H'");
    });

    it('menggambar badge MTC di tengah QR', () => {
        expect(ui).toContain("fillText('MTC'");
        expect(ui).toContain('buildAssetTagImage');
    });

    it('punya fallback ke QR polos bila canvas tidak tersedia', () => {
        expect(ui).toMatch(/if \(!ctx\) return plain;/);
        expect(ui).toMatch(/\} catch \{\s*return plain;/);
    });

    it('label cetak bulk memuat SCAN ME dan bingkai tag', () => {
        expect(ui).toContain("doc.text('SCAN ME'");
        expect(ui).toContain('doc.roundedRect(x0, y0, tagW, tagH, 3, 3');
    });
});
