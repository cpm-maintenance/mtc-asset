import { test, expect } from '@playwright/test';

/**
 * Jalur CSS layar login (S33ab).
 *
 * Kemenangan S33ab bukan "CSS lebih kecil" tapi "bundel CSS tidak ada di jalur
 * permintaan sebelum paint": `<link rel=stylesheet>` dihapus, CSS kritis
 * di-inline, dan bundel penuh baru dipasang `window.__loadFullCss()` saat sesi
 * ada / submit login / interaksi pertama. Live FCP 2510 → 2227 ms.
 *
 * Sebelum spec ini, properti itu hanya dibuktikan manual (`node` + probe
 * Playwright sekali pakai). Kalau ada yang mengembalikan `<link>` biasa atau
 * memanggil `__loadFullCss()` saat boot, FCP kembali 2,5 s tanpa satu pun tes
 * merah — itu lubang yang ditutup di sini.
 *
 * Butuh build ber-`E2E_PREVIEW=1` (`npm run test:e2e:ci`, sama dengan CI): di
 * `npm run dev` plugin build tidak jalan, jadi tidak ada `style[data-critical-css]`
 * untuk diperiksa. Preview itu `vite preview` atas `dist-e2e` yang dibangun
 * `VITE_USE_EMULATORS=1` — aplikasinya bicara ke Firebase Emulator, **bukan** ke
 * Firebase produksi.
 */
test.describe('Jalur CSS layar login (S33ab)', () => {
    test.skip(!process.env.E2E_PREVIEW, 'jalankan `npm run test:e2e:ci` (build dist-e2e + preview)');

    /** @param {import('@playwright/test').Page} page */
    function trackCss(page) {
        /** @type {string[]} */
        const css = [];
        page.on('request', (r) => {
            if (/\.css(\?|$)/.test(r.url())) css.push(r.url());
        });
        return css;
    }

    test('CSS kritis di-inline, bukan tautan yang memblokir render', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#login-id')).toBeVisible();

        const critical = page.locator('style[data-critical-css]');
        await expect(critical).toHaveCount(1);
        // href bundel penuh dititipkan di atribut, bukan di <link> di <head>.
        await expect(critical).toHaveAttribute('data-full-css', /assets\/main-.*\.css/);

        const head = await page.evaluate(() =>
            Array.from(globalThis.document.head.querySelectorAll('link[rel="stylesheet"]')).map(
                (l) => l.getAttribute('href')
            )
        );
        expect(head).toEqual([]);
    });

    test('bundel CSS penuh tidak diminta sebelum interaksi', async ({ page }) => {
        const css = trackCss(page);
        await page.goto('/');
        await expect(page.locator('#login-id')).toBeVisible();
        // Beri waktu untuk request yang tertunda (font, SW, preload).
        await page.waitForTimeout(2000);
        expect(css).toEqual([]);
    });

    test('bundel CSS penuh diminta setelah interaksi pertama', async ({ page }) => {
        const css = trackCss(page);
        await page.goto('/');
        await expect(page.locator('#login-id')).toBeVisible();

        // `page.mouse.click`, bukan `page.click('body', …)`: overlay login
        // `fixed inset-0` menutupi titik itu dan Playwright menunggu
        // actionability sampai timeout.
        await page.mouse.click(24, 400);

        await expect.poll(() => css.length, { timeout: 10_000 }).toBeGreaterThan(0);
        expect(css.some((u) => /assets\/main-.*\.css/.test(u))).toBe(true);
    });
});
