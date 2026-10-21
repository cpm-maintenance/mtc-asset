// @ts-check
import { authModule } from './auth.js';
import { uiModule, readThemeMode } from './ui.js';
/** @typedef {import('../appstate').AppState} AppState */

/**
 * State layar login — satu-satunya potongan aplikasi yang tetap **eager**.
 *
 * Chunk `app-*.js` (app.js 2.604 baris + 13 mixin + bootstrap) sengaja dimuat
 * malas: `bootup-time`-nya terukur **402 ms** (357 ms scripting) di perangkat
 * mobile, dan 47,2 dari 54,2 KiB isinya tidak dipakai layar login sama sekali.
 * Yang benar-benar dibaca markup login hanya status sesi, toast, tema, dan tiga
 * metode auth — semuanya sudah tinggal di `auth.js` / `ui.js` yang memang eager.
 *
 * Sumber tunggal: nilai dan metode di-spread dari modul yang sama dengan
 * `app()`, jadi tidak ada implementasi ganda yang bisa menyimpang. Kedua modul
 * itu tidak punya getter, jadi spread biasa tidak membekukan nilai apa pun.
 *
 * @returns {Record<string, any>} Objek state mentah; `main.js` membungkusnya
 *   dengan `Alpine.reactive()` sebelum diekspos sebagai `window.__loginScreen`.
 */
export function createLoginScreen() {
    return {
        // Status sesi. Ditulis hanya oleh listener auth di `main.js` — lewat
        // proxy reaktif, bukan objek mentah (lihat catatan `react()` di main.js).
        isLoggedIn: false,
        isLoading: true,
        user: null,
        userRole: 'user',
        notifications: [],
        darkMode: true,
        themeMode: readThemeMode(),

        ...uiModule,
        ...authModule,

        /**
         * Dipanggil Alpine sekali saat scope `<body x-data="login()">` dibuat.
         * Tema harus terpasang sebelum paint pertama, dan `bootstrap.init()`
         * (yang dulu melakukannya) ikut chunk yang malas.
         */
        init() {
            this.applyTheme();
        },
    };
}
