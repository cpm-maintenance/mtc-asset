import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwind from '../tailwind.config.js';

/**
 * Kontrak tema palette `tac-*` (kartu D-3).
 *
 * Empat hal yang pernah/jaminan rusak diam-diam, dan tes ini menjaganya:
 *
 *  1. **Hex literal di palette `tac`** — hex tidak bisa theme-aware, jadi
 *     Dashboard (dan seluruh halaman) tetap gelap walau tema = `light`.
 *     Semua nilai wajib `rgb(var(--tac-…) / <alpha-value>)`.
 *
 *  2. **`<alpha-value>` hilang** — `var()` polos tidak bisa diopacity-kan
 *     Tailwind: `bg-tac-status-emergency/15` akan mengemit alpha 1 (solid),
 *     bukan 15%. Sintaks `<alpha-value>` wajib ada di setiap nilai channel.
 *
 *  3. **Kelas `tac-*` yang tidak punya token** — kelas seperti
 *     `text-tac-text-dim` tidak ter-generate Tailwind sama sekali: tidak error,
 *     tidak ada warning, cuma teks yang warnanya salah. Sama untuk var yang
 *     dipakai `tailwind.config.js`/`tactical.css` tapi tidak didefinisikan.
 *
 *  4. **Kontras tema terang** — aksen yang aman di atas slate gelap jadi tidak
 *     terbaca di atas kartu putih. Kontras teks fungsional wajib ≥ 4.5:1
 *     (aturan Anti-Slop/WCAG AA di AGENT_CONTEXT).
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const CSS_RAW = read('src/css/tactical.css');
/** Komentar dibuang dulu — contoh di komentar bukan kode. */
const CSS = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, '');
const TAC = tailwind.theme.extend.colors.tac;

/** Token `var()` utuh (sudah membawa alpha sendiri, tanpa `<alpha-value>`). */
const PLAIN_VAR_ALLOWED = new Set(['border.subtle', 'gold.glow', 'sync.cyan-glow']);

/** Pasangan teks/latar yang wajib AA di SETIAP tema. */
const CONTRAST_PAIRS = [
  ['status-standby', 'surface-card'],
  ['on-surface', 'surface-card'],
  ['on-surface-variant', 'surface-card'],
  ['primary', 'surface-card'],
  ['gold-bright', 'surface-card'],
  ['gold-dim', 'surface-card'],
  ['status-repair', 'surface-card'],
  ['status-operational', 'surface-card'],
  ['status-emergency', 'surface-card'],
  ['sync-cyan', 'surface-card'],
  ['secondary', 'surface-card'],
  ['tertiary', 'surface-card'],
  ['error', 'surface-card'],
  ['on-primary', 'primary'],
  ['on-secondary', 'secondary'],
  ['on-primary-container', 'primary-container'],
  ['on-error', 'error'],
  ['status-standby', 'surface-container-high'],
];

/**
 * Gap AA tema gelap. **Kosong sejak D-5**: `--tac-status-standby` dinaikkan
 * slate-500 → slate-400 (100 116 139 → 148 163 184) dan `--tac-gold-dim`
 * amber-700 → amber-600 (180 83 9 → 217 119 6), jadi ke-18 pasangan lolos
 * 4.5:1 di dark/navy/purple.
 *
 * Set ini sengaja dipertahankan: kalau ada entri lagi, artinya palet gelap
 * mundur dan tes di bawah akan menangkapnya. Jangan diisi tanpa alasan.
 */
const KNOWN_DARK_GAPS = new Set([]);

// ── util: flatten palette ────────────────────────────────────────────────────
function leaves(node, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') out.push(...leaves(value, dotted));
    else out.push([dotted, value]);
  }
  return out;
}
const LEAVES = leaves(TAC);

