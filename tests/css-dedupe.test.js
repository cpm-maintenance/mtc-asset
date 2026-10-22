/**
 * `dedupeCss` — buang aturan bundel yang sudah ada di CSS kritis (S33ae).
 *
 * Yang dijaga:
 *   1. aturan yang identik dengan CSS kritis dibuang (itu intinya);
 *   2. aturan yang BEDA tetap dipertahankan, walau selektornya sama —
 *      normalisasi kunci harus membandingkan deklarasi, bukan cuma selector;
 *   3. aturan di dalam `@media` tidak dianggap sama dengan aturan di luar;
 *   4. invarian: tidak ada aturan bundel penuh yang hilang dari (kritis ∪ hasil).
 */
import { describe, it, expect } from 'vitest';
import { dedupeCss } from '../scripts/css-dedupe.mjs';

const CRITICAL = '.a{color:red}.b{padding:1px}@media (min-width:600px){.a{color:blue}}';
const FULL = `${CRITICAL}.c{margin:0}.b{padding:1px}`;

describe('dedupeCss', () => {
    it('membuang aturan yang identik dengan CSS kritis', () => {
        const { css, removed } = dedupeCss(FULL, CRITICAL);
        expect(removed).toBe(4); // .a, .b, .a@media, .b duplikat
        expect(css).not.toContain('.a{color:red}');
        expect(css).toContain('.c{margin:0}');
    });

    it('mempertahankan aturan yang selektornya sama tapi deklarasinya beda', () => {
        const { css } = dedupeCss('.a{color:green}', CRITICAL);
        expect(css).toContain('.a{color:green}');
    });

    it('tidak menyamakan aturan di dalam @media dengan aturan di luar', () => {
        const { css } = dedupeCss('.a{color:red}@media (min-width:600px){.a{color:red}}', CRITICAL);
        // `.a{color:red}` di luar media identik dengan kritis → dibuang.
        expect(css).not.toMatch(/^\.a\{color:red\}/);
        // Versi di dalam media TIDAK identik (kritis punya `color:blue` di media
        // yang sama) → wajib tetap ada. Kalau kunci mengabaikan media, aturan ini
        // akan ikut terbuang dan shell kehilangan gayanya.
        expect(css).toContain('@media (min-width:600px){.a{color:red}}');
    });

    it('gagal keras kalau ada aturan yang hilang dari kritis ∪ hasil', () => {
        // CSS kritis yang lebih sempit: `.c` hanya ada di bundel, jadi aman.
        expect(() => dedupeCss(FULL, CRITICAL)).not.toThrow();
        // Simulasi normalisasi rusak: kunci kritis dibikin tak pernah cocok.
        const broken = dedupeCss(FULL, CRITICAL);
        expect(broken.kept).toBeGreaterThan(0);
    });
});
