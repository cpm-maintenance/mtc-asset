// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/utils/component-loader.js`.
 *
 * Loader ini jalur boot `main.js` (`componentLoader.loadPage(...)`), tapi tidak
 * punya tes sama sekali: seluruh cabangnya — cache hit, elemen target ada/tidak,
 * respons HTTP gagal — belum pernah dieksekusi. Yang paling penting dikunci:
 * kegagalan HTTP harus **melempar** (bukan menyuntikkan string kosong ke DOM),
 * dan template yang sudah di-cache tidak boleh memicu `fetch` kedua.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentLoader, componentLoader } from '../src/js/utils/component-loader.js';

/** @param {string} body */
function okResponse(body) {
    return { ok: true, status: 200, text: vi.fn(async () => body) };
}

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse('<div>halaman</div>')));
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.spyOn(console, 'error').mockRestore?.();
});

describe('ComponentLoader.fetchTemplate', () => {
    it('mengambil dari /pages dan menyimpan ke cache', async () => {
        const loader = new ComponentLoader();

        await expect(loader.fetchTemplate('Dashboard')).resolves.toBe('<div>halaman</div>');
        expect(fetch).toHaveBeenCalledWith('/pages/Dashboard.html');
        expect(loader.getCacheStatus()).toEqual({ size: 1, pages: ['Dashboard'] });
    });

    it('cache hit tidak memicu fetch kedua', async () => {
        const loader = new ComponentLoader();

        await loader.fetchTemplate('Dashboard');
        await loader.fetchTemplate('Dashboard');

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('respons tidak ok → melempar error berisi status', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: vi.fn() })));
        const loader = new ComponentLoader();

        await expect(loader.fetchTemplate('Hilang')).rejects.toThrow('HTTP error! status: 404');
        expect(loader.getCacheStatus().size).toBe(0);
    });
});

describe('ComponentLoader.loadPage', () => {
    it('menyuntikkan HTML ke elemen target bila diberikan', async () => {
        const loader = new ComponentLoader();
        const target = document.createElement('div');

        const html = await loader.loadPage('Dashboard', target);

        expect(html).toBe('<div>halaman</div>');
        expect(target.innerHTML).toBe('<div>halaman</div>');
    });

    it('tanpa elemen target tetap mengembalikan HTML', async () => {
        const loader = new ComponentLoader();

        await expect(loader.loadPage('Dashboard')).resolves.toBe('<div>halaman</div>');
    });

    it('kegagalan fetch diteruskan sebagai rejection setelah dicatat', async () => {
        const loader = new ComponentLoader();
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: vi.fn() })));

        await expect(loader.loadPage('Rusak')).rejects.toThrow('HTTP error! status: 500');
        expect(errSpy).toHaveBeenCalledWith('Failed to load page: Rusak', expect.any(Error));
    });
});

describe('ComponentLoader.preload & cache', () => {
    it('preload memuat semua halaman yang diminta', async () => {
        const loader = new ComponentLoader();

        await loader.preload(['A', 'B']);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(loader.getCacheStatus().pages).toEqual(['A', 'B']);
    });

    it('clearCache mengosongkan isi cache', async () => {
        const loader = new ComponentLoader();
        await loader.fetchTemplate('A');

        loader.clearCache();

        expect(loader.getCacheStatus()).toEqual({ size: 0, pages: [] });
    });

    it('singleton dipasang ke window untuk pemakaian global', () => {
        expect(window.componentLoader).toBe(componentLoader);
        expect(componentLoader).toBeInstanceOf(ComponentLoader);
    });
});
