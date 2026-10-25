// @vitest-environment jsdom
/**
 * `sendBrowserNotification()` — ServiceWorker tidak aktif (S39).
 *
 * Bug: `registration.showNotification(...)` dipanggil tanpa `await`, jadi
 * rejection-nya (`TypeError: No active worker for scope …`) lolos dari
 * try/catch sebagai unhandled rejection, dan fallback `new Notification`
 * tidak pernah dipakai walau tidak ada worker aktif (dev server).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendBrowserNotification } from '../src/js/modules/notification.js';

class FakeNotification {
    constructor(title, opts) {
        FakeNotification.calls.push({ title, opts });
    }
}
FakeNotification.calls = [];
FakeNotification.permission = 'granted';

const setSW = (value) => {
    Object.defineProperty(navigator, 'serviceWorker', { value, configurable: true, writable: true });
};

beforeEach(() => {
    FakeNotification.calls = [];
    FakeNotification.permission = 'granted';
    globalThis.Notification = FakeNotification;
    setSW(undefined);
});

describe('sendBrowserNotification', () => {
    it('tanpa serviceWorker: memakai Notification langsung', async () => {
        await expect(sendBrowserNotification('Judul', 'Isi')).resolves.toBe(true);
        expect(FakeNotification.calls).toHaveLength(1);
        expect(FakeNotification.calls[0]).toMatchObject({ title: 'Judul', opts: { body: 'Isi' } });
    });

    it('izin belum granted: tidak menampilkan apa pun', async () => {
        FakeNotification.permission = 'denied';
        await expect(sendBrowserNotification('Judul', 'Isi')).resolves.toBe(false);
        expect(FakeNotification.calls).toHaveLength(0);
    });

    it('registrasi ada tapi worker tidak aktif (dev): fallback langsung, showNotification tidak dipanggil', async () => {
        const showNotification = vi.fn();
        setSW({ ready: Promise.resolve({ active: null, showNotification }) });

        await expect(sendBrowserNotification('Judul', 'Isi')).resolves.toBe(true);

        expect(showNotification).not.toHaveBeenCalled();
        expect(FakeNotification.calls).toHaveLength(1);
    });

    it('worker aktif: showNotification ditunggu dan dipanggil dengan opsi lengkap', async () => {
        const showNotification = vi.fn().mockResolvedValue(undefined);
        setSW({ ready: Promise.resolve({ active: {}, showNotification }) });

        await expect(sendBrowserNotification('Judul', 'Isi', { tag: 'wo', data: { id: 1 } })).resolves.toBe(true);

        expect(showNotification).toHaveBeenCalledTimes(1);
        const [title, opts] = showNotification.mock.calls[0];
        expect(title).toBe('Judul');
        expect(opts).toMatchObject({ body: 'Isi', tag: 'wo', data: { id: 1 }, requireInteraction: true });
        expect(FakeNotification.calls).toHaveLength(0);
    });

    it('showNotification menolak: ditangkap, bukan unhandled rejection', async () => {
        const showNotification = vi.fn().mockRejectedValue(new TypeError('No active worker for scope'));
        setSW({ ready: Promise.resolve({ active: {}, showNotification }) });

        await expect(sendBrowserNotification('Judul', 'Isi')).resolves.toBe(false);
    });
});
