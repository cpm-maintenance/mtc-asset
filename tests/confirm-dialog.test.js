// @vitest-environment jsdom
/**
 * Unit test `src/js/modules/confirm-dialog.js`.
 *
 * Dua jalur yang dijaga:
 *  1. **Seam** — tanpa `window.__confirmModal` (jsdom, bundle lama) `askConfirm()`
 *     wajib jatuh ke `window.confirm()`, karena seluruh modul pemanggil dan
 *     tesnya bergantung pada perilaku itu.
 *  2. **Dialog** — `showConfirmModal()` membuat satu overlay, mengembalikan
 *     `true`/`false`, tidak menumpuk, dan mengembalikan fokus.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    askConfirm,
    installConfirmDialog,
    showConfirmModal,
} from '../src/js/modules/confirm-dialog.js';

const overlay = () => /** @type {HTMLElement|null} */ (document.body.lastElementChild);
const byAttr = (name) => /** @type {HTMLElement} */ (document.querySelector(`[data-confirm-${name}]`));

beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    delete window.__confirmModal;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete window.__confirmModal;
    document.body.innerHTML = '';
});

describe('askConfirm — tanpa provider (jsdom / bundle lama)', () => {
    it('memakai window.confirm dan meneruskan pesannya', async () => {
        await expect(askConfirm('Hapus data?')).resolves.toBe(true);
        expect(confirm).toHaveBeenCalledWith('Hapus data?');
    });

    it('meneruskan jawaban batal dari window.confirm', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        await expect(askConfirm('Hapus data?')).resolves.toBe(false);
    });

    it('menganggap batal bila window.confirm tidak tersedia', async () => {
        vi.stubGlobal('confirm', undefined);
        await expect(askConfirm('Hapus data?')).resolves.toBe(false);
    });

    it('memakai provider setelah installConfirmDialog()', async () => {
        installConfirmDialog();
        const pending = askConfirm('Lanjut?', { title: 'Cek' });

        expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
        byAttr('ok').click();
        await expect(pending).resolves.toBe(true);
        expect(confirm).not.toHaveBeenCalled();
    });
});

describe('installConfirmDialog', () => {
    it('memasang provider dan melaporkan true', () => {
        expect(installConfirmDialog()).toBe(true);
        expect(window.__confirmModal).toBe(showConfirmModal);
    });

    it('melaporkan false tanpa target', () => {
        expect(installConfirmDialog(null)).toBe(false);
    });
});

describe('showConfirmModal — keputusan', () => {
    it('klik OK mengembalikan true dan melepas overlay', async () => {
        const pending = showConfirmModal({ message: 'Setuju?' });

        byAttr('ok').click();

        await expect(pending).resolves.toBe(true);
        expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    });

    it('klik Batal mengembalikan false', async () => {
        const pending = showConfirmModal({ message: 'Setuju?' });

        byAttr('cancel').click();

        await expect(pending).resolves.toBe(false);
    });

    it('Escape membatalkan', async () => {
        const pending = showConfirmModal({ message: 'Setuju?' });

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        await expect(pending).resolves.toBe(false);
    });

    it('klik latar membatalkan, klik panel tidak', async () => {
        const pending = showConfirmModal({ message: 'Setuju?' });
        const panel = /** @type {HTMLElement} */ (document.querySelector('[role="alertdialog"]'));

        panel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();

        overlay().dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await expect(pending).resolves.toBe(false);
    });

    it('dialog kedua menutup yang pertama sebagai batal', async () => {
        const first = showConfirmModal({ message: 'Pertama?' });
        const second = showConfirmModal({ message: 'Kedua?' });

        await expect(first).resolves.toBe(false);
        byAttr('ok').click();
        await expect(second).resolves.toBe(true);
        expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(0);
    });
});

describe('showConfirmModal — tampilan', () => {
    it('memakai judul, pesan, dan label kustom', async () => {
        const pending = showConfirmModal({
            message: 'Cache dihapus.',
            title: 'Deep reset',
            confirmLabel: 'Reset',
            cancelLabel: 'Nanti',
        });

        expect(document.querySelector('[data-confirm-title]').textContent).toBe('Deep reset');
        expect(document.querySelector('[data-confirm-body]').textContent).toBe('Cache dihapus.');
        expect(byAttr('ok').textContent).toBe('Reset');
        expect(byAttr('cancel').textContent).toBe('Nanti');

        byAttr('cancel').click();
        await pending;
    });

    it('memakai default saat opsi kosong', async () => {
        const pending = showConfirmModal();

        expect(document.querySelector('[data-confirm-title]').textContent).toBe('Konfirmasi');
        expect(byAttr('ok').textContent).toBe('Ya, lanjutkan');
        expect(byAttr('cancel').textContent).toBe('Batal');

        byAttr('cancel').click();
        await pending;
    });

    it('tone danger memfokuskan Batal, tone primary memfokuskan OK', async () => {
        const danger = showConfirmModal({ message: 'Hapus?', tone: 'danger' });
        expect(document.activeElement).toBe(byAttr('cancel'));
        byAttr('cancel').click();
        await danger;

        const primary = showConfirmModal({ message: 'Lanjut?' });
        expect(document.activeElement).toBe(byAttr('ok'));
        byAttr('ok').click();
        await primary;
    });

    it('tone tak dikenal jatuh ke primary', async () => {
        const pending = showConfirmModal({ message: 'Lanjut?', tone: /** @type {any} */ ('aneh') });

        expect(document.activeElement).toBe(byAttr('ok'));
        byAttr('ok').click();
        await pending;
    });

    it('mengembalikan fokus ke elemen sebelumnya', async () => {
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        const pending = showConfirmModal({ message: 'Lanjut?' });
        byAttr('ok').click();
        await pending;

        expect(document.activeElement).toBe(trigger);
    });

    it('jatuh ke window.confirm bila document.body belum ada', async () => {
        const spy = vi.spyOn(document, 'body', 'get').mockReturnValue(/** @type {any} */ (null));

        await expect(showConfirmModal({ message: 'Lanjut?' })).resolves.toBe(true);

        spy.mockRestore();
        expect(confirm).toHaveBeenCalledWith('Lanjut?');
    });
});

describe('showConfirmModal — focus trap & reduced motion', () => {
    it('Tab menyiklus dua tombol dan tidak keluar panel', async () => {
        const pending = showConfirmModal({ message: 'Lanjut?' });
        expect(document.activeElement).toBe(byAttr('ok'));

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(document.activeElement).toBe(byAttr('cancel'));

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(document.activeElement).toBe(byAttr('ok'));

        byAttr('ok').click();
        await pending;
    });

    it('Tab mengembalikan fokus ke panel bila fokus sempat keluar', async () => {
        const outside = document.createElement('button');
        document.body.appendChild(outside);
        const pending = showConfirmModal({ message: 'Lanjut?' });

        outside.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

        expect(document.activeElement).toBe(byAttr('ok'));
        byAttr('cancel').click();
        await pending;
    });

    it('membuang transisi saat prefers-reduced-motion aktif', async () => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
        const pending = showConfirmModal({ message: 'Lanjut?' });

        expect(byAttr('ok').className).not.toContain('active:scale-95');
        expect(byAttr('cancel').className).not.toContain('transition-all');

        byAttr('cancel').click();
        await pending;
        vi.unstubAllGlobals();
    });
});
