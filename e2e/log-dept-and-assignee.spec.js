import { test, expect } from '@playwright/test';

import { seedEmulator, E2E_USER, NS } from './seed-emulator.mjs';

/**
 * Dua cacat tampilan yang hanya terlihat di browser (S40).
 *
 * (a) `assignedTo` dari RTDB bisa berupa **larik** (multi-teknisi). `x-text`
 *     merendernya lewat `String(array)` → `Yuli,Gunawan,Maruf M`. Helper
 *     `formatAssignee()` merangkainya jadi `Yuli, Gunawan, Maruf M`.
 * (b) `openLogModal(true, log)` mengisi empat field Department Request, tetapi
 *     `<details>`-nya tidak punya state sehingga datanya tidak pernah terlihat.
 *
 * Tes kontrak fragmen hanya membaca markup; yang di sini mengukur hasil render.
 */
const DB = 'http://127.0.0.1:9000';

const ARR_ID = 'LOG-E2E-ARR';
const DEPT_ID = 'LOG-E2E-DEPT';

async function put(path, value) {
    const res = await fetch(`${DB}/${path}.json?ns=${NS}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`PUT ${path} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
}

const BASE = {
    EquipmentID: 'EQ-E2E-001',
    Jenis: 'Corrective',
    Status: 'Pending',
    Tanggal: '2026-10-24',
};

test.describe('Tampilan log: multi-teknisi & Department Request', () => {
    test.beforeAll(async () => {
        await seedEmulator();
        await put(`HistoryLog/${ARR_ID}`, {
            ...BASE,
            LogID: ARR_ID,
            woNumber: 'MTC-E2E-ARR',
            Deskripsi: 'Multi teknisi (data uji)',
            assignedTo: ['Yuli', 'Gunawan', 'Maruf M'],
        });
        await put(`HistoryLog/${DEPT_ID}`, {
            ...BASE,
            LogID: DEPT_ID,
            woNumber: 'MTC-E2E-DEPT',
            Deskripsi: 'Permintaan departemen (data uji)',
            assignedTo: 'Sardi',
            requestSource: 'Safety',
            requestedBy: 'Budi Santoso',
            requestDate: '2026-10-18',
            approvedBy: 'Ir. Fahmi',
        });
    });

    test('All Logs merangkai nama teknisi dengan koma + spasi', async ({ page }) => {
        await login(page);
        await page.evaluate(() => {
            globalThis.app.currentPage = 'hist';
        });
        await expect(page.locator('body')).toContainText('MTC-E2E-ARR', { timeout: 20_000 });

        const cells = await page.evaluate(() =>
            [...document.querySelectorAll('span')]
                .map((s) => s.textContent.trim())
                .filter((t) => t.includes('Yuli'))
        );
        expect(cells).toContain('Yuli, Gunawan, Maruf M');
    });

    test('modal edit membuka Department Request dan menampilkan datanya', async ({ page }) => {
        await login(page);

        const dept = await page.evaluate(async (id) => {
            const log = globalThis.app.logs.find((l) => l.LogID === id);
            globalThis.app.openLogModal(true, log);
            await new Promise((r) => setTimeout(r, 400));
            const el = [...document.querySelectorAll('details')].find((d) =>
                d.textContent.includes('Department Request')
            );
            const val = (label) => document.querySelector(`[aria-label="${label}"]`)?.value;
            return {
                open: el ? el.open : null,
                requestSource: val('Sumber permintaan'),
                requestedBy: val('Diminta oleh'),
                requestDate: val('Tanggal permintaan'),
                approvedBy: val('Disetujui oleh'),
            };
        }, DEPT_ID);

        expect(dept).toEqual({
            open: true,
            requestSource: 'Safety',
            requestedBy: 'Budi Santoso',
            requestDate: '2026-10-18',
            approvedBy: 'Ir. Fahmi',
        });
    });
});

async function login(page) {
    await page.goto('/');
    await page.fill('#login-id', E2E_USER.email);
    await page.fill('#login-key', E2E_USER.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('#login-id')).toBeHidden({ timeout: 20_000 });
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => (globalThis.app?.logs || []).filter((l) => l && l.LogID?.startsWith('LOG-E2E')).length
                ),
            { timeout: 25_000 }
        )
        .toBeGreaterThanOrEqual(2);
}
