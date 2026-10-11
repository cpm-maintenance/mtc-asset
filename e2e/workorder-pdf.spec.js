import { test, expect } from '@playwright/test';

/**
 * Full E2E flow — requires real Firebase credentials.
 * Set E2E_EMAIL and E2E_PASSWORD to enable; otherwise these specs self-skip.
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('Authenticated flow', () => {
    test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD not set — skipping authenticated flow');

    test('login → dashboard → export a Work Order PDF', async ({ page }) => {
        await page.goto('/');

        await page.fill('#login-id', EMAIL);
        await page.fill('#login-key', PASSWORD);
        await page.click('button[type="submit"]');

        // Login gate disappears once authenticated.
        await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });

        // App shell is mounted and Firebase listeners have had a chance to run.
        await expect(page.locator('[x-data]').first()).toBeVisible();

        // Find an existing Work Order to export.
        const woId = await page.evaluate(() => {
            const logs = window.app?.logs || [];
            const wo = logs.find((l) => l && l.woNumber);
            return wo ? wo.LogID : null;
        });

        test.skip(!woId, 'No Work Order data available to export');

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 25_000 }),
            page.evaluate((id) => window.app.exportWOToPDF(id), woId),
        ]);

        expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    });
});
