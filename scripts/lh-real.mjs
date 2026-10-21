// Angka KEDUA yang wajib dibaca untuk pekerjaan perf (S33n).
//
// Lighthouse default memakai `--throttling-method=simulate` (Lantern): model
// jaringan/jam yang menghitung ulang waktu dari grafik dependensi. Model itu
// buta terhadap biaya main-thread nyata — pada build yang sama ia melaporkan
// **TBT 0**, sementara Chrome dengan throttle sungguhan mencatat **355 ms**
// untuk parse+execute `main-*.js` (`--throttling-method=devtools`, 2 run, 21 Okt).
// Di HP kelas bawah angka itu berarti ~1-2 s main-thread blocking.
//
// Karena itu setiap klaim perf di repo ini dilaporkan dengan dua angka:
//   1. `npm run lh:live`  → median 3-6 run mode simulate (angka yang dilacak skor)
//   2. `npm run lh:real`  → median 3 run mode devtools (biaya nyata di perangkat)
//
// Pakai: node scripts/lh-real.mjs [url] [runs]     (default: produksi, 3 run)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// Jalankan CLI Lighthouse lokal langsung lewat node: `npx.cmd` tidak bisa
// di-spawn tanpa shell di Windows (node 24 menolak .cmd tanpa shell: true),
// dan jalur ini juga mengunci versi yang dipakai devDependencies.
const LH_CLI = fileURLToPath(new URL('../node_modules/lighthouse/cli/index.js', import.meta.url));

const url = process.argv[2] || 'https://mtc-asset.web.app/';
const runs = Number(process.argv[3] || 3);
const files = [];

for (let i = 1; i <= runs; i++) {
  const out = `lh-real-${i}.json`;
  process.stdout.write(`run ${i}/${runs} … `);
  execFileSync(
    process.execPath,
    [
      LH_CLI,
      url,
      '--only-categories=performance',
      '--throttling-method=devtools',
      '--output=json',
      `--output-path=${out}`,
      '--chrome-flags=--headless=new',
      '--quiet',
    ],
    { stdio: 'ignore' }
  );
  files.push(out);
  console.log('ok');
}

const rows = files.map((f) => {
  const doc = JSON.parse(fs.readFileSync(f, 'utf-8'));
  const a = doc.audits;
  const mt = (a['mainthread-work-breakdown']?.details?.items || []).reduce((s, i) => s + i.duration, 0);
  const boot = (a['bootup-time']?.details?.items || []).reduce((s, i) => s + i.total, 0);
  return {
    perf: Math.round((doc.categories.performance.score ?? 0) * 100),
    FCP: Math.round(a['first-contentful-paint'].numericValue),
    LCP: Math.round(a['largest-contentful-paint'].numericValue),
    TBT: Math.round(a['total-blocking-time'].numericValue),
    CLS: a['cumulative-layout-shift'].numericValue,
    'main-thread': Math.round(mt),
    'JS eval': Math.round(boot),
  };
});

const keys = ['perf', 'FCP', 'LCP', 'TBT', 'CLS', 'main-thread', 'JS eval'];
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const median = Object.fromEntries(keys.map((k) => [k, med(rows.map((r) => r[k]))]));

console.log(`\nurl ${url} · cache dingin · CPU x4 + slow-4G diterapkan sungguhan (bukan simulate)`);
console.log(`| run | ${keys.join(' | ')} |`);
console.log(`|---|${keys.map(() => '---').join('|')}|`);
rows.forEach((r, i) =>
  console.log(`| ${i + 1} | ${keys.map((k) => (k === 'CLS' ? r[k].toFixed(3) : r[k])).join(' | ')} |`)
);
console.log(
  `| **median** | ${keys.map((k) => (k === 'CLS' ? median[k].toFixed(3) : `**${median[k]}**`)).join(' | ')} |`
);
console.log(
  `\nTBT nyata ${median.TBT} ms (mode simulate pada build ini melaporkan 0) · main-thread ${median['main-thread']} ms`
);
