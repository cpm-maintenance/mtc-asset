import { test, expect } from '@playwright/test';

/**
 * Smoke E2E — no credentials required. Verifies the app boots, the login gate
 * renders, and baseline accessibility landmarks exist.
 */
test.describe('App smoke (no auth)', () => {
    test('boots and shows the login gate', async ({ page }) => {
        await page.goto('/');

        await expect(page).toHaveTitle(/MTC/i);
        await expect(page.locator('#login-id')).toBeVisible();
        await expect(page.locator('#login-key')).toBeVisible();
    });

    test('exposes an accessible live region for toasts', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
    });

    test('does not leak x-cloak elements after Alpine boots', async ({ page }) => {
        await page.goto('/');
        // x-cloak must be removed by Alpine once it initialises.
        await expect(page.locator('[x-cloak]')).toHaveCount(0, { timeout: 10_000 });
    });

    test('does not render page content or charts before login (P2-4)', async ({ page }) => {
        await page.goto('/');
        // Wait for Alpine to fully boot and the login gate to appear.
        await expect(page.locator('#login-id')).toBeVisible();
        await page.waitForTimeout(1500);
        // The page content container must not exist until isLoggedIn is true.
        await expect(page.locator('#page-dash')).toHaveCount(0);
        // No heavy chart canvases may be rendered behind the login gate.
        await expect(page.locator('canvas')).toHaveCount(0);
    });
});
