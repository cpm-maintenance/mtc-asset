// @vitest-environment jsdom
/**
 * Tautan aset (`?equip=<ID>`) — payload QR stiker + titik masuknya di app.
 *
 * Sebelum ini QR hanya memuat ID telanjang (`EQ-001`): kamera ponsel tidak bisa
 * membukanya, jadi teks "FOR DETAILED INFORMATION" di stiker tidak pernah benar.
 * Sekarang payload-nya tautan penuh dan app membuka unitnya sendiri saat
 * tautan itu dibuka — termasuk setelah login, karena daftar aset datang dari
 * listener RTDB yang belum tiba saat gate dibuka.
 *
 * Stiker lama harus tetap terbaca: `equipIdFromLink()` menerima ID telanjang
 * (entri manual / stiker yang sudah tertempel) di samping bentuk URL.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('qrcode', () => ({
    default: { toDataURL: vi.fn(async (text) => `data:image/png;base64,MOCK:${text}`) },
}));

import QRCode from 'qrcode';
import { equipTagLink, equipIdFromLink } from '../src/js/utils.js';
import { uiModule } from '../src/js/modules/ui.js';

/** Konteks minimum untuk method uiModule yang diuji. */
function makeCtx(overrides = {}) {
    return Object.assign(
        {
            equipment: [],
            selectedEquip: null,
            isLoading: false,
            qrCodeDataUrl: '',
            showQRPreviewModal: false,
            showNotification: vi.fn(),
            stopScanner: vi.fn(),
            goToDetail: vi.fn(),
            // Jalur hasil asli dipakai supaya "titik masuk yang sama dengan scanner"
            // benar-benar diuji, bukan sekadar dipanggil.
            handleScanResult: uiModule.handleScanResult,
        },
        overrides
    );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('equipTagLink — origin app yang mencetak stiker', () => {
    it('memakai origin halaman', () => {
        expect(equipTagLink('EQ-1')).toBe(`${globalThis.location.origin}/?equip=EQ-1`);
    });

    it('meng-encode ID yang memuat karakter khusus', () => {
        expect(equipTagLink('EQ 1/2')).toContain('equip=EQ%201%2F2');
    });

    it('origin bisa diinjeksi — stiker dari preview channel menunjuk ke sana', () => {
        expect(equipTagLink('EQ-1', 'https://mtc-asset.web.app')).toBe('https://mtc-asset.web.app/?equip=EQ-1');
    });
});

describe('equipIdFromLink — satu pembaca untuk QR, tautan, dan entri manual', () => {
    it('menerima stiker lama: ID telanjang, dinormalkan huruf besar', () => {
        expect(equipIdFromLink('  eq-001 ')).toBe('EQ-001');
    });

    it('mengambil ID dari tautan ?equip=', () => {
        expect(equipIdFromLink('https://mtc-asset.web.app/?equip=EQ-001')).toBe('EQ-001');
    });

    it('mengabaikan parameter tetangga', () => {
        expect(equipIdFromLink('https://mtc-asset.web.app/?utm=1&equip=EQ-001&x=2')).toBe('EQ-001');
    });

    it('menerima bentuk hash', () => {
        expect(equipIdFromLink('https://mtc-asset.web.app/#equip=EQ-001')).toBe('EQ-001');
    });

    it('tautan tanpa equip bukan ID — dikembalikan kosong', () => {
        expect(equipIdFromLink('https://mtc-asset.web.app/')).toBe('');
        expect(equipIdFromLink('https://mtc-asset.web.app/?page=dash')).toBe('');
        expect(equipIdFromLink('')).toBe('');
        expect(equipIdFromLink(null)).toBe('');
    });
});

describe('QR payload & hasil scan', () => {
    beforeEach(() => QRCode.toDataURL.mockClear());

    it('generateQR meng-encode tautan aset, bukan ID telanjang', async () => {
        const ctx = makeCtx();
        await uiModule.generateQR.call(ctx, 'EQ-123');
        expect(QRCode.toDataURL.mock.calls.at(-1)[0]).toBe(equipTagLink('EQ-123'));
        expect(ctx.qrCodeDataUrl).toContain('equip=EQ-123');
        expect(ctx.showQRPreviewModal).toBe(true);
    });

    it('hasil scan berupa tautan membuka unitnya', () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EX-001', Nama: 'Pompa E2E' }] });
        uiModule.handleScanResult.call(ctx, 'https://mtc-asset.web.app/?equip=ex-001');
        expect(ctx.goToDetail).toHaveBeenCalledWith('EX-001');
    });

    it('hasil scan berupa ID telanjang (stiker lama) tetap bekerja', () => {
        const ctx = makeCtx({ equipment: [{ EquipmentID: 'EX-001', Nama: 'Pompa E2E' }] });
        uiModule.handleScanResult.call(ctx, ' ex-001 ');
        expect(ctx.goToDetail).toHaveBeenCalledWith('EX-001');
    });
});

describe('applyEquipDeepLink — titik masuk tautan stiker', () => {
    const HREF = 'https://mtc-asset.web.app/?equip=EX-001';

    it('menunggu daftar aset tiba, lalu membuka detailnya', async () => {
        const ctx = makeCtx();
        const promise = uiModule.applyEquipDeepLink.call(ctx, { href: HREF, timeoutMs: 500, intervalMs: 5 });
        setTimeout(() => {
            ctx.equipment = [{ EquipmentID: 'EX-001', Nama: 'Pompa E2E' }];
        }, 20);
        await expect(promise).resolves.toBe('EX-001');
        expect(ctx.goToDetail).toHaveBeenCalledWith('EX-001');
    });

    it('tetap menjalankan jalur hasil yang sama saat unit tidak ada', async () => {
        const ctx = makeCtx();
        await expect(
            uiModule.applyEquipDeepLink.call(ctx, { href: HREF, timeoutMs: 30, intervalMs: 5 })
        ).resolves.toBe('');
        expect(ctx.showNotification).toHaveBeenCalledWith(expect.stringContaining('EX-001'), 'error');
    });

    it('tanpa parameter equip tidak menyentuh apa pun', async () => {
        const ctx = makeCtx();
        await expect(uiModule.applyEquipDeepLink.call(ctx, { href: 'https://mtc-asset.web.app/' })).resolves.toBe('');
        expect(ctx.goToDetail).not.toHaveBeenCalled();
        expect(ctx.showNotification).not.toHaveBeenCalled();
    });

    it('halaman lain tidak diblokir saat aset tidak pernah datang', async () => {
        const ctx = makeCtx();
        const t0 = Date.now();
        await uiModule.applyEquipDeepLink.call(ctx, { href: HREF, timeoutMs: 40, intervalMs: 5 });
        expect(Date.now() - t0).toBeGreaterThanOrEqual(30);
        expect(ctx.currentPage).toBeUndefined(); // tidak memindahkan halaman sendiri
        await sleep(1);
    });
});
