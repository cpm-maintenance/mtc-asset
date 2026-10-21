/**
 * Kontrak: SDK Realtime Database tidak boleh ikut muatan login (S33p).
 *
 * Ukurannya nyata dan sudah diukur terhadap produksi (`--throttling-method=devtools`,
 * `--blocked-url-patterns='*db-*'`): memblokir chunk RTDB memotong main-thread
 * **1318 → 555 ms** dan TBT **349 → 0 ms**. Efek itu hilang total begitu ada satu
 * `import ... from '../db.js'` statis di jalur boot — Rollup kemudian menaruh
 * `data-layer.js` di graf muat awal lagi, dan tidak ada tes lain yang menangkapnya
 * (aplikasi tetap jalan, hanya lambat).
 *
 * Karena itu yang dikunci adalah BENTUK IMPORNYA, dibaca dari sumber.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

/** Semua berkas .js di src/, rekursif. */
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return e.isFile() && e.name.endsWith('.js') ? [p] : [];
  });
}

/**
 * Baris `import ... from '<spec>'` yang STATIS (bukan `await import('...')`).
 * Impor dinamis sengaja lolos — itu justru mekanisme pemuatan lapisan data.
 */
function staticImports(file) {
  const out = [];
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    if (!/^\s*import\b/.test(line)) return;
    const spec = /from\s+'([^']+)'/.exec(line)?.[1];
    if (spec) out.push({ line: i + 1, spec });
  });
  return out;
}

describe('lapisan data (RTDB) tetap di luar jalur login', () => {
  // `db.js` sendiri adalah facade yang memang mengimpor keduanya — dia tidak
  // pernah masuk graf muat awal karena tidak ada yang mengimpornya secara statis.
  const files = sourceFiles(SRC).filter((f) => !f.endsWith(`${path.sep}db.js`));

  it('tidak ada impor statis ke db.js / data-layer.js di src/**', () => {
    const offenders = [];
    for (const f of files) {
      for (const imp of staticImports(f)) {
        if (/(^|\/)(db|data-layer)\.js$/.test(imp.spec)) {
          offenders.push(`${path.relative(ROOT, f)}:${imp.line} → ${imp.spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('firebase-config.js memuatnya lewat impor dinamis di window.__loadDataLayer', () => {
    const cfg = fs.readFileSync(path.join(SRC, 'js/firebase-config.js'), 'utf-8');
    expect(cfg).toMatch(/window\.__loadDataLayer\s*=\s*function/);
    expect(cfg).toMatch(/import\('\.\/data-layer\.js'\)/);
    // Auth tetap eager: tombol login memakainya.
    expect(cfg).toMatch(/from '\.\/firebase-core\.js'/);
    expect(cfg).toMatch(/window\.signInWithEmailAndPassword\s*=/);
  });

  it('firebase-config.js tidak lagi memasang window.db secara eager', () => {
    const cfg = fs.readFileSync(path.join(SRC, 'js/firebase-config.js'), 'utf-8');
    // Hanya penugasan tingkat-atas yang dihitung; yang di dalam
    // `window.__loadDataLayer().then(...)` memang tujuannya.
    const eagerDb = cfg
      .split('\n')
      .filter((l) => /^window\.(db|ref|get|onValue|set|update|remove|query)\s*=/.test(l));
    expect(eagerDb).toEqual([]);
  });

  // Sejak S33u urutan boot pasca-login dipegang `main.js` (listener auth tidak
  // bisa tinggal di `bootstrap.js`: modul itu ikut chunk `app-*.js` yang malas).
  // Yang dikunci di sini urutannya, bukan nama berkasnya.
  it('main.js memuat lapisan data sebelum chunk app, shell, dan onUser', () => {
    const main = fs.readFileSync(path.join(SRC, 'main.js'), 'utf-8');
    const order = [
      'await window.__loadDataLayer()',
      'await window.__loadApp()',
      'await window.__loadAppShell()',
      'instance.onUser(user)',
    ];
    let prev = -1;
    for (const step of order) {
      const at = main.indexOf(step);
      expect(at, `langkah hilang dari main.js: ${step}`).toBeGreaterThan(-1);
      expect(at, `urutan salah: ${step} harus setelah langkah sebelumnya`).toBeGreaterThan(prev);
      prev = at;
    }
  });

  it('consumer pertama (checkUserRole) hanya dipanggil dari onUser', () => {
    const boot = fs.readFileSync(path.join(SRC, 'js/bootstrap.js'), 'utf-8');
    expect(boot).toMatch(/async onUser\(user\)/);
    expect(boot.match(/this\.checkUserRole\(user\.uid\)/g)).toHaveLength(1);
  });

  it('audit.js memakai impor dinamis, bukan impor statis db.js', () => {
    const audit = fs.readFileSync(path.join(SRC, 'js/modules/audit.js'), 'utf-8');
    expect(audit).not.toMatch(/^\s*import\s+\{[^}]*\}\s+from\s+'\.\.\/db\.js'/m);
    expect(audit).toMatch(/await import\('\.\.\/db\.js'\)/);
  });

  it('AI settings tidak lagi dibaca dari RTDB saat init pra-login', () => {
    const boot = fs.readFileSync(path.join(SRC, 'js/bootstrap.js'), 'utf-8');
    // Satu-satunya pemanggilan yang sah ada di jalur auth (setelah user ada).
    expect(boot.match(/this\.loadAISettings\(\)/g)).toHaveLength(1);
  });
});