/**
 * Regresi: plugin `inline-critical-css` mengganti nama aset CSS setelah dedupe.
 * Nama lama WAJIB ditambal di SELURUH berkas teks bundel — termasuk chunk JS,
 * karena Rollup menyimpan URL CSS di `__vite__mapDeps` setiap chunk yang
 * mengimpornya dinamis.
 *
 * Bug nyata: hanya `.html` ditambal. Chunk `audit-*.js` lalu mem-preload
 * `assets/main-*.css` yang sudah dihapus; hosting SPA (Firebase) menjawab
 * `index.html` (`text/html`), preload CSS gagal, dan `import()` dinamis reject
 * → Audit Trail kosong tanpa satu pun pesan yang jelas.
 */
import { describe, it, expect } from 'vitest';
import { patchCssRefs } from '../scripts/patch-css-refs.mjs';

const FROM = 'assets/main-OLD.css';
const TO = 'assets/main-NEW.css';

describe('patchCssRefs', () => {
  it('menambal nama CSS lama di kode chunk (__vite__mapDeps) dan aset .html', () => {
    const bundle = {
      'assets/main-OLD.css': { type: 'asset', fileName: 'assets/main-OLD.css', source: 'body{}' },
      'assets/audit-x.js': { type: 'chunk', fileName: 'assets/audit-x.js', code: `d=[".js","${FROM}"]` },
      'index.html': { type: 'asset', fileName: 'index.html', source: `data-full-css="/${FROM}"` },
    };

    const patched = patchCssRefs(bundle, FROM, TO);

    expect(patched).toBe(2);
    expect(bundle['assets/audit-x.js'].code).toContain(TO);
    expect(bundle['assets/audit-x.js'].code).not.toContain(FROM);
    expect(bundle['index.html'].source).toContain(TO);
    expect(bundle['index.html'].source).not.toContain(FROM);
  });

  it('tidak menyentuh aset biner dan menghitung 0 bila nama lama absen', () => {
    const png = { type: 'asset', fileName: 'assets/logo.png', source: 'binary' };
    const bundle = { 'assets/logo.png': png };
    expect(patchCssRefs(bundle, FROM, TO)).toBe(0);
    expect(png.source).toBe('binary');
  });

  it('menambal semua kemunculan, bukan hanya yang pertama', () => {
    const bundle = {
      'a.js': { type: 'chunk', fileName: 'a.js', code: `${FROM} ${FROM} ${FROM}` },
    };
    expect(patchCssRefs(bundle, FROM, TO)).toBe(3);
    expect(bundle['a.js'].code).toBe(`${TO} ${TO} ${TO}`);
  });
});
