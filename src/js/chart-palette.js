// @ts-check
/**
 * Palet chart — satu sumber, `--tac-chart-*` di `src/css/tactical.css`.
 *
 * Kenapa modul ini ada
 * --------------------
 * Chart.js menggambar ke `<canvas>`, jadi ia butuh **string warna** dan tidak
 * bisa memakai kelas Tailwind. Sebelumnya warna itu berupa 53 literal hex di
 * `charts.js`: hex tidak ikut tema saat paint (tema `light` tetap memakai palet
 * malam), dan menambah tema berarti menambah satu tabel hex lagi. Sekarang
 * nilainya dibaca dari token CSS lewat `getComputedStyle()`, jadi satu-satunya
 * tempat warna didefinisikan tetap `tactical.css`.
 *
 * Dua pemakaian berbeda:
 *  - **canvas** (Chart.js) → `chartColor('warn')` → `rgb(245, 158, 11)`.
 *    Nilai harus konkret karena canvas tidak mengenal `var()`.
 *  - **` :style ` inline** (mis. gauge OEE) → `chartToken('good')` →
 *    `rgb(var(--tac-chart-good))`; browser yang menghitung, jadi otomatis
 *    ikut tema tanpa perlu resolve di JS.
 */

/** Nama seri → token CSS. Kunci inilah yang dipakai `charts.js`. */
const TOKEN = /** @type {const} */ ({
    accent: '--tac-chart-accent',
    'accent-soft': '--tac-chart-accent-soft',
    grid: '--tac-chart-grid',
    tick: '--tac-chart-tick',
    title: '--tac-chart-title',
    tooltip: '--tac-chart-tooltip',
    good: '--tac-chart-good',
    emerald: '--tac-chart-emerald',
    info: '--tac-chart-info',
    warn: '--tac-chart-warn',
    crit: '--tac-chart-crit',
    violet: '--tac-chart-violet',
    magenta: '--tac-chart-magenta',
    cyan: '--tac-chart-cyan',
    muted: '--tac-chart-muted',
    neutral: '--tac-chart-neutral',
    deep: '--tac-chart-deep',
});

export const CHART_SERIES = /** @type {string[]} */ (Object.keys(TOKEN));

const FALLBACK = '128, 128, 128';
const CHANNELS = /^\d{1,3}(?:\.\d+)? \d{1,3}(?:\.\d+)? \d{1,3}(?:\.\d+)?$/;

/** Cache per tanda tema — `getComputedStyle` memaksa recalc, dan dashboard
 *  merender belasan warna sekaligus dalam satu frame. */
let cache = { key: '', values: /** @type {Record<string, string>} */ ({}) };

function themeKey() {
    if (typeof document === 'undefined') return '';
    const el = document.documentElement;
    return `${el.getAttribute('data-theme') || ''}|${el.classList.contains('dark') ? 'dark' : 'light'}`;
}

/**
 * Nama kunci → nama token CSS. Nama token mentah (`--tac-chart-x`) juga diterima
 * supaya pemanggil bisa menambah seri baru tanpa menyentuh modul ini.
 * @param {string} name
 */
function tokenOf(name) {
    return /** @type {Record<string, string>} */ (TOKEN)[name] || name;
}

/**
 * `rgb(var(--tac-chart-…))` — untuk CSS inline (`:style`), bukan canvas.
 * @param {string} name
 */
export function chartToken(name) {
    return `rgb(var(${tokenOf(name)}))`;
}

/**
 * Warna konkret untuk canvas.
 * @param {string} name kunci seri (atau nama token `--tac-chart-*` langsung)
 * @param {number} [alpha] 0..1 — hasilnya `rgba(...)`
 * @returns {string}
 */
export function chartColor(name, alpha) {
    const token = tokenOf(name);
    const key = themeKey();
    if (cache.key !== key) cache = { key, values: {} };

    let channels = cache.values[token];
    if (channels === undefined) {
        let raw = '';
        if (typeof document !== 'undefined') {
            try {
                raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
            } catch {
                raw = '';
            }
        }
        if (!CHANNELS.test(raw)) {
            // Stylesheet belum terpasang (jsdom/SSR). Kembalikan abu-abu netral
            // dan JANGAN cache — hex fallback di sini justru menghidupkan lagi
            // palet kedua di dalam JS.
            return alpha == null ? `rgb(${FALLBACK})` : `rgba(${FALLBACK}, ${alpha})`;
        }
        channels = raw.split(' ').join(', ');
        cache.values[token] = channels;
    }
    return alpha == null ? `rgb(${channels})` : `rgba(${channels}, ${alpha})`;
}
