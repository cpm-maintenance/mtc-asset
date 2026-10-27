import { test, expect } from '@playwright/test';
import { seedEmulator, E2E_USER } from './seed-emulator.mjs';

/**
 * Tautan aset dari stiker QR — `<origin>/?equip=<ID>`.
 *
 * Jalur operator: kamera ponsel memindai stiker → tautan terbuka di app →
 * operator login (kalau belum) → **unitnya** terbuka, bukan dashboard.
 *
 * Diuji di sini karena jalur ini tidak bisa dibuktikan tes unit: kegagalan
 * yang paling mudah terjadi adalah balapan — daftar aset datang dari listener
 * RTDB, jadi tautan yang diproses sekali baca akan selalu "not found".
 */

/** Login lewat gate, sabar sampai shell ter-render (pelajaran S33m). */
async function login(page, email) {
    await page.fill('#login-id', email);
    await page.fill('#login-key', E2E_USER.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });
}

test.describe('Tautan aset dari stiker QR', () => {
    test('?equip=<ID> membuka detail unitnya setelah login', async ({ page }) => {
        const { eqId, email } = await seedEmulator({ suffix: '-link' });

        await page.goto(`/?equip=${eqId}`);
        await expect(page.locator('#login-id')).toBeVisible();
        await login(page, email);

        await expect
            .poll(() => page.evaluate(() => globalThis.app?.selectedEquip?.EquipmentID || ''), { timeout: 20_000 })
            .toBe(eqId);
        expect(await page.evaluate(() => globalThis.app.currentPage)).toBe('detail');

        // Tautannya dibersihkan sesudah terpakai: reload tidak melompat balik
        // ke unit yang sama saat operator sedang mengerjakan hal lain.
        await expect.poll(() => new URL(page.url()).searchParams.get('equip')).toBeNull();
    });

    test('?equip=<ID> yang tidak ada berhenti di dashboard, dengan notifikasi', async ({ page }) => {
        const { email } = await seedEmulator({ suffix: '-link2' });

        await page.goto('/?equip=NOPE-9');
        await login(page, email);

        await expect
            .poll(
                () =>
                    page.evaluate(() =>
                        (globalThis.app?.notifications || []).some((n) => /NOPE-9/.test(String(n?.message)))
                    ),
                { timeout: 20_000 }
            )
            .toBe(true);
        expect(await page.evaluate(() => globalThis.app.currentPage)).not.toBe('detail');
    });
});
