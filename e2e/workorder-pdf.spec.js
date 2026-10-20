import { test, expect } from '@playwright/test';

import { seedEmulator, E2E_USER } from './seed-emulator.mjs';

/**
 * Alur kritis: login → dashboard → export Work Order PDF.
 * Berjalan terhadap Firebase Emulator (lihat playwright.config.js): data uji
 * di-seed di beforeAll, jadi tidak ada skip dan tidak menyentuh RTDB produksi.
 */
const EMAIL = E2E_USER.email;
const PASSWORD = E2E_USER.password;

test.describe('Authenticated flow (emulator)', () => {
    test.beforeAll(async () => {
        await seedEmulator();
    });

    test('login → dashboard → export a Work Order PDF', async ({ page }) => {
        await page.goto('/');

        await page.fill('#login-id', EMAIL);
        await page.fill('#login-key', PASSWORD);
        await page.click('button[type="submit"]');

        // Login gate disappears once authenticated.
        await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });

        // App shell is mounted and Firebase listeners have had a chance to run.
        await expect(page.locator('[x-data]').first()).toBeVisible();

        // Tunggu listener RTDB terisi, lalu ambil WO hasil seed.
        await expect
            .poll(() => page.evaluate(() => (window.app?.logs || []).filter((l) => l && l.woNumber).length), {
                timeout: 25_000,
            })
            .toBeGreaterThan(0);

        const woId = await page.evaluate(() => {
            const wo = (window.app?.logs || []).find((l) => l && l.woNumber);
            return wo ? wo.LogID : null;
        });
        expect(woId).toBeTruthy();

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 25_000 }),
            page.evaluate((id) => window.app.exportWOToPDF(id), woId),
        ]);

        expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    });
});
