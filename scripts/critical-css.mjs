// @ts-check
/**
 * critical-css.mjs — CSS kritis layar login (kartu t_4c952280).
 *
 * MASALAH: `index.html` memuat satu bundel CSS 96,5 KB (16,6 KB gzip) lewat
 * `<link rel="stylesheet">`, dan itu render-blocking. FCP di produksi menunggu
 * CSS mendarat (13,2 KB transfer) ditambah parse + style/layout seluruh bundel.
 * Diukur dengan `--blocked-url-patterns='*assets/main-*.css'` di live:
 * FCP 2374 → 1785 ms (median 3 run devtools).
 *
 * OBAT: pada build, Tailwind dijalankan ULANG dengan `content` dibatasi ke
 * `index.html` — satu-satunya markup yang terlihat sebelum login (fragmen
 * shell ada di `public/pages/`, dimuat setelah auth). Hasilnya digabung dengan
 * tiga berkas CSS non-Tailwind (token tema, ikon, @font-face) dan di-inline ke
 * `<head>` oleh plugin di `vite.config.js`. Bundel penuh tetap dimuat, tapi
 * non-blocking, jadi aturan yang tidak masuk subset pulih beberapa ratus ms
 * kemudian — kegagalan klasifikasi tidak pernah meninggalkan login tanpa gaya.
 *
 * Batas: ini bukan ekstraktor "unused CSS" umum. Yang menentukan subset adalah
 * `content` Tailwind, jadi kelas yang hanya dibuat lewat string di JS
 * (`:class="note.color"`) TIDAK ikut. Untuk layar login itu tidak ada — markup
 * login sepenuhnya literal di `index.html`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Berkas CSS yang selalu ikut kritis (bukan hasil Tailwind). */
export const ALWAYS_CRITICAL = [
  'src/css/tactical.css',
  'src/css/tactical-icons.css',
  'src/css/fonts.css',
];

/**
 * Bangun CSS kritis dari sumber repo.
 * @param {{ cwd?: string }} [opts]
 * @returns {Promise<string>} CSS terminifikasi
 */
export async function buildCriticalCss(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const read = (p) => fs.readFileSync(path.join(cwd, p), 'utf-8');

  const [{ default: postcss }, { default: tailwindcss }, { transform }] = await Promise.all([
    import('postcss'),
    import('tailwindcss'),
    import('lightningcss'),
  ]);

  const entry = path.join(cwd, 'src/css/style.css');
  // `content` di sini MENGGANTIKAN glob di tailwind.config.js — itulah inti
  // subset: hanya utilitas yang dipakai markup layar login.
  //
  // WAJIB: objek yang dioper ke plugin tailwind MENGGANTIKAN config, bukan
  // di-merge. Tanpa spread `tailwind.config.js`, `theme.extend` (token `tac-*`,
  // `font-label-mono-*`, `space-*`, `gutter-*`) hilang dan Tailwind mengemit
  // nol utilitas untuk kelas-kelas itu tanpa satu pun error — gejalanya CSS
  // kritis berisi base saja dan layar login tampil tanpa gaya.
  // Glob juga wajib relatif: path absolut Windows gagal dicocokkan fast-glob.
  const userConfig = (await import(pathToFileURL(path.join(cwd, 'tailwind.config.js')).href))
    .default;
  const result = await postcss([
    tailwindcss({ ...userConfig, content: ['index.html'] }),
  ]).process(fs.readFileSync(entry, 'utf-8'), { from: entry });

  const css = [result.css, ...ALWAYS_CRITICAL.map(read)].join('\n');
  const { code } = transform({
    filename: 'critical.css',
    code: Buffer.from(css),
    minify: true,
  });
  return code.toString('utf-8');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/critical-css.mjs')) {
  const css = await buildCriticalCss();
  const out = process.argv[2] || 'critical.css';
  fs.writeFileSync(out, css);
  console.log(`[critical-css] ${css.length} B → ${out}`);
}
