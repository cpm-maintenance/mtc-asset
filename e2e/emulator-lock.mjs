// Kunci lintas-proses untuk spec yang **mengubah** RTDB emulator bersama.
//
// Playwright menjalankan berkas spec di worker terpisah dan `fullyParallel: true`
// membuat worker itu berjalan bersamaan. Kedua spec hapus-WO memakai emulator
// yang sama, dan aplikasi merender **satu koleksi global**: baris milik spec
// lain muncul di daftar, sehingga penghapusan/tombol milik spec A bisa mendarat
// di asersi spec B. Kunci harus berbasis berkas (bukan variabel modul) supaya
// berlaku antar-worker.
/* global process, setTimeout */
import { mkdirSync, openSync, closeSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DIR = join(tmpdir(), 'mtc-e2e-locks');
const STALE_MS = 120_000;

/**
 * Ambil kunci bernama `name`. Mengembalikan fungsi `release()`.
 * @param {string} name
 * @param {number} [timeoutMs]
 * @returns {Promise<() => void>}
 */
export async function acquireEmulatorLock(name, timeoutMs = 180_000) {
    mkdirSync(DIR, { recursive: true });
    const file = join(DIR, `${name}.lock`);
    const deadline = Date.now() + timeoutMs;

    for (;;) {
        try {
            const fd = openSync(file, 'wx'); // atomik: gagal kalau sudah ada
            writeFileSync(fd, String(process.pid));
            closeSync(fd);
            let released = false;
            return () => {
                if (released) return;
                released = true;
                try {
                    unlinkSync(file);
                } catch {
                    /* sudah dibersihkan */
                }
            };
        } catch (err) {
            if (!err || err.code !== 'EEXIST') throw err;
            // Worker yang mati mendadak tidak boleh memblokir selamanya.
            try {
                if (Date.now() - statSync(file).mtimeMs > STALE_MS) unlinkSync(file);
            } catch {
                /* kunci sudah lepas sendiri */
            }
            if (Date.now() > deadline) {
                throw new Error(`Kunci emulator "${name}" tidak didapat setelah ${timeoutMs} ms`, { cause: err });
            }
            await new Promise((r) => setTimeout(r, 250));
        }
    }
}
