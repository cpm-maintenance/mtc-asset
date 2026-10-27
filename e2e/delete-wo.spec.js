import { test, expect } from '@playwright/test';

import { seedEmulator, E2E_USER } from './seed-emulator.mjs';
import { acquireEmulatorLock } from './emulator-lock.mjs';

/**
 * Regresi S38e: supervisor harus bisa menghapus Work Order dari UI.
 *
 * Bug aslinya: `database.rules.json` memberi `supervisor` hak tulis pada
 * `HistoryLog/$logId`, tetapi tombol hapus di fragmen memakai
 * `x-show="isAdmin"` — jadi supervisor tidak pernah melihat tombolnya walau
 * `deleteItem()` berhasil bila dipanggil langsung.
 *
 * Spec ini **mengubah** data emulator, jadi ia mengambil kunci bersama
 * `delete-wo-reload.spec.js` (lihat `emulator-lock.mjs`).
 */
let releaseLock;

test.beforeAll(async () => {
    releaseLock = await acquireEmulatorLock('rtdb-mutating');
});

test.afterAll(async () => {
    releaseLock?.();
});
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

        // Fixture sendiri: spec ini menghapus WO-nya, dan spec lain yang jalan
        // paralel tidak boleh memakai baris yang sama.
        const seeded = await seedEmulator({ suffix: '-del' });
        await setRole(seeded.uid, 'supervisor');

        await page.goto('/');
        await page.fill('#login-id', seeded.email);
        await page.fill('#login-key', E2E_USER.password);
        await page.click('button[type="submit"]');
        await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });
        await expect
            .poll(() => page.evaluate(() => (globalThis.app?.logs || []).length), { timeout: 20_000 })
            .toBeGreaterThan(0);

        expect(await page.evaluate(() => globalThis.app.userRole)).toBe('supervisor');
        expect(await page.evaluate(() => globalThis.app.isAdmin)).toBe(false);

        // Buka halaman Work Orders, lalu cari tombol hapus milik BARIS WO uji.
        //
        // RTDB emulator dipakai bersama spec lain yang jalan paralel, jadi
        // daftar baris bisa memuat WO mereka juga. Selektor "tombol deleteItem
        // pertama" pernah mengambil baris milik spec lain: modalnya terbuka,
        // notifikasi "Record successfully deleted" muncul, tapi baris uji kita
        // masih ada di server.
        await page.evaluate(() => {
            globalThis.app.currentPage = 'wo';
        });

        const ownRowDeleteBtn = (id) =>
            page.evaluate((woId) => {
                const isDeleteBtn = (n) => (n.getAttribute('@click') || '').includes("deleteItem('HistoryLog'");
                for (const btn of [...document.querySelectorAll('button')].filter(isDeleteBtn)) {
                    if (btn.offsetParent === null) continue;
                    let el = btn.parentElement;
                    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
                        if ((el.textContent || '').includes(woId)) return true;
                    }
                }
                return false;
            }, id);

        await expect.poll(() => ownRowDeleteBtn(seeded.woId), { timeout: 15_000 }).toBe(true);

        // Klik tombol baris itu, lalu tombol konfirmasi di modal — dikenali dari
        // callback-nya, bukan dari teks tombol yang bisa berubah.
        await page.evaluate((woId) => {
            const isDeleteBtn = (n) => (n.getAttribute('@click') || '').includes("deleteItem('HistoryLog'");
            const btn = [...document.querySelectorAll('button')]
                .filter(isDeleteBtn)
                .find((n) => {
                    if (n.offsetParent === null) return false;
                    let el = n.parentElement;
                    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
                        if ((el.textContent || '').includes(woId)) return true;
                    }
                    return false;
                });
            btn.click();
        }, seeded.woId);
        await expect.poll(() => page.evaluate(() => globalThis.app.showDeleteConfirm), { timeout: 10_000 }).toBe(true);

        await page.evaluate(() => {
            const confirm = [...document.querySelectorAll('button')].find((n) => {
                const c = n.getAttribute('@click') || '';
                return c.includes('deleteConfirmCallback') && c.includes('confirm');
            });
            confirm.click();
        });

        await expect
            .poll(() => page.evaluate((id) => (globalThis.app.logs || []).some((l) => l.LogID === id), seeded.woId), {
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