// ── util: baca var CSS per blok tema ────────────────────────────────────────
function varsIn(block) {
  const out = {};
  for (const m of block.matchAll(/--(tac-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
function blockOf(selector) {
  const re = new RegExp(selector.replace(/[[\]'=]/g, (c) => `\\${c}`) + '\\s*\\{([\\s\\S]*?)\\n\\}');
  const m = CSS.match(re);
  return m ? varsIn(m[1]) : null;
}
const ROOT_VARS = blockOf(':root');
const THEMES = {
  dark: ROOT_VARS, // night = default :root
  navy: { ...ROOT_VARS, ...blockOf("[data-theme='navy']") },
  purple: { ...ROOT_VARS, ...blockOf("[data-theme='purple']") },
  light: { ...ROOT_VARS, ...blockOf("[data-theme='light']") },
};

// ── util: warna & kontras WCAG ──────────────────────────────────────────────
function channels(value, label) {
  const parts = String(value).trim().split(/\s+/);
  if (parts.length !== 3) throw new Error(`${label}: "${value}" bukan triple channel RGB`);
  const nums = parts.map((p) => Number(p));
  for (const n of nums) {
    if (!Number.isFinite(n) || n < 0 || n > 255) throw new Error(`${label}: "${value}" di luar 0-255`);
  }
  return nums;
}
function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('D-3 · palette tac theme-aware', () => {
  it('setiap warna tac memakai rgb(var(--tac-…) / <alpha-value>) atau var() utuh yang diizinkan', () => {
    expect(LEAVES.length).toBeGreaterThan(50);
    for (const [token, value] of LEAVES) {
      if (PLAIN_VAR_ALLOWED.has(token)) {
        expect(value, `${token} harus var(--tac-…) utuh`).toMatch(/^var\(--tac-[a-z0-9-]+\)$/);
        continue;
      }
      expect(value, `${token} masih hex literal / bukan channel var`).toMatch(
        /^rgb\(var\(--tac-[a-z0-9-]+\) \/ <alpha-value>\)$/
      );
    }
  });

  it('tidak ada hex literal sama sekali di palette tac', () => {
    const hexes = JSON.stringify(TAC).match(/#[0-9a-f]{3,8}/gi) || [];
    expect(hexes).toEqual([]);
  });

  it('setiap var yang dirujuk tailwind.config.js terdefinisi di :root', () => {
    const refs = new Set();
    for (const [, value] of LEAVES) {
      for (const m of String(value).matchAll(/var\((--tac-[a-z0-9-]+)\)/g)) refs.add(m[1].slice(2));
    }
    expect(refs.size).toBeGreaterThan(50);
    for (const ref of refs) expect(Object.keys(ROOT_VARS), `${ref} tidak ada di :root`).toContain(ref);
  });

  it('setiap var yang dirujuk tactical.css terdefinisi di :root', () => {
    const refs = new Set();
    for (const m of CSS.matchAll(/var\((--tac-[a-z0-9-]+)\)/g)) refs.add(m[1].slice(2));
    for (const ref of refs) expect(Object.keys(ROOT_VARS), `${ref} tidak ada di :root`).toContain(ref);
  });

  it('nilai channel di setiap tema = 3 angka 0-255', () => {
    for (const [theme, vars] of Object.entries(THEMES)) {
      for (const [name, value] of Object.entries(vars)) {
        if (name.endsWith('-mono') || name.endsWith('-sans')) continue;
        if (value.startsWith('rgba(') || value.startsWith('inset ')) continue;
        expect(() => channels(value, `${theme} ${name}`), `${theme} ${name}`).not.toThrow();
      }
    }
  });

  it('tema night tidak berubah dari Tactical Slate asli', () => {
    const night = {
      'surface-base': '11 15 21',
      'surface-card': '22 29 39',
      'surface-container-lowest': '8 15 24',
      primary: '255 193 116',
      'on-surface': '220 227 241',
      'border-tactical': '40 52 70',
    };
    for (const [name, value] of Object.entries(night)) {
      expect(THEMES.dark[`tac-${name}`], `tac-${name}`).toBe(value);
    }
  });

  it('navy, purple & light meng-override permukaan + teks', () => {
    for (const theme of ['navy', 'purple', 'light']) {
      const own = blockOf(`[data-theme='${theme}']`);
      expect(own, `blok [data-theme='${theme}'] tidak ada`).toBeTruthy();
      for (const name of [
        'tac-surface-base',
        'tac-surface-card',
        'tac-surface-container-lowest',
        'tac-on-surface',
        'tac-border-tactical',
      ]) {
        expect(own[name], `${theme} tidak meng-override ${name}`).toBeDefined();
        expect(own[name], `${theme} ${name} sama dengan night`).not.toBe(ROOT_VARS[name]);
      }
    }
  });

  it('tema light benar-benar terang dan navy/purple benar-benar berwarna', () => {
    const lum = (name, theme) => luminance(channels(THEMES[theme][`tac-${name}`], name));
    expect(lum('surface-card', 'light')).toBeGreaterThan(0.7);
    expect(lum('on-surface', 'light')).toBeLessThan(0.1);
    expect(lum('surface-base', 'dark')).toBeLessThan(0.05);
    // navy harus lebih "biru" dari night, purple lebih "merah+biru"
    const [nr, , nb] = channels(THEMES.navy['tac-surface-card'], 'navy');
    expect(nb - nr).toBeGreaterThan(20);
    const [pr, pg, pb] = channels(THEMES.purple['tac-surface-card'], 'purple');
    expect(pr - pg).toBeGreaterThan(5);
    expect(pb - pg).toBeGreaterThan(15);
  });

  it('tema light: kontras teks fungsional ≥ 4.5:1', () => {
    for (const [fg, bg] of CONTRAST_PAIRS) {
      const ratio = contrast(
        channels(THEMES.light[`tac-${fg}`], fg),
        channels(THEMES.light[`tac-${bg}`], bg)
      );
      expect(ratio, `light: text-tac-${fg} di atas bg-tac-${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tema gelap: kontras teks fungsional ≥ 4.5:1 (AA, D-5)', () => {
    // D-5: dulu ambangnya 3:1 (komponen) karena tiga pasangan memang belum
    // sampai 4.5. Setelah palette dinaikkan, ambangnya AA penuh untuk semua
    // tema gelap, bukan cuma "lolos komponen".
    for (const theme of ['dark', 'navy', 'purple']) {
      for (const [fg, bg] of CONTRAST_PAIRS) {
        const ratio = contrast(
          channels(THEMES[theme][`tac-${fg}`], fg),
          channels(THEMES[theme][`tac-${bg}`], bg)
        );
        expect(ratio, `${theme}: text-tac-${fg} di atas bg-tac-${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('gap AA tema gelap persis sebanyak yang didokumentasikan di KNOWN_DARK_GAPS', () => {
    const actual = new Set();
    for (const theme of ['dark', 'navy', 'purple']) {
      for (const [fg, bg] of CONTRAST_PAIRS) {
        const ratio = contrast(
          channels(THEMES[theme][`tac-${fg}`], fg),
          channels(THEMES[theme][`tac-${bg}`], bg)
        );
        if (ratio < 4.5) actual.add(`${theme}:${fg}|${bg}`);
      }
    }
    const expected = new Set();
    for (const theme of ['dark', 'navy', 'purple']) {
      for (const key of KNOWN_DARK_GAPS) expected.add(`${theme}:${key}`);
    }
    // Kalau ini gagal: palet gelap berubah. Perbaiki paletnya (lebih baik) atau
    // perbarui KNOWN_DARK_GAPS + catat di SESSION_NOTES.
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  it('setiap kelas tac-* di halaman/JS punya token di tailwind.config.js', () => {
    // `surface.DEFAULT` → kelas `bg-tac-surface` (tanpa sufiks DEFAULT)
    const known = new Set(
      LEAVES.map(([token]) => token.split('.').filter((k) => k !== 'DEFAULT').join('-'))
    );
    const files = [
      'index.html',
      ...walk('src/js', /\.(js|ts)$/),
      ...walk('public/pages', /\.html$/),
      ...walk('public/components', /\.html$/),
    ];
    const classes = new Map();
    const re = /(?:^|[\s'"`])(?:[a-z-]+:)*(?:bg|text|border|from|to|via|ring|fill|stroke|divide|shadow|outline|decoration|accent|caret|placeholder)-tac-([a-z0-9-]+)(?:\/\S*?)?(?=[\s'"`]|$)/g;
    for (const file of files) {
      const src = read(file);
      for (const m of src.matchAll(re)) {
        if (!classes.has(m[1])) classes.set(m[1], file);
      }
    }
    expect(classes.size).toBeGreaterThan(30);
    const unknown = [...classes.entries()].filter(([name]) => !known.has(name));
    expect(unknown, `kelas tac-* tanpa token (tidak akan ter-generate)`).toEqual([]);
  });
});

function walk(dir, filter) {
  const base = path.join(ROOT, dir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(rel, filter);
    return filter.test(e.name) ? [rel] : [];
  });
}
