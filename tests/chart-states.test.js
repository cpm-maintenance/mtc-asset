// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../src/js/app.js';

/**
 * W-4 · Empty / offline state untuk chart dashboard.
 *
 * Memverifikasi helper `setChartState` / `clearChartState` / `_chartIdleKind`
 * yang mencegah chart "blank senyap" saat data kosong atau koneksi offline.
 */
describe('W-4 · chart empty/offline state', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="relative">
                <canvas id="reliabilityChart"></canvas>
            </div>
        `;
    });

    it('setChartState menyisipkan overlay dengan role=status dan aria-live', () => {
        const s = app();
        s.setChartState('reliabilityChart', 'offline', 'Offline — no cached data');

        const host = /** @type {HTMLElement} */ (document.getElementById('reliabilityChart')?.parentElement);
        const box = host.querySelector('[data-chart-state]');
        expect(box).toBeTruthy();
        expect(box?.getAttribute('role')).toBe('status');
        expect(box?.getAttribute('aria-live')).toBe('polite');
        expect(box?.getAttribute('data-chart-state')).toBe('offline');
        expect(box?.textContent).toContain('Offline');
    });

    it('setChartState tidak menumpuk overlay (selalu satu per kontainer)', () => {
        const s = app();
        s.setChartState('reliabilityChart', 'empty', 'No data');
        s.setChartState('reliabilityChart', 'empty', 'No data lagi');
        const host = /** @type {HTMLElement} */ (document.getElementById('reliabilityChart')?.parentElement);
        expect(host.querySelectorAll('[data-chart-state]').length).toBe(1);
    });

    it('clearChartState menghapus overlay dan memulihkan visibilitas kanvas', () => {
        const s = app();
        s.setChartState('reliabilityChart', 'empty', 'No data');
        expect(/** @type {HTMLElement} */ (document.getElementById('reliabilityChart')).style.visibility).toBe('hidden');

        s.clearChartState('reliabilityChart');
        const host = /** @type {HTMLElement} */ (document.getElementById('reliabilityChart')?.parentElement);
        expect(host.querySelector('[data-chart-state]')).toBeNull();
        expect(/** @type {HTMLElement} */ (document.getElementById('reliabilityChart')).style.visibility).toBe('');
    });

    it('setChartState aman saat canvas tidak ada (tidak melempar)', () => {
        const s = app();
        expect(() => s.setChartState('tidakAdaChart', 'empty', 'x')).not.toThrow();
        expect(() => s.clearChartState('tidakAdaChart')).not.toThrow();
    });

    it('_chartIdleKind mengembalikan "offline" saat navigator.onLine false', () => {
        const s = app();
        const orig = navigator.onLine;
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        expect(s._chartIdleKind()).toBe('offline');
        Object.defineProperty(navigator, 'onLine', { value: orig, configurable: true });
        expect(s._chartIdleKind()).toBe('empty');
    });
});
