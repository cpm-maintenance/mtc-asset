// @ts-check
/**
 * Logger terpusat MTC-ASSET.
 *
 * Di build produksi (`import.meta.env.DEV === false`) level `debug` dan `info`
 * menjadi no-op — dan karena ditulis sebagai ternary langsung, Vite/esbuild
 * membuang branch tersebut dari bundle, sehingga log internal tidak bocor ke
 * console pengguna akhir. Level `warn` dan `error` tetap diteruskan karena
 * menandakan kondisi yang perlu perhatian / dipakai untuk diagnosa lapangan.
 *
 * Pemakaian:
 *   import { logger } from './logger.js';   // atau '../logger.js' dari modules/
 *   logger.debug('pesan', data);
 */

/** @type {(...args: unknown[]) => void} */
const noop = () => {};

/** @type {(...args: unknown[]) => void} */
const debugFn = (...args) => { console.log('[debug]', ...args); };

/** @type {(...args: unknown[]) => void} */
const infoFn = (...args) => { console.info('[info]', ...args); };

/** @type {(...args: unknown[]) => void} */
const warnFn = (...args) => { console.warn(...args); };

/** @type {(...args: unknown[]) => void} */
const errorFn = (...args) => { console.error(...args); };

export const logger = {
    /** Detail untuk pengembangan saja. No-op di produksi. */
    debug: import.meta.env.DEV ? debugFn : noop,
    /** Informasi umum. No-op di produksi. */
    info: import.meta.env.DEV ? infoFn : noop,
    /** Peringatan — selalu diteruskan. */
    warn: warnFn,
    /** Error — selalu diteruskan. */
    error: errorFn,
};

export default logger;
