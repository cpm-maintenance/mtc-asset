// @ts-check
/**
 * paint-trace.mjs — siapa yang menahan paint pertama (S33ac).
 *
 * `mainthread-work-breakdown` Lighthouse hanya memberi ember besar ("Style &
 * Layout 600 ms", "Other 450 ms"). Probe ini mengambil trace Chromium nyata
 * (CPU ×4 + slow-4G, cache dingin) lalu menjumlahkan **self time** per nama
 * event di thread utama renderer sampai FCP — jadi kelihatan event mana yang
 * sebenarnya memakan waktu (RecalculateStyles vs Layout vs FunctionCall vs
 * EvaluateScript vs ParseHTML …), bukan cuma kategorinya.
 *
 * Pakai: node scripts/paint-trace.mjs [url] [passes]
 */
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://mtc-asset.web.app/';
const passes = Number(process.argv[3] || 2);
// Diagnosa: `--no-webfont` memaksa semua teks memakai font sistem. Dipakai untuk
// memisahkan biaya layout akibat rantai fallback webfont (4 keluarga + 12
// @font-face metrik) dari biaya struktur DOM.
const noWebfont = process.argv.includes('--no-webfont');
// `--css "<aturan>"` menyuntik CSS tambahan sebelum dokumen dimuat — dipakai
// untuk A/B lokal (containment, dst) tanpa rebuild: biaya Layout itu CPU-bound,
// jadi preview lokal cukup untuk memilih arah.
const extraCssIdx = process.argv.indexOf('--css');
const extraCss = extraCssIdx > 0 ? process.argv[extraCssIdx + 1] : '';
const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const browser = await chromium.launch();

/** @param {number} pass */
async function run(_pass) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    userAgent: UA,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (extraCss) {
    await page.addInitScript((css) => {
      const s = globalThis.document.createElement('style');
      s.textContent = css;
      globalThis.document.documentElement.appendChild(s);
    }, extraCss);
  }
  if (noWebfont) {
    await page.addInitScript(() => {
      const s = globalThis.document.createElement('style');
      s.textContent = '*{font-family:sans-serif!important}';
      globalThis.document.documentElement.appendChild(s);
    });
  }

  const events = [];
  cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));

  await cdp.send('Tracing.start', {
    categories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'blink.user_timing',
      'v8.execute',
    ].join(','),
    transferMode: 'ReportEvents',
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1200);
  const done = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  await done;

  const paint = await page.evaluate(() => {
    const e = performance.getEntriesByName('first-contentful-paint')[0];
    return e ? Math.round(e.startTime * 1000) : null;
  });
  // Pisahkan biaya FCP: koneksi (DNS/TCP/TLS) vs tunggu server vs transfer.
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const r = (v) => Math.round(v || 0);
    return {
      dns: r(n.domainLookupEnd - n.domainLookupStart),
      tcp: r(n.connectEnd - n.connectStart),
      tls: r(n.connectEnd - n.secureConnectionStart),
      ttfb: r(n.responseStart - n.requestStart),
      download: r(n.responseEnd - n.responseStart),
      domReady: r(n.domContentLoadedEventStart),
    };
  });
  await ctx.close();
  return { events, fcpUs: paint, nav };
}

for (let i = 1; i <= passes; i++) {
  const { events, fcpUs, nav } = await run(i);
  // Thread utama = pasangan (pid,tid) dengan total durasi 'X' terbesar.
  // Metadata `thread_name` tidak selalu hadir (dan namanya beda antar versi),
  // jadi menebak dari nama gagal senyap — pernah menghasilkan "0 ms".
  const totals = new Map();
  for (const e of events) {
    if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
    const key = `${e.pid}:${e.tid}`;
    totals.set(key, (totals.get(key) || 0) + e.dur);
  }
  const mainKey = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const [mainPid, mainTid] = (mainKey || ':').split(':');

  // `ts` trace itu absolut (µs sejak trace start), FCP relatif navigasi —
  // membandingkan keduanya langsung membuang SEMUA event (pernah menghasilkan
  // "total main-thread 0 ms"). Normalisasi ke navigationStart.
  const navStart = events
    .filter((e) => e.name === 'navigationStart')
    .map((e) => e.ts)
    .sort((a, b) => a - b)[0];
  const t0 = navStart ?? Math.min(...events.map((e) => e.ts));

  /** @type {Map<string, number>} */
  const self = new Map();
  for (const e of events) {
    if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
    if (String(e.pid) !== mainPid || String(e.tid) !== mainTid) continue;
    if (fcpUs && e.ts - t0 > fcpUs) continue;
    self.set(e.name, (self.get(e.name) || 0) + e.dur);
  }

  // Rincian Layout: berapa kali, kapan (rel. navigasi), berapa node kotor.
  const layouts = events
    .filter((e) => e.name === 'Layout' && String(e.pid) === mainPid && String(e.tid) === mainTid)
    .sort((a, b) => a.ts - b.ts)
    .map((e) => {
      const b = e.args?.beginData || {};
      return `${Math.round((e.ts - t0) / 1000)}ms dur ${Math.round(e.dur / 1000)}ms nodes ${b.dirtyObjects ?? '?'} / total ${b.totalObjects ?? '?'}${b.partialLayout ? ' (partial)' : ''}`;
    });

  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`\n=== pass ${i} · nav dns ${nav.dns} · tcp ${nav.tcp} · tls ${nav.tls} · ttfb ${nav.ttfb} · download ${nav.download} · domReady ${nav.domReady}`);
  console.log(`=== pass ${i} · events ${events.length} · FCP ${Math.round((fcpUs || 0) / 1000)} ms · total main-thread ${Math.round([...self.values()].reduce((a, b) => a + b, 0) / 1000)} ms · threads ${totals.size} · main ${mainKey}`);
  for (const [name, us] of top) console.log(`  ${String(Math.round(us / 1000)).padStart(5)} ms  ${name}`);
  console.log(`  layout passes (${layouts.length}):`);
  for (const l of layouts) console.log(`    ${l}`);
}

await browser.close();
