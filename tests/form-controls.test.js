/**
 * Kontrak sistem kontrol form.
 *
 * Latar: 174 kontrol form di 19 berkas memakai 79 kombinasi kelas berbeda —
 * padding 6/8/10/12 px, radius 0/4/8/16 px, dua token surface, dan tinggi
 * filter 21 px (di bawah WCAG 2.2 target-size 24 px). Sebelum pass ini semuanya
 * disamakan oleh satu blok `!important` di `style.css`, yang membuat setiap
 * utility Tailwind di markup mati dan tidak menyisakan jalan opt-out.
 *
 * Tes ini mengunci empat properti yang mudah hilang tanpa gejala:
 *
 * 1. Token geometri ada dan tidak turun di bawah 24 px.
 * 2. Blok `!important` lama tidak kembali (kalau kembali, opt-out per-konteks
 *    jadi mustahil dan seluruh sweep kelas di masa depan ikut mati).
 * 3. `:focus` tidak boleh mematikan outline tanpa menggantinya dengan
 *    box-shadow — ini regresi aksesibilitas yang tidak tertangkap tes lain.
 * 4. Setiap kontrol filter yang sudah ditandai `field-compact` tetap bertanda
 *    (sweep 41 kontrol di 15 berkas tidak boleh surut sebagian).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const css = fs.readFileSync(path.join(ROOT, 'src/css/style.css'), 'utf-8');

const PAGES = [
  'index.html',
  ...fs
    .readdirSync(path.join(ROOT, 'public/pages'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => `public/pages/${f}`),
];

const MARKUP = PAGES.map((rel) => ({
  rel,
  src: fs.readFileSync(path.join(ROOT, rel), 'utf-8'),
}));

/** Ambil nilai `--field-h*` dari blok `:root`. */
function tokenPx(name) {
  const m = css.match(new RegExp(`--${name}:\\s*(\\d+)px`));
  return m ? Number(m[1]) : null;
}

describe('token geometri field', () => {
  it('mendefinisikan tiga tinggi + radius', () => {
    expect(tokenPx('field-h')).toBe(44);
    expect(tokenPx('field-h-sm')).toBe(36);
    expect(tokenPx('field-h-xs')).toBe(32);
    expect(tokenPx('field-radius')).toBe(8);
  });

  it('setiap tinggi memenuhi target WCAG 2.2 (2.5.8) minimal 24 px', () => {
    for (const name of ['field-h', 'field-h-sm', 'field-h-xs']) {
      const px = tokenPx(name);
      expect(px, `--${name} harus terdefinisi`).not.toBeNull();
      expect(px, `--${name} = ${px}px di bawah 24 px`).toBeGreaterThanOrEqual(24);
    }
  });
});

describe('base rule — menang tanpa !important', () => {
  it('blok !important lama tidak kembali', () => {
    // Bentuk lama: satu selector elemen memaksa bg/border/radius untuk SEMUA
    // kontrol, termasuk yang tinggal di dalam .tac-well.
    expect(css).not.toMatch(/background-color:\s*rgb\(var\(--tac-surface-recessed\)\)\s*!important/);
    expect(css).not.toMatch(/border-radius:\s*0\.5rem\s*!important/);
  });

  it('memakai :is() supaya bobotnya mengalahkan utility Tailwind', () => {
    expect(css).toMatch(/:is\(\s*input:not\(\[type='checkbox'\]\)/);
    expect(css).toMatch(/select:not\(\[multiple\]\)/);
  });
});

describe('state fokus — outline tidak boleh dimatikan tanpa pengganti', () => {
  it('setiap rule :focus yang memakai outline:none punya box-shadow', () => {
    const rules = css.split('}');
    const offenders = rules
      .map((r) => r.trim())
      .filter((r) => r.includes(':focus') && /outline:\s*none/.test(r))
      .filter((r) => !/box-shadow:/.test(r));
    expect(offenders, `rule tanpa box-shadow:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('fokus memakai ring 2 px dari token', () => {
    expect(css).toMatch(/--field-ring:\s*0 0 0 2px/);
    expect(css).toMatch(/--field-ring-err:\s*0 0 0 2px/);
  });
});

describe('opt-out konteks', () => {
  it('.tac-well membatalkan bg/border supaya layar login tidak bergaris ganda', () => {
    expect(css).toMatch(/\.tac-well :is\(/);
    expect(css).toMatch(/background-color:\s*transparent/);
  });

  it('aria-invalid dan [readonly] punya gaya sendiri', () => {
    expect(css).toMatch(/\[aria-invalid='true'\]/);
    expect(css).toMatch(/\[readonly\]/);
    expect(css).toMatch(/border-style:\s*dashed/);
  });
});

describe('sweep kontrol filter', () => {
  it('setiap kontrol filter kecil bertanda field-compact', () => {
    const missing = [];
    for (const { rel, src } of MARKUP) {
      for (const m of src.matchAll(/<(?:input|select)\b[^>]*>/g)) {
        const tag = m[0];
        const cls = tag.match(/class="([^"]*)"/);
        if (!cls) continue;
        const c = cls[1];
        const isFilterSized =
          c.includes('bg-tac-surface-recessed') &&
          c.includes('font-label-mono') &&
          !c.includes('w-full');
        if (isFilterSized && !c.includes('field-compact')) {
          missing.push(`${rel}: ${tag.slice(0, 90)}`);
        }
      }
    }
    expect(missing, `kontrol filter kehilangan field-compact:\n${missing.join('\n')}`).toEqual([]);
  });

  it('sweep-nya nyata, bukan nol kontrol', () => {
    const marked = MARKUP.reduce(
      (n, { src }) => n + (src.match(/class="[^"]*field-compact[^"]*"/g) || []).length,
      0,
    );
    expect(marked).toBeGreaterThanOrEqual(40);
  });
});

describe('grid form responsif', () => {
  it('turun 1 → 2 → 3 kolom mengikuti lebar wadah', () => {
    expect(css).toMatch(/\.form-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
    expect(css).toMatch(/@container \(min-width: 400px\)/);
    expect(css).toMatch(/@container \(min-width: 640px\)/);
  });

  it('container-type dipasang di induk, bukan di grid itu sendiri', () => {
    // Grid tidak bisa meng-query dirinya sendiri: kalau container-type
    // diletakkan di .form-grid, aturan @container tidak pernah cocok dan
    // kolomnya jatuh permanen ke 1 tanpa satu pun error.
    expect(css).toMatch(/:has\(> \.form-grid\)\s*\{\s*container-type: inline-size/);
    expect(css).not.toMatch(/\.form-grid\s*\{[^}]*container-type/);
  });

  it('punya cadangan media query bila :has() tidak didukung', () => {
    expect(css).toMatch(/@supports not selector\(:has\(\*\)\)/);
  });
});
