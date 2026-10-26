import { test, expect } from '@playwright/test';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

import { seedEmulator, E2E_USER } from './seed-emulator.mjs';

/**
 * Asset tag QR (S42): kartu tag di modal + hasil cetaknya.
 *
 *  · `QR_SHOT`  — potret kartu (pratinjau desain)
 *  · `QR_IMG`   — PNG QR mentah 640×640 untuk didekode di luar browser
 *  · `QR_PRINT` — potret media `print`: harus HANYA kartu tag, tanpa overlay
 *                 gelap, judul modal, atau tombol.
 */
const SHOT = process.env.QR_SHOT || 'test-results/qr-tag.png';
const PRINT = process.env.QR_PRINT || 'test-results/qr-tag-print.png';

async function loginAndOpenTag(page) {
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
    // QR harus sudah ter-decode sebelum dipotret/dicetak; kalau tidak, hasilnya
    // gambar rusak dan tes tetap hijau tanpa membuktikan apa pun.
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const img = document.querySelector('[data-testid="asset-tag"] img');
                    return img ? img.naturalWidth : 0;
                }),
            { timeout: 10_000 }
        )
        .toBeGreaterThan(0);
    return { tag, errors };
}

test('modal QR menampilkan kartu tag dengan SCAN ME', async ({ page }) => {
    const { tag, errors } = await loginAndOpenTag(page);
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

test('cetak hanya mengeluarkan kartu tag, bukan seluruh aplikasi', async ({ page }) => {
    await loginAndOpenTag(page);

    // `window.print()` di headless bisa memblokir; yang diuji di sini adalah
    // isolasi DOM-nya, bukan dialog cetak browser.
    const isolation = await page.evaluate(() => {
        window.print = () => {};
        globalThis.app.printTag();
        const root = document.getElementById('print-root');
        return {
            rootExists: !!root,
            clonedCard: !!root?.querySelector('[data-testid="asset-tag"]'),
            clonedQr: !!root?.querySelector('img[alt="Asset QR code"]'),
        };
    });
    expect(isolation).toEqual({ rootExists: true, clonedCard: true, clonedQr: true });

    await page.emulateMedia({ media: 'print' });

    const printed = await page.evaluate(() => {
        const root = document.getElementById('print-root');
        const card = root.querySelector('[data-testid="asset-tag"]');
        const others = [...document.body.children].filter((el) => el.id !== 'print-root');
        return {
            rootDisplay: getComputedStyle(root).display,
            cardWidth: Math.round(card.getBoundingClientRect().width),
            cardVisibility: getComputedStyle(card).visibility,
            // Semua anak body lain harus hilang dari hasil cetak.
            hiddenOthers: others.every((el) => getComputedStyle(el).display === 'none'),
            otherCount: others.length,
            clonedQrLoaded: (root.querySelector('img')?.naturalWidth || 0) > 0,
        };
    });

    expect(printed.rootDisplay).toBe('block');
    expect(printed.hiddenOthers).toBe(true);
    expect(printed.otherCount).toBeGreaterThan(0);
    expect(printed.cardVisibility).toBe('visible');
    // Dekode PNG data-URL butuh satu tick; poll, jangan asersi sekali.
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => document.querySelector('#print-root img')?.naturalWidth || 0
                ),
            { timeout: 10_000 }
        )
        .toBeGreaterThan(0);
    // 78 mm ≈ 295 px @96dpi — bukan selebar layar.
    expect(printed.cardWidth).toBeGreaterThan(240);
    expect(printed.cardWidth).toBeLessThan(340);

    await page.screenshot({ path: PRINT });
});

test('Save PNG mengunduh kartu utuh, bukan QR telanjang', async ({ page }) => {
    await loginAndOpenTag(page);

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /save png/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^TAG_.+\.png$/);

    const file = await download.path();
    const buf = readFileSync(file);
    // Signature PNG + lebar/tinggi dari chunk IHDR.
    expect(buf.slice(1, 4).toString()).toBe('PNG');
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    // Kartu 78 mm ≈ 295 px @96dpi, dirender `scale: 3` → ±885 px.
    expect(width).toBeGreaterThan(600);
    expect(height).toBeGreaterThan(width);

    if (process.env.QR_PNG_OUT) copyFileSync(file, process.env.QR_PNG_OUT);
});

test('tombol QR di kartu Equipment membuka tag tanpa mampir ke detail', async ({ page }) => {
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
        globalThis.app.currentPage = 'equip';
    });

    const rowQr = page.locator('button.h-7[aria-label="Buka kartu tag QR"]').first();
    await expect(rowQr).toBeVisible({ timeout: 20_000 });

    // Target sentuh diukur di DOM, bukan disimpulkan dari kelas CSS.
    const box = await rowQr.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(24);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(24);

    await rowQr.click();

    const tag = page.locator('[data-testid="asset-tag"]');
    await expect(tag).toBeVisible({ timeout: 15_000 });
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => document.querySelector('[data-testid="asset-tag"] img')?.naturalWidth || 0
                ),
            { timeout: 10_000 }
        )
        .toBeGreaterThan(0);

    // Klik tombol tidak menavigasi, dan kartu memakai aset yang benar —
    // nama/lokasi datang dari `selectedEquip`, bukan dari id QR saja.
    const state = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="asset-tag"]');
        return {
            page: globalThis.app.currentPage,
            id: globalThis.app.selectedEquip?.EquipmentID || '',
            cardText: (card?.textContent || '').toUpperCase(),
        };
    });
    expect(state.page).toBe('equip');
    expect(state.id).not.toBe('');
    expect(state.cardText).toContain(state.id.toUpperCase());
    expect(state.cardText).toContain('POMPA E2E');

    // Mode tree: chip unit dipecah jadi dua tombol **bersaudara** (bukan
    // bersarang), jadi tombol QR juga hidup di hierarki.
    await page.evaluate(() => {
        globalThis.app.showQRPreviewModal = false;
        globalThis.app.showEquipTree = true;
    });

    const treeQr = page.locator('button.h-6[aria-label="Buka kartu tag QR"]').first();
    await expect(treeQr).toBeVisible({ timeout: 15_000 });
    const treeBox = await treeQr.boundingBox();
    expect(treeBox).not.toBeNull();
    expect(Math.round(treeBox.width)).toBeGreaterThanOrEqual(24);
    expect(Math.round(treeBox.height)).toBeGreaterThanOrEqual(24);

    await treeQr.click();
    await expect(tag).toBeVisible({ timeout: 15_000 });
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => document.querySelector('[data-testid="asset-tag"] img')?.naturalWidth || 0
                ),
            { timeout: 10_000 }
        )
        .toBeGreaterThan(0);

    const treeState = await page.evaluate(() => ({
        page: globalThis.app.currentPage,
        tree: globalThis.app.showEquipTree,
        id: globalThis.app.selectedEquip?.EquipmentID || '',
    }));
    expect(treeState.page).toBe('equip');
    expect(treeState.tree).toBe(true);
    expect(treeState.id).not.toBe('');

    // Error scope Alpine baru = bug, bukan salah tulis.
    expect(errors.filter((e) => e.includes('Alpine Expression Error'))).toEqual([]);
});
