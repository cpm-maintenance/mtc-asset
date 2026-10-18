import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uiModule } from '../src/js/modules/ui.js';

/**
 * Kontrak "tidak ada palet lama / ikon mati di dalam string JS".
 *
 * Kenapa tes ini ada
 * ------------------
 * Kelas Tailwind yang DIRAKIT di dalam string JavaScript tidak pernah dilihat
 * oleh `tsc`, `eslint`, maupun `scratch/check-page.mjs` (yang terakhir hanya
 * mengompilasi ekspresi Alpine di HTML). Tailwind juga tidak error kalau
 * sebuah kelas tidak dikenali — ia cuma **tidak mengemit apa pun**. Jadi
 * `text-slate-400` yang tertinggal menghasilkan teks tanpa warna, diam-diam,
 * dan `bg-rose-500 text-white` menghasilkan badge tanpa latar.
 *
 * Sesi S21 menyapu `index.html` dan 18 halaman, tapi menyisakan ~100 string
 * kelas di `src/js/**` (7 berkas). Tes ini yang seharusnya menangkapnya.
 *
 * Tiga kelas kegagalan yang dijaga di sini:
 *
 *  1. **Palet bawaan Tailwind** (`slate|rose|amber|emerald|red|blue|…-NNN`)
 *     kembali dipakai di string JS → warna tidak ikut tema (D-3) dan tidak
 *     konsisten dengan Tactical Slate.
 *
 *  2. **Nama ikon FontAwesome** (`'fa-box'`, kelas `fas`). FontAwesome sudah
 *     dibuang sejak S15, jadi `<i class="fas fa-box">` tidak merender apa pun.
 *     Nama ligatur Material Symbols yang dipakai lewat field `icon:` /
 *     `ms:` wajib ada di `src/css/icon-subset.txt` — kalau tidak, font lokal
 *     tidak punya glyph-nya dan yang tampil adalah **teks mentah**
 *     (`cancel`, `hourglass_top`), bukan ikon.
 *
 *  3. **Kopling `logColor()` ↔ `getStatColor()`**. `EquipmentDetail.html`
 *     memakai `:style="'border-left-color: ' + getStatColor(logColor(...))"`.
 *     Saat `logColor()` dipindah ke token `tac-*` tapi `getStatColor()` masih
 *     memetakan nama kelas lama, SEMUA border kiri jatuh ke warna fallback —
 *     regresi visual tanpa satu pun error. Tes perilaku di bawah mengunci itu.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Palet bawaan Tailwind. `tac-*` sengaja tidak termasuk. */
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|' +
  'teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const LEGACY_CLASS = new RegExp(
  '(?:^|[\\s\'"`])' + // batas kiri
    '(?:[a-z-]+:)?' + // varian: hover:, dark:, md:, …
    '(?:bg|text|border|border-l|border-t|border-r|border-b|from|via|to|ring|' +
    'fill|stroke|divide|shadow|outline|decoration|accent|caret|placeholder)-' +
    `(?:${PALETTE})-\\d{2,3}` +
    '(?:/\\d{1,3})?' +
    '(?=[\\s\'"`]|$)',
  'g'
);

const WHITE = new RegExp(
  '(?:^|[\\s\'"`])(?:[a-z-]+:)?' +
    '(?:bg|text|border|from|via|to|ring|fill|stroke|divide|shadow|placeholder)-white' +
    '(?:/\\d{1,3})?(?=[\\s\'"`]|$)',
  'g'
);

