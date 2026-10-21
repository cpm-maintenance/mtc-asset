// Agregasi 3 run Lighthouse live: median skor, LCP breakdown, unused-js, elemen LCP.
import fs from 'node:fs';

const files = ['lh-live-1.json', 'lh-live-2.json', 'lh-live-3.json'].filter((f) => fs.existsSync(f));
const runs = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf-8')));
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pct = (s) => Math.round((s ?? 0) * 100);

const rows = runs.map((r) => {
  const a = r.audits;
  const lcpEl = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet || '';
  const phases = a['largest-contentful-paint-element']?.details?.items?.[1]?.items || [];
  const ph = Object.fromEntries(phases.map((p) => [p.phase, p.timing]));
  const uj = a['unused-javascript']?.details?.items || [];
  return {
    perf: pct(r.categories.performance?.score),
    a11y: pct(r.categories.accessibility?.score),
    bp: pct(r.categories['best-practices']?.score),
    seo: pct(r.categories.seo?.score),
    fcp: a['first-contentful-paint']?.numericValue,
    lcp: a['largest-contentful-paint']?.numericValue,
    tbt: a['total-blocking-time']?.numericValue,
    cls: a['cumulative-layout-shift']?.numericValue,
    si: a['speed-index']?.numericValue,
    ttfb: a['server-response-time']?.numericValue,
    renderDelay: ph['Render Delay'] ?? ph['Render delay'] ?? null,
    lcpSnippet: lcpEl.replace(/\s+/g, ' ').slice(0, 90),
    unusedTotal: uj.reduce((s, i) => s + (i.wastedBytes || 0), 0),
    unused: uj.map((i) => `${i.url.split('/').pop()} ${Math.round(i.wastedBytes / 1024)}K`),
    totalBytes: a['total-byte-weight']?.numericValue,
    jsReqs: (a['network-requests']?.details?.items || []).filter((i) => i.url.endsWith('.js')).map((i) => i.url.split('/').pop()),
    prodChunk: (a['network-requests']?.details?.items || []).some((i) => /prod-[\w-]+\.js/.test(i.url)),
  };
});

const m = {};
for (const k of ['perf', 'a11y', 'bp', 'seo', 'fcp', 'lcp', 'tbt', 'cls', 'si', 'ttfb', 'renderDelay', 'unusedTotal', 'totalBytes']) {
  m[k] = med(rows.map((r) => r[k]).filter((v) => v != null));
}

console.log('=== per run ===');
rows.forEach((r, i) => console.log(`run${i + 1}: perf ${r.perf} a11y ${r.a11y} bp ${r.bp} seo ${r.seo} | FCP ${Math.round(r.fcp)} LCP ${Math.round(r.lcp)} TBT ${Math.round(r.tbt)} CLS ${r.cls?.toFixed(3)} SI ${Math.round(r.si)} | renderDelay ${r.renderDelay != null ? Math.round(r.renderDelay) : '?'} | unused ${Math.round(r.unusedTotal / 1024)}K | total ${Math.round(r.totalBytes / 1024)}K | prod ${r.prodChunk}`));
console.log('\n=== median ===');
console.log(`perf ${m.perf} | a11y ${m.a11y} | bp ${m.bp} | seo ${m.seo}`);
console.log(`FCP ${Math.round(m.fcp)} ms | LCP ${Math.round(m.lcp)} ms | renderDelay ${m.renderDelay != null ? Math.round(m.renderDelay) : '?'} ms | TTFB ${Math.round(m.ttfb)} ms | TBT ${Math.round(m.tbt)} ms | CLS ${m.cls?.toFixed(3)} | SI ${Math.round(m.si)} ms`);
console.log(`unused-js ${Math.round(m.unusedTotal / 1024)} KiB | total ${Math.round(m.totalBytes / 1024)} KiB`);
console.log(`prod chunk di network: ${rows.filter((r) => r.prodChunk).length}/3 run`);
console.log('\n=== LCP element ===');
console.log(rows[0].lcpSnippet);
console.log('\n=== unused per chunk (run1) ===');
console.log(rows[0].unused.join('\n'));
console.log('\n=== JS requests (run1) ===');
console.log(rows[0].jsReqs.join('\n'));
