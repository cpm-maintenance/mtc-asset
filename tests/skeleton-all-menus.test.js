// @vitest-environment jsdom
/**
 * Skeleton loading untuk SEMUA menu (D15).
 *
 * Sebelum ini `x-page` menyuntik fragmen halaman hanya setelah `fetch` selesai.
 * Selama fetch, 5 menu (`wo`, `pms`, `planning`, `monthlyplan`, `workload`)
 * menampilkan kotak kosong karena blok skeleton-nya tinggal di dalam fragmen
 * yang belum diunduh. 13 menu lain aman karena punya wrapper skeleton di
 * `app-shell.html`.
 *
 * Kontrak yang dikunci:
 *  - `app-shell.html` punya `x-page` untuk setiap menu (18 halaman).
 *  - directive `x-page` di `main.js` melukis skeleton pada cache miss.
 *  - markup skeleton memakai kelas `.skeleton` yang memang ada di `style.css`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const shell = read('public/pages/app-shell.html');
const mainJs = read('src/main.js');
const css = read('src/css/style.css');

describe('skeleton semua menu', () => {
  it('setiap halaman x-page punya fragmen yang benar-benar ada', () => {
    const pages = [...shell.matchAll(/x-page="'([A-Za-z]+)'"/g)].map((m) => m[1]);
    expect(pages.length).toBeGreaterThanOrEqual(18);
    const missing = [...new Set(pages)].filter(
      (p) => !fs.existsSync(path.join(ROOT, 'public/pages', `${p}.html`))
    );
    expect(missing).toEqual([]);
  });

  it('directive x-page melukis skeleton saat fragmen belum di-cache', () => {
    expect(mainJs).toContain('PAGE_SKELETON');
    expect(mainJs).toMatch(/if \(!componentLoader\.cache\.has\(pageName\)\)\s*el\.innerHTML = PAGE_SKELETON;/);
    // Skeleton harus dipasang SEBELUM `await loadPage`, bukan sesudah.
    const paintAt = mainJs.indexOf('el.innerHTML = PAGE_SKELETON');
    const awaitAt = mainJs.indexOf('await componentLoader.loadPage(pageName)', paintAt - 400);
    expect(awaitAt).toBeGreaterThan(-1);
    expect(paintAt).toBeLessThan(awaitAt);
  });

  it('kelas skeleton yang dipakai memang didefinisikan di CSS', () => {
    for (const cls of ['skeleton', 'skeleton-card', 'skeleton-line', 'skeleton-sm']) {
      expect(css).toContain(`.${cls}`);
    }
    expect(mainJs).toContain('class="skeleton skeleton-card"');
  });

  it('skeleton memberi status ke pembaca layar', () => {
    expect(mainJs).toContain('role="status"');
    expect(mainJs).toContain('aria-label="Memuat halaman"');
  });
});
