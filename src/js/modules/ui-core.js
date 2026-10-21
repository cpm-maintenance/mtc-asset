// @ts-check
/** @typedef {import('../appstate').AppState} AppState */

/**
 * Inti `ui.js`: hanya anggota yang dipakai SEBELUM login.
 *
 * Layar login hidup di chunk eager (`src/js/modules/login.js`), dan `ui.js`
 * penuh berisi QR scanner, upload Cloudinary, dan helper warna — semuanya hanya
 * dipakai setelah shell terpasang. Kalau layar login mengimpor `ui.js` langsung,
 * seluruh isinya (6,2 KiB gzip) ikut jadi chunk yang di-`modulepreload` di
 * halaman login.
 *
 * `ui.js` meng-`...`-spread objek ini, jadi tetap satu sumber kebenaran dan
 * `app()` tidak berubah.
 */
export const uiCore = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
    setTheme(t) {
        if (!['night', 'navy', 'purple', 'light'].includes(t)) t = 'night';
        this.themeMode = t;
        localStorage.setItem('themeMode', t);
        this.applyTheme();
    },

    applyTheme() {
        const isDark = this.themeMode !== 'light';
        const attr = this.themeMode === 'night' ? 'dark' : this.themeMode;
        document.documentElement.setAttribute('data-theme', attr);
        document.documentElement.classList.toggle('dark', isDark);
        this.darkMode = isDark;
    },

    showNotification(message, type = 'success', duration = 4500) {
        const id = Date.now() + Math.random();
        const config = /** @type {Record<string, any>} */ ({
            success: { icon: 'check_circle', color: 'border-tac-status-operational/40 bg-tac-status-operational/10 text-tac-status-operational', glow: 'shadow-tac-status-operational/20', bar: 'bg-tac-status-operational' },
            error: { icon: 'error', color: 'border-tac-status-emergency/40 bg-tac-status-emergency/10 text-tac-status-emergency', glow: 'shadow-tac-status-emergency/20', bar: 'bg-tac-status-emergency' },
            warning: { icon: 'warning', color: 'border-tac-status-repair/40 bg-tac-status-repair/10 text-tac-status-repair', glow: 'shadow-tac-status-repair/20', bar: 'bg-tac-status-repair' },
            info: { icon: 'info', color: 'border-tac-sync-cyan/40 bg-tac-sync-cyan/10 text-tac-sync-cyan', glow: 'shadow-tac-sync-cyan/20', bar: 'bg-tac-sync-cyan' },
        });
        const c = config[type] || config.info;
        this.notifications.push({
            id,
            message,
            type,
            icon: c.icon,
            color: c.color,
            bar: c.bar,
            glow: c.glow,
            exiting: false,
            progress: 100,
            _start: Date.now(),
            _duration: duration,
        });

        // Animate progress bar
        const interval = setInterval(() => {
            const n = this.notifications.find(x => x.id === id);
            if (!n || n.exiting) { clearInterval(interval); return; }
            const elapsed = Date.now() - n._start;
            n.progress = Math.max(0, 100 - (elapsed / n._duration) * 100);
        }, 50);

        // Auto remove
        setTimeout(() => {
            clearInterval(interval);
            const n = this.notifications.find(x => x.id === id);
            if (n) {
                n.exiting = true;
                setTimeout(() => {
                    // Hapus DI TEMPAT, jangan mengganti referensi array: sejak
                    // S33u larik ini dibagi dengan komponen layar login
                    // (`loginScreen.notifications = instance.notifications`),
                    // jadi menugaskan array baru akan memutus salah satu sisi
                    // dan toast berhenti tampil.
                    const idx = this.notifications.findIndex(x => x.id === id);
                    if (idx > -1) this.notifications.splice(idx, 1);
                }, 400);
            }
        }, duration);
    },
});

/**
 * Tema tersimpan, dengan migrasi kunci lama `darkMode` → `themeMode`.
 * Satu sumber untuk `app()` dan layar login — layar login hidup di chunk eager
 * dan tidak boleh mengimpor `app.js` hanya untuk membaca satu nilai localStorage.
 * @returns {'night'|'navy'|'purple'|'light'|string}
 */
export function readThemeMode() {
    try {
        const m = localStorage.getItem('themeMode');
        if (m) return m;
        const old = localStorage.getItem('darkMode');
        if (old !== null) {
            const v = old === 'true' ? 'night' : 'light';
            localStorage.setItem('themeMode', v);
            localStorage.removeItem('darkMode');
            return v;
        }
    } catch {
        // localStorage bisa diblokir (mode privat/iframe) — jatuh ke default.
    }
    return 'night';
}
