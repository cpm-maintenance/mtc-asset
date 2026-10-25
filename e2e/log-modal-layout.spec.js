import { test, expect } from '@playwright/test';

import { seedEmulator, E2E_USER } from './seed-emulator.mjs';

/**
 * Modal "New System Entry" (S39f): ukuran kontrol dan label harus seragam.
 *
 * Kontrak fragmen (`tests/log-form-layout.test.js`) hanya bisa memeriksa kelas.
 * Di sini yang diukur nilai hasil render: `--field-h` 44 px untuk setiap
 * kontrol, dan tidak ada label di bawah 12 px (ambang keterbacaan Lighthouse).
 */
test.describe('Modal New System Entry — hasil render', () => {
    test('semua kontrol 44px dan label >= 12px', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));

        await seedEmulator();
        await page.goto('/');
        await page.fill('#login-id', E2E_USER.email);
        await page.fill('#login-key', E2E_USER.password);
        await page.click('button[type="submit"]');
        await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });

        await page.evaluate(() => globalThis.app.openLogModal(false));
        await expect(page.locator('form [aria-label="Equipment"]')).toBeVisible({ timeout: 15_000 });

        const metrics = await page.evaluate(() => {
            const root = [...document.querySelectorAll('form')].find((f) =>
                f.querySelector('[aria-label="Equipment"]')
            );
            const visible = (el) => el && el.offsetParent !== null;
            const controls = [...root.querySelectorAll('input, select, textarea')]
                .filter((el) => visible(el) && el.type !== 'file');
            const labels = [...root.querySelectorAll('label')].filter(visible);
            const single = controls.filter((c) => c.tagName !== 'TEXTAREA');
            const areas = controls.filter((c) => c.tagName === 'TEXTAREA');
            return {
                controlCount: controls.length,
                heights: [...new Set(single.map((c) => Math.round(c.getBoundingClientRect().height)))].sort(
                    (a, b) => a - b
                ),
                // Textarea multi-baris: cukup tidak lebih pendek dari kontrol lain.
                textareaHeights: areas.map((c) => Math.round(c.getBoundingClientRect().height)),
                labelCount: labels.length,
                labelFonts: [
                    ...new Set(labels.map((l) => Math.round(parseFloat(getComputedStyle(l).fontSize)))),
                ].sort((a, b) => a - b),
            };
        });

        expect(metrics.controlCount).toBeGreaterThanOrEqual(15);
        expect(metrics.heights).toEqual([44]);
        for (const h of metrics.textareaHeights) expect(h).toBeGreaterThanOrEqual(44);
        expect(metrics.labelCount).toBeGreaterThanOrEqual(10);
        expect(metrics.labelFonts[0]).toBeGreaterThanOrEqual(12);
        expect(errors).toEqual([]);
    });
});
