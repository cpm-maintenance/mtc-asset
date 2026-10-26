import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

import { seedEmulator, E2E_USER } from './seed-emulator.mjs';

/**
 * Asset tag QR (S42): modal menampilkan kartu tag — QR + kata SCAN ME +
 * identitas aset — dan gambarnya benar-benar ter-render (bukan kotak kosong).
 *
 * Screenshot kartu disimpan ke `QR_SHOT` (default `test-results/qr-tag.png`)
 * supaya hasil desain bisa ditinjau tanpa membuka app.
 */
const SHOT = process.env.QR_SHOT || 'test-results/qr-tag.png';

test('modal QR menampilkan kartu tag dengan SCAN ME', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await seedEmulator();
    await page.goto('/');
    await page.fill('#login-id', E2E_USER.email);
    await page.fill('#login-key', E2E_USER.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });

    await expect
        .poll(() => page.evaluate(() => (globalThis.app?.equipment || []).length), { timeout: 25_000 })
        .toBeGreaterThan(0);

    await page.evaluate(() => {
        const eq = globalThis.app.equipment[0];
        globalThis.app.selectedEquip = eq;
        globalThis.app.generateQR(eq.EquipmentID);
    });

    const tag = page.locator('[data-testid="asset-tag"]');
    await expect(tag).toBeVisible({ timeout: 15_000 });
    await expect(tag.getByText('Scan Me', { exact: false })).toBeVisible();

    // Gambar QR harus benar-benar termuat (naturalWidth > 0), bukan src kosong.
    const qr = await page.evaluate(() => {
        const img = document.querySelector('[data-testid="asset-tag"] img');
        return img ? { w: img.naturalWidth, src: img.src.slice(0, 24) } : null;
    });
    expect(qr).not.toBeNull();
    expect(qr.w).toBeGreaterThan(0);
    expect(qr.src).toContain('data:image/png');

    await tag.screenshot({ path: SHOT });

    // Simpan PNG QR mentah (640×640) supaya bisa didekode di luar browser —
    // bukti bahwa badge tengah tidak merusak keterbacaan kode.
    const imgPath = process.env.QR_IMG;
    if (imgPath) {
        const dataUrl = await page.evaluate(
            () => document.querySelector('[data-testid="asset-tag"] img')?.src || ''
        );
        writeFileSync(imgPath, Buffer.from(dataUrl.split(',')[1] || '', 'base64'));
    }
    expect(errors).toEqual([]);
});
