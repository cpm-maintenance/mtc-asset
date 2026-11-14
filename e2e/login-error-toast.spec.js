import { test, expect } from '@playwright/test';

/**
 * Regresi D30: notifikasi gagal login harus BENAR-BENAR terlihat.
 *
 * Dua bug terpisah bikin gejala "password salah tanpa notif":
 *
 *  1. **Penumpukan.** Toast stack hidup di `z-[100]` sementara overlay login
 *     `fixed inset-0` di `z-[200]` -> toast selalu tertimbun. `toBeVisible()`
 *     tidak menangkap ini (ia cuma memeriksa kotak + `visibility`), jadi tes ini
 *     melakukan hit-test `elementFromPoint` di titik tengah toast.
 *  2. **Referensi larik ditukar.** `loginScreen.notifications` dan
 *     `instance.notifications` (chunk app) adalah satu larik. Dulu `__loadApp()`
 *     menugaskan larik BARU ke `loginScreen.notifications`; toast yang sudah
 *     tampil ditinggal di larik lama dan berhenti dirender. Auth menolak jauh
 *     lebih cepat daripada 240 KiB `app-*.js` selesai diunduh, jadi toast
 *     dibuat SEBELUM baris itu jalan — persis kasus yang diuji di sini.
 *
 * Tes ini SENGAJA tidak memakai Firebase Auth. Emulator auth di mesin ini
 * menjawab 404 di `/identitytoolkit.googleapis.com/...`, jadi kode error yang
 * sampai ke aplikasi bukan `auth/invalid-credential` melainkan
 * `auth/network-request-failed` — assertion atas kalimat operator jadi rapuh dan
 * menguji emulator, bukan aplikasi. Yang diuji di sini adalah invarian UI yang
 * mana pun penyebab kegagalan loginnya sama: toast yang dibuat sebelum chunk app
 * tiba harus tetap ada sesudahnya, dan harus menang hit-test atas overlay login.
 */
test.describe('Notifikasi gagal login terlihat (D30)', () => {
    test('toast yang dibuat sebelum chunk app tiba tetap terlihat di atas overlay', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#login-id')).toBeVisible();

        // Persis urutan produksi: pesan gagal login muncul lebih dulu, chunk app
        // baru menyusul. `showNotification` di scope login = jalur asli yang
        // dipakai `mapAuthError`.
        const made = await page.evaluate(() => {
            window.__loginScreen.showNotification('Email atau kata sandi salah', 'error');
            return window.__loginScreen.notifications.map((n) => n.message);
        });
        expect(made).toEqual(['Email atau kata sandi salah']);

        await page.evaluate(() => window.__loadApp());

        // Inti regresi #2: larik yang sama, isi tidak dibuang.
        const after = await page.evaluate(() => {
            const s = window.__loginScreen;
            return {
                len: s.notifications.length,
                shared: s.notifications === window.app?.notifications,
            };
        });
        expect(after, 'chunk app membuang toast yang sudah tampil').toEqual({ len: 1, shared: true });

        const toast = page.locator('[aria-live="polite"] > div').first();
        await expect(toast).toContainText('Email atau kata sandi salah');

        // Inti regresi #1: toast harus menang hit-test terhadap overlay login.
        const hit = await toast.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { insideToast: !!top && el.contains(top), tag: top?.tagName ?? null };
        });
        expect(hit.insideToast, `elemen teratas di titik toast: ${hit.tag}`).toBe(true);
    });
});
