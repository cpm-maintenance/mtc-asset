import { test, expect } from '@playwright/test';

import { seedEmulator, E2E_USER } from './seed-emulator.mjs';

/**
 * Dialog konfirmasi in-app (S38b) — jalur nyata di browser, bukan unit test.
 *
 * Yang dijaga:
 *  1. `window.__confirmModal` benar-benar terpasang di bundle produksi
 *     (`installConfirmDialog()` di `main.js`).
 *  2. Aksi yang memakai `askConfirm()` (deep reset di `ui.js`, tutup permintaan
 *     di `requisition.js`) membuka overlay in-app dan **tidak** memunculkan
 *     `window.confirm()` — event `dialog` bawaan Playwright tidak boleh muncul.
 *  3. Batal dan Escape menutup dialog tanpa menjalankan aksinya, dan sesi login
 *     tetap hidup.
 */
const EMAIL = E2E_USER.email;
const PASSWORD = E2E_USER.password;

/** Login lewat gate emulator. */
async function login(page) {
    await page.goto('/');
    await page.fill('#login-id', EMAIL);
    await page.fill('#login-key', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });
}

test.describe('Dialog konfirmasi in-app (emulator)', () => {
    test.beforeAll(async () => {
        await seedEmulator();
    });

    test('deep reset memakai overlay in-app, Batal menutupnya tanpa logout', async ({ page }) => {
        const nativeDialogs = [];
        page.on('dialog', (dialog) => {
            nativeDialogs.push(dialog.type());
            dialog.dismiss().catch(() => {});
        });

        await login(page);

        // Provider terpasang di bundle yang benar-benar dikirim.
        expect(await page.evaluate(() => typeof globalThis.__confirmModal)).toBe('function');

        await page.evaluate(() => {
            globalThis.__resetPending = globalThis.app.systemReset();
        });

        const dialog = page.locator('[role="alertdialog"]');
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toContainText('Deep reset aplikasi');
        // Tone danger → fokus awal di Batal, bukan di tombol destruktif.
        await expect(page.locator('[data-confirm-cancel]')).toBeFocused();

        await page.locator('[data-confirm-cancel]').click();
        await expect(dialog).toBeHidden();

        // Aksi tidak dijalankan: sesi masih hidup dan tidak ada dialog bawaan.
        await expect(page.locator('#login-id')).toBeHidden();
        expect(nativeDialogs).toEqual([]);
    });

    test('Escape membatalkan dialog tutup permintaan', async ({ page }) => {
        const nativeDialogs = [];
        page.on('dialog', (dialog) => {
            nativeDialogs.push(dialog.type());
            dialog.dismiss().catch(() => {});
        });

        await login(page);

        await page.evaluate(() => {
            globalThis.app.closeRequisition('REQ-E2E-NOT-EXIST');
        });

        const dialog = page.locator('[role="alertdialog"]');
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toContainText('Tutup permintaan');
        await expect(page.locator('[data-confirm-ok]')).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        expect(nativeDialogs).toEqual([]);
    });
});