// FontAwesome: nama ikon di dalam string, atau kelas di dalam className.
// Pola `fa[srbl]?` polos TIDAK dipakai karena ikut menangkap kata biasa
// ("far in past" di komentar utils.js pernah jadi positif palsu).
const FA_ICON_NAME = /['"`]fa-[a-z0-9-]+['"`]/;
const FA_CLASS = /\bfa(?:s|r|b|solid|regular|brands)\b/;
const CLASS_ATTR = /class(?:Name)?\s*=/;

/** `ms: 'icon_name'` dan `icon: 'icon_name'` — bukan path seperti `/logo.png`. */
const LIGATURE = /(?:ms|icon):\s*['"]([a-z0-9_]+)['"]/g;

function jsFiles(dir = 'src/js') {
  const base = path.join(ROOT, dir);
  return fs.readdirSync(base, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return jsFiles(rel);
    return /\.(js|ts)$/.test(e.name) ? [rel] : [];
  });
}

/** `index.html` + setiap fragmen halaman. */
function htmlFiles() {
  const pages = path.join(ROOT, 'public/pages');
  return [
    'index.html',
    ...fs
      .readdirSync(pages)
      .filter((n) => n.endsWith('.html'))
      .map((n) => `public/pages/${n}`),
  ];
}

const JS_FILES = jsFiles();
const FILES = [...JS_FILES, ...htmlFiles()];

/** Baris kode saja — baris komentar murni dilewati supaya dokumentasi bebas. */
function codeLines(rel) {
  return fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .split(/\r?\n/)
    .map((text, i) => ({ text, line: i + 1 }))
    .filter(({ text }) => {
      const t = text.trim();
      return (
        t !== '' &&
        !t.startsWith('//') &&
        !t.startsWith('*') &&
        !t.startsWith('/*') &&
        !t.startsWith('<!--')
      );
    });
}

function allowlist() {
  return new Set(
    fs
      .readFileSync(path.join(ROOT, 'src/css/icon-subset.txt'), 'utf8')
      .split(/\s+/)
      .filter(Boolean)
  );
}

describe('sapu string kelas lama di src/js/**', () => {
  it('memindai berkas yang benar (sanitas)', () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(FILES).toContain('src/js/app.js');
    expect(FILES).toContain('src/js/modules/ui.js');
    expect(FILES).toContain('src/js/modules/notification.js');
  });

  it('tidak ada kelas palet bawaan Tailwind yang dirakit di string JS', () => {
    const hits = [];
    for (const rel of FILES) {
      for (const { text, line } of codeLines(rel)) {
        const m = text.match(LEGACY_CLASS);
        if (m) hits.push(`${rel}:${line} → ${m[0].trim()}`);
      }
    }
    expect(hits, 'kelas palet lama tidak akan ter-generate Tailwind').toEqual([]);
  });

  it('tidak ada `text-white` / `bg-white` / `white/N` di string JS & markup', () => {
    // Satu-satunya pengecualian: kanvas QR. Pemindai QR butuh latar PUTIH MURNI
    // di tema apa pun (kontras absolut terhadap modul hitam), jadi `bg-white`
    // di situ bukan pelanggaran tema. Dieja persis supaya `bg-white` baru di
    // tempat lain tetap gagal.
    const ALLOWED_WHITE = [
      { file: 'index.html', needle: 'bg-white p-8 rounded-[2.5rem]' },
    ];
    const hits = [];
    for (const rel of FILES) {
      for (const { text, line } of codeLines(rel)) {
        const m = text.match(WHITE);
        if (!m) continue;
        const excused = ALLOWED_WHITE.some((a) => a.file === rel && text.includes(a.needle));
        if (!excused) hits.push(`${rel}:${line} → ${m[0].trim()}`);
      }
    }
    expect(hits, 'putih literal tidak ikut tema terang/gelap').toEqual([]);
  });

  it('tidak ada sisa FontAwesome (nama ikon maupun kelas `fas`)', () => {
    const hits = [];
    for (const rel of FILES) {
      for (const { text, line } of codeLines(rel)) {
        if (FA_ICON_NAME.test(text) || (FA_CLASS.test(text) && CLASS_ATTR.test(text))) {
          hits.push(`${rel}:${line}: ${text.trim().slice(0, 90)}`);
        }
      }
    }
    expect(hits, 'FontAwesome sudah dibuang sejak S15 — tidak akan merender apa pun').toEqual([]);
  });

  it('tidak ada warna hex hardcoded di markup (kecuali <meta> yang memang tidak bisa var())', () => {
    // `#93000A` dan `#FFD700` sempat bertahan di WorkOrders.html setelah S21
    // karena grep saat itu hanya mencari nama kelas, bukan nilai hex. Hex tidak
    // ikut tema: di tema `light` elemen itu tetap gelap.
    // Pengecualian: `<meta name="theme-color">` / `msapplication-TileColor`
    // dibaca browser sebagai string, bukan CSS — var() tidak mungkin di sana.
    const hits = [];
    for (const rel of FILES.filter((f) => f.endsWith('.html'))) {
      for (const { text, line } of codeLines(rel)) {
        if (text.includes('<meta')) continue;
        const m = text.match(/#[0-9a-fA-F]{3,8}\b/);
        if (m) hits.push(`${rel}:${line} → ${m[0]}`);
      }
    }
    expect(hits, 'hex hardcoded tidak bisa theme-aware').toEqual([]);
  });

  it('setiap ligatur Material Symbols di string JS ada di icon-subset.txt', () => {
    const allowed = allowlist();
    const missing = new Map();
    for (const rel of FILES) {
      for (const { text, line } of codeLines(rel)) {
        for (const m of text.matchAll(LIGATURE)) {
          if (!allowed.has(m[1])) {
            if (!missing.has(m[1])) missing.set(m[1], []);
            missing.get(m[1]).push(`${rel}:${line}`);
          }
        }
      }
    }
    // Ikon di luar subset TIDAK error — yang tampil adalah teks mentah.
    expect(
      [...missing.entries()].map(([name, where]) => `${name} (${where[0]})`),
      'ligatur di luar allowlist akan tampil sebagai teks, bukan ikon'
    ).toEqual([]);
  });

  it('setiap nama ligatur yang dipakai benar-benar dipakai (bukan path berkas)', () => {
    const names = new Set();
    for (const rel of FILES) {
      for (const { text } of codeLines(rel)) {
        for (const m of text.matchAll(LIGATURE)) names.add(m[1]);
      }
    }
    expect(names.size).toBeGreaterThan(15);
    // `/logo.png` pada ikon push-notification bukan ligatur dan tidak boleh masuk.
    expect([...names].some((n) => n.includes('.'))).toBe(false);
  });
});

describe('kopling logColor() → getStatColor() (EquipmentDetail border kiri)', () => {
  const LOG_TYPES = ['PM', 'Repair', 'Inspection', 'Breakdown'];

  it('logColor() mengembalikan kelas `border-tac-*`', () => {
    for (const type of LOG_TYPES) {
      const cls = uiModule.logColor(type);
      expect(cls, `logColor(${type})`).toMatch(/^border-tac-[a-z-]+$/);
    }
  });

  it('getStatColor() mengenali SETIAP keluaran logColor() (bukan fallback)', () => {
    const fallback = 'rgb(var(--tac-gold-bright))';
    for (const type of LOG_TYPES) {
      const color = uiModule.getStatColor(uiModule.logColor(type));
      expect(color, `getStatColor(logColor(${type})) jatuh ke fallback emas`).not.toBe(fallback);
      expect(color).toMatch(/^rgb\(var\(--tac-[a-z-]+\)\)$/);
    }
  });

  it('getStatColor() theme-aware: nilainya var CSS, bukan hex', () => {
    const seen = new Set();
    for (const type of LOG_TYPES) {
      const color = uiModule.getStatColor(uiModule.logColor(type));
      expect(color).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      seen.add(color);
    }
    // Keempat jenis log harus menghasilkan empat warna berbeda.
    expect(seen.size).toBe(LOG_TYPES.length);
  });
});
