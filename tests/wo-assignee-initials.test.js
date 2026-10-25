// @vitest-environment jsdom
/**
 * Inisial teknisi di kartu detail WO (S39e).
 *
 * Bug: `assignedTo` di data legacy bisa berupa **array** (`['Yuli','Gunawan','Maruf M']`).
 * `(woSelected.assignedTo || '??').slice(0, 2).toUpperCase()` lalu melempar
 * `TypeError: slice(...).toUpperCase is not a function` dan mematikan seluruh
 * `Alpine.initTree` untuk blok itu — satu record berisi array cukup untuk
 * memerahkan konsol setiap kali kartu dibuka.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(process.cwd(), 'public/pages/WorkOrders.html'), 'utf8');

/** Ekspresi `x-text` pada elemen inisial (div bulat di kartu detail). */
function initialsExpression() {
    const m = /x-text="(String\(\[\]\.concat\(woSelected\.assignedTo[^"]*)"\s*><\/div>/.exec(html);
    return m ? m[1] : null;
}

describe('WorkOrders — inisial teknisi tahan array', () => {
    it('fragmen memakai bentuk yang aman untuk string, array, dan kosong', () => {
        const expr = initialsExpression();
        expect(expr, 'ekspresi inisial tidak ditemukan di fragmen').toBeTruthy();
        expect(expr).toContain('[].concat(');
        expect(expr).toContain('String(');

        const run = (/** @type {any} */ assignedTo) => {
            const woSelected = { assignedTo };
            // Aman: `expr` dibaca dari fragmen repo ini sendiri (konstanta di disk),
            // bukan input pengguna — tujuannya menjalankan ekspresi Alpine yang asli
            // supaya tes tidak menguji salinan logika.
            return new Function('woSelected', `return ${expr}`)(woSelected);
        };

        expect(run(['Yuli', 'Gunawan', 'Maruf M'])).toBe('YU');
        expect(run(['Sardi', 'Lutfi'])).toBe('SA');
        expect(run('DhBF4lw6otV5aPu3xUl4pDvyA9u2')).toBe('DH');
        expect(run('')).toBe('??');
        expect(run(undefined)).toBe('??');
        expect(run(null)).toBe('??');
        expect(run([])).toBe('??');
    });

    it('tidak ada lagi bentuk lama yang melempar pada array', () => {
        expect(html).not.toMatch(/\(woSelected\.assignedTo \|\| '\?\?'\)\.slice\(/);
    });
});
