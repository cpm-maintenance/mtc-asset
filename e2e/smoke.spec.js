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
});
