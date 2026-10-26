import { test, expect } from '@playwright/test';

import { seedEmulator, E2E_USER } from './seed-emulator.mjs';

/**
 * Bug lapangan (S45c): WO dihapus → tombol **Muat ulang data** → WO kembali.
 *
 * `refreshData()` memanggil ulang `setupFirebaseListeners()`, dan fungsi itu
 * baris pertamanya memuat IndexedDB (`loadFromIndexedDB()`) ke `this.logs`.
 * Kalau cache masih memuat record yang sudah dihapus, record itu hidup lagi.
 *
 * Tes ini meniru langkah operator persis: hapus → tunggu hilang → refresh →
 * tuntut tetap hilang.
 */
const WO_ID = 'WO-E2E-001';

test('WO yang dihapus tidak kembali setelah "Muat ulang data"', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await seedEmulator();
    await page.goto('/');
    await page.fill('#login-id', E2E_USER.email);
    await page.fill('#login-key', E2E_USER.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });

    await expect
        .poll(() => page.evaluate(() => (globalThis.app?.logs || []).length), { timeout: 25_000 })
        .toBeGreaterThan(0);

    await page.evaluate(() => {
        globalThis.app.currentPage = 'wo';
    });

    const has = () =>
        page.evaluate((id) => (globalThis.app.logs || []).some((l) => l && l.LogID === id), WO_ID);

    expect(await has(), 'WO uji harus ada sebelum dihapus').toBe(true);

    // Hapus lewat jalur aplikasi; dialog konfirmasi di-stub supaya tes tidak
    // bergantung pada markup modal.
    await page.evaluate(async (id) => {
        globalThis.app.confirmDelete = async () => true;
        await globalThis.app.deleteItem('HistoryLog', id);
    }, WO_ID);

    await expect.poll(has, { timeout: 15_000 }).toBe(false);

    // Cache ditulis dengan debounce 250 ms — beri ruang sebelum refresh.
    await page.waitForTimeout(1500);

    // Langkah operator: klik "Muat ulang data".
    await page.evaluate(() => globalThis.app.refreshData());
    await page.waitForTimeout(3000);

    expect(await has(), 'WO yang dihapus muncul lagi setelah Muat ulang data').toBe(false);

    // Bukti server: node-nya memang sudah tidak ada di RTDB emulator.
    const serverHas = await page.evaluate(async (id) => {
        const snap = await window.get(window.ref(window.db, 'HistoryLog/' + id));
        return snap.exists();
    }, WO_ID);
    expect(serverHas, 'node HistoryLog harus sudah hilang di server').toBe(false);

    expect(errors.filter((e) => e.includes('Alpine Expression Error'))).toEqual([]);
});
