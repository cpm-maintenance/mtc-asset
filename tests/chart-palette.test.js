// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/chart-palette.js`.
 *
 * Fokus: cabang yang tidak pernah dieksekusi saat palet dibaca dari stylesheet
 * sungguhan — passthrough nama token mentah, alpha opsional, invalidasi cache
 * saat tema berganti, dan fallback abu-abu ketika token CSS belum terpasang
 * (jsdom/SSR). Fallback itu jalur yang paling berisiko: kalau ia salah,
 * dashboard diam-diam menggambar abu-abu tanpa satu pun error.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chartColor, chartToken, CHART_SERIES } from '../src/js/chart-palette.js';

/** Stub `getComputedStyle` agar token CSS punya nilai konkret. */
function stubTokens(values) {
    vi.stubGlobal('getComputedStyle', vi.fn(() => ({
        getPropertyValue: (name) => values[name] ?? '',
    })));
}

const setTheme = (theme, dark = false) => {
    if (theme === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', dark);
};

let themeSeq = 0;

beforeEach(() => {
    // Tema unik per tes: modul menyimpan cache per tanda tema, jadi tema yang
    // sama antar-tes akan membawa nilai lama dan membuat asersi fallback lolos
    // secara palsu (atau gagal karena cache dari tes sebelumnya).
    themeSeq += 1;
    setTheme(`t${themeSeq}`, false);
});

afterEach(() => {
    vi.unstubAllGlobals();
    setTheme('tactical', false);
});

describe('CHART_SERIES', () => {
    it('memuat seluruh kunci seri yang dipakai charts.js', () => {
        expect(CHART_SERIES).toContain('warn');
        expect(CHART_SERIES).toContain('accent-soft');
        expect(CHART_SERIES).toHaveLength(17);
    });
});

describe('chartToken', () => {
    it('kunci seri dipetakan ke nama token CSS', () => {
        expect(chartToken('good')).toBe('rgb(var(--tac-chart-good))');
    });

    it('nama token mentah diteruskan apa adanya (seri baru tanpa sentuh modul)', () => {
        expect(chartToken('--tac-chart-custom')).toBe('rgb(var(--tac-chart-custom))');
    });
});

describe('chartColor', () => {
    it('token valid → kanal rgb dipisah koma', () => {
        stubTokens({ '--tac-chart-warn': ' 245 158 11 ' });

        expect(chartColor('warn')).toBe('rgb(245, 158, 11)');
    });

    it('alpha diberikan → rgba, alpha 0 tetap dihormati (bukan dianggap kosong)', () => {
        stubTokens({ '--tac-chart-warn': '245 158 11' });

        expect(chartColor('warn', 0.5)).toBe('rgba(245, 158, 11, 0.5)');
        expect(chartColor('warn', 0)).toBe('rgba(245, 158, 11, 0)');
    });

    it('token kosong/ngawur → abu-abu netral, tanpa melempar', () => {
        stubTokens({ '--tac-chart-warn': 'bukan-angka' });

        expect(chartColor('warn')).toBe('rgb(128, 128, 128)');
        expect(chartColor('warn', 0.25)).toBe('rgba(128, 128, 128, 0.25)');
    });

    it('getComputedStyle melempar → jatuh ke abu-abu, bukan crash', () => {
        vi.stubGlobal('getComputedStyle', vi.fn(() => { throw new Error('css belum siap'); }));

        expect(chartColor('crit')).toBe('rgb(128, 128, 128)');
    });

    it('ganti tema membuang cache; tema sama memakai cache', () => {
        const spy = vi.fn(() => ({ getPropertyValue: (name) => (name === '--tac-chart-info' ? '1 2 3' : '') }));
        vi.stubGlobal('getComputedStyle', spy);

        setTheme('gelap', true);
        expect(chartColor('info')).toBe('rgb(1, 2, 3)');
        const callsAfterFirst = spy.mock.calls.length;

        // tema sama → tidak ada pembacaan ulang
        expect(chartColor('info')).toBe('rgb(1, 2, 3)');
        expect(spy.mock.calls.length).toBe(callsAfterFirst);

        // tema berubah → cache dibuang, token dibaca lagi
        setTheme('terang', false);
        expect(chartColor('info')).toBe('rgb(1, 2, 3)');
        expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it('tanpa atribut data-theme tetap menghasilkan kunci tema yang stabil', () => {
        setTheme(null, false);
        stubTokens({ '--tac-chart-good': '4 5 6' });

        expect(chartColor('good')).toBe('rgb(4, 5, 6)');
        expect(chartColor('good')).toBe('rgb(4, 5, 6)');
    });
});
