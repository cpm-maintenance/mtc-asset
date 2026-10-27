// @ts-check
/**
 * RUM: pemetaan PerformanceEntry → angka Core Web Vitals, dan pemasangan
 * PerformanceObserver.
 *
 * Dipisah dari `main.js` supaya bisa diuji tanpa menjalankan seluruh bootstrap,
 * dan supaya pemasangan observer-nya jujur soal entry type yang didukung:
 * `first-contentful-paint` **bukan** entry type yang sah untuk `observe()`
 * (yang sah `paint`, lalu difilter `name`-nya). Memasangnya membuat setiap
 * browser menuliskan warning dan `fcp` tidak pernah terisi.
 */

/** Entry type yang kita pakai — semuanya harus ada di `supportedEntryTypes`. */
export const VITALS_OBSERVE_TYPES = ['largest-contentful-paint', 'layout-shift', 'paint', 'event'];

/**
 * @typedef {Record<string, number>} Vitals
 */

/**
 * Petakan satu PerformanceEntry ke objek `vitals` (mutasi di tempat).
 * @param {any} entry
 * @param {Vitals} vitals
 * @returns {Vitals}
 */
export function entryToVitals(entry, vitals) {
    if (!entry) return vitals;
    if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
        vitals.fcp = entry.startTime;
    }
    if (entry.entryType === 'largest-contentful-paint' && !vitals.lcp) {
        vitals.lcp = entry.startTime;
    }
    if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
        vitals.cls += entry.value || 0;
    }
    if (entry.entryType === 'event' && entry.processingEnd) {
        vitals.inp = Math.max(vitals.inp || 0, entry.processingEnd - entry.startTime);
    }
    return vitals;
}

/**
 * Pasang observer hanya untuk entry type yang dilaporkan didukung browser.
 * @param {Vitals} vitals
 * @param {typeof PerformanceObserver} [Ctor]
 * @returns {PerformanceObserver}
 */
export function observeVitals(vitals, Ctor = PerformanceObserver) {
    const supported = new Set(Ctor.supportedEntryTypes || []);
    const observer = new Ctor((/** @type {any} */ list) => {
        for (const entry of list.getEntries()) entryToVitals(entry, vitals);
    });
    for (const type of VITALS_OBSERVE_TYPES) {
        if (!supported.has(type)) continue;
        observer.observe({ type, buffered: true });
    }
    return observer;
}
