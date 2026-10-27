// @vitest-environment jsdom
/**
 * RUM Core Web Vitals: pemetaan entry → angka, dan pemasangan observer.
 *
 * Latar: `main.js` dulu memanggil `observe({ type: 'first-contentful-paint' })`.
 * Itu bukan entry type yang sah (yang sah `paint`, lalu difilter namanya),
 * sehingga setiap browser menuliskan warning
 * "The entry type 'first-contentful-paint' does not exist or isn't supported"
 * DAN `vitals.fcp` tidak pernah terisi.
 */
import { describe, it, expect } from 'vitest';

import { entryToVitals, observeVitals, VITALS_OBSERVE_TYPES } from '../src/js/rum.js';

/** PerformanceObserver palsu: mencatat panggilan observe() dan entry yang masuk. */
function fakeObserver(supportedEntryTypes) {
    return class {
        static supportedEntryTypes = supportedEntryTypes;
        constructor(cb) {
            this.cb = cb;
            this.observed = [];
        }
        observe(opts) {
            this.observed.push(opts.type);
        }
        disconnect() {}
    };
}

const newVitals = () => ({ lcp: 0, fid: 0, cls: 0, inp: 0, ttfb: 0 });

describe('entryToVitals — memetakan entry yang sah', () => {
    it('paint bernama first-contentful-paint mengisi fcp', () => {
        const v = newVitals();
        entryToVitals({ entryType: 'paint', name: 'first-contentful-paint', startTime: 1234 }, v);
        expect(v.fcp).toBe(1234);
    });

    it('paint lain (mis. first-paint) tidak mengisi fcp', () => {
        const v = newVitals();
        entryToVitals({ entryType: 'paint', name: 'first-paint', startTime: 900 }, v);
        expect(v.fcp).toBeUndefined();
    });

    it('layout-shift tanpa input pengguna menambah cls; yang ada input diabaikan', () => {
        const v = newVitals();
        entryToVitals({ entryType: 'layout-shift', hadRecentInput: false, value: 0.12 }, v);
        entryToVitals({ entryType: 'layout-shift', hadRecentInput: true, value: 5 }, v);
        expect(v.cls).toBeCloseTo(0.12, 5);
    });

    it('largest-contentful-paint hanya diambil yang pertama', () => {
        const v = newVitals();
        entryToVitals({ entryType: 'largest-contentful-paint', startTime: 2000 }, v);
        entryToVitals({ entryType: 'largest-contentful-paint', startTime: 4000 }, v);
        expect(v.lcp).toBe(2000);
    });

    it('event mengisi inp dengan delay terbesar', () => {
        const v = newVitals();
        entryToVitals({ entryType: 'event', startTime: 100, processingEnd: 180 }, v);
        entryToVitals({ entryType: 'event', startTime: 300, processingEnd: 400 }, v);
        expect(v.inp).toBe(100);
    });
});

describe('observeVitals — hanya memasang entry type yang didukung', () => {
    it('tidak pernah memasang "first-contentful-paint" (bukan entry type sah)', () => {
        const O = fakeObserver(['largest-contentful-paint', 'layout-shift', 'paint', 'event']);
        const observer = observeVitals(newVitals(), O);
        expect(observer.observed).not.toContain('first-contentful-paint');
        expect(observer.observed).toContain('paint');
    });

    it('melewatkan entry type yang tidak ada di supportedEntryTypes (mis. Firefox tanpa layout-shift)', () => {
        const O = fakeObserver(['paint']);
        const observer = observeVitals(newVitals(), O);
        expect(observer.observed).toEqual(['paint']);
    });

    it('tidak memasang apa pun kalau browser melaporkan daftar kosong', () => {
        const O = fakeObserver([]);
        expect(observeVitals(newVitals(), O).observed).toEqual([]);
    });

    it('entry yang masuk lewat callback tetap dipetakan ke vitals', () => {
        const O = fakeObserver(['paint']);
        const vitals = newVitals();
        const observer = observeVitals(vitals, O);
        observer.cb({ getEntries: () => [{ entryType: 'paint', name: 'first-contentful-paint', startTime: 777 }] });
        expect(vitals.fcp).toBe(777);
    });

    it('daftar tipe yang dipasang stabil (tidak ada tipe duplikat)', () => {
        expect(new Set(VITALS_OBSERVE_TYPES).size).toBe(VITALS_OBSERVE_TYPES.length);
        expect(VITALS_OBSERVE_TYPES).not.toContain('first-contentful-paint');
    });
});
