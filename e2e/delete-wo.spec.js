import { test, expect } from '@playwright/test';

import { seedEmulator, E2E_USER } from './seed-emulator.mjs';

/**
 * Regresi S38e: supervisor harus bisa menghapus Work Order dari UI.
 *
 * Bug aslinya: `database.rules.json` memberi `supervisor` hak tulis pada
 * `HistoryLog/$logId`, tetapi tombol hapus di fragmen memakai
 * `x-show="isAdmin"` — jadi supervisor tidak pernah melihat tombolnya walau
 * `deleteItem()` berhasil bila dipanggil langsung.
 */
const DB = 'http://127.0.0.1:9000';
const NS = 'mtc-asset-default-rtdb';

async function setRole(uid, role) {
    const res = await fetch(`${DB}/Users/${uid}/role.json?ns=${NS}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role),
    });
    expect(res.ok).toBeTruthy();
}

test.describe('Hapus WO oleh supervisor (emulator)', () => {
    test('tombol hapus terlihat dan penghapusan berhasil', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));

        const seeded = await seedEmulator();
        await setRole(seeded.uid, 'supervisor');

        await page.goto('/');
        await page.fill('#login-id', E2E_USER.email);
        await page.fill('#login-key', E2E_USER.password);
        await page.click('button[type="submit"]');
        await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });
        await expect
            .poll(() => page.evaluate(() => (globalThis.app?.logs || []).length), { timeout: 20_000 })
            .toBeGreaterThan(0);

        expect(await page.evaluate(() => globalThis.app.userRole)).toBe('supervisor');
        expect(await page.evaluate(() => globalThis.app.isAdmin)).toBe(false);

        // Buka halaman Work Orders, lalu cari tombol hapus milik baris WO.
        await page.evaluate(() => {
            globalThis.app.currentPage = 'wo';
        });
        await expect
            .poll(
                () =>
                    page.evaluate(() =>
                        [...document.querySelectorAll('button')].filter(
                            (n) => (n.getAttribute('@click') || '').includes("deleteItem('HistoryLog'")
                        ).length
                    ),
                { timeout: 15_000 }
            )
            .toBeGreaterThan(0);

        const visible = await page.evaluate(() =>
            [...document.querySelectorAll('button')]
                .filter((n) => (n.getAttribute('@click') || '').includes("deleteItem('HistoryLog'"))
                .some((n) => n.offsetParent !== null)
        );
        expect(visible, 'supervisor harus melihat tombol hapus WO').toBe(true);

        // Klik tombol itu → modal konfirmasi → Delete.
        await page.evaluate(() => {
            const btn = [...document.querySelectorAll('button')].find(
                (n) =>
                    (n.getAttribute('@click') || '').includes("deleteItem('HistoryLog'") && n.offsetParent !== null
            );
            btn.click();
        });
        await expect.poll(() => page.evaluate(() => globalThis.app.showDeleteConfirm), { timeout: 10_000 }).toBe(true);

        await page.locator('button:has-text("Delete")').first().click();

        await expect
            .poll(() => page.evaluate(() => (globalThis.app.logs || []).some((l) => l.LogID === 'WO-E2E-001')), {
                timeout: 20_000,
            })
            .toBe(false);
        expect(errors).toEqual([]);

        // `onChildRemoved` kini mengosongkan `logs` lebih dulu (event RTDB bisa
        // mendarat sebelum `deleteItem` selesai), jadi pesan sukses ditunggu
        // terpisah — jangan diasumsikan sudah jadi notifikasi terakhir.
        await expect
            .poll(
                () =>
                    page.evaluate(() =>
                        (globalThis.app.notifications || []).some(
                            (n) => n && n.message === 'Record successfully deleted'
                        )
                    ),
                { timeout: 10_000 }
            )
            .toBe(true);

        // Kembalikan role supaya spec lain tidak terpengaruh.
        await setRole(seeded.uid, 'admin');
    });
});
