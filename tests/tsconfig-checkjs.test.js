/**
 * Penjaga `checkJs` (D8).
 *
 * D5/D6/D7 menghabiskan 125 error tipe terakhir di `src/js`, tapi semuanya
 * bergantung pada `// @ts-check` di 35 file masing-masing. File ke-36 tidak
 * akan punya komentar itu — jadi jaminan "src/js bersih" cuma kebetulan, bukan
 * default. Mengembalikan `checkJs` ke `false` akan membuat `npm run typecheck`
 * tetap hijau sambil berhenti memeriksa apa pun: gagal SENYAP.
 *
 * Test ini menjaga nilainya tanpa perlu `dist/`, jadi ikut di `npm run test:run`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf-8');

/** tsconfig boleh berkomentar `//`; buang dulu supaya JSON.parse tidak tersandung.
 *  Jangan pakai regex komentar blok: pola glob `src/js/**\/*.js` mengandung
 *  `/**` + `/` yang akan termakan sebagai komentar. */
function readJsonc(rel) {
  const raw = read(rel).replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(raw);
}

const tsconfig = readJsonc('tsconfig.json');
const pkg = JSON.parse(read('package.json'));

describe('tsconfig — checkJs tidak boleh dimatikan', () => {
  it('checkJs bernilai true', () => {
    expect(tsconfig.compilerOptions.checkJs).toBe(true);
  });

  it('allowJs tetap aktif supaya .js ikut diperiksa', () => {
    expect(tsconfig.compilerOptions.allowJs).toBe(true);
  });

  it('include mencakup seluruh src/js', () => {
    expect(tsconfig.include).toContain('src/js/**/*.js');
  });

  it('strict tetap menyala (noImplicitAny bergantung padanya)', () => {
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('npm run typecheck menjalankan tsc --noEmit', () => {
    expect(pkg.scripts.typecheck).toMatch(/tsc\b.*--noEmit/);
  });
});