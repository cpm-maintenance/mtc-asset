// @ts-check
/**
 * confirm-dialog.js — dialog konfirmasi in-app, pengganti `window.confirm()`.
 *
 * Kenapa bukan Alpine: dialog ini dipanggil dari modul mana pun, termasuk dari
 * layar login (`logout()`, `systemReset()`) **dan** dari dalam `app()` setelah
 * shell dimuat. Menaruhnya di markup berarti menduplikasi state di dua scope
 * Alpine (`login()` dan `app()`), persis pola yang pernah membuat toast
 * pasca-login hilang (S33u-b). Di sini DOM dibuat imperatif, jadi satu
 * implementasi berlaku untuk semua scope tanpa state bersama.
 *
 * Seam `window.__confirmModal` sengaja ada: `askConfirm()` memakai dialog
 * modern hanya kalau `installConfirmDialog()` sudah dipanggil (main.js). Di
 * lingkungan tes/jsdom — dan di bundle lama yang belum memasangnya — ia jatuh
 * ke `window.confirm()` sehingga perilaku modul pemanggil tidak berubah dan
 * 1800+ tes lama tetap sah.
 */

/** @typedef {'primary'|'danger'} ConfirmTone */

const DEFAULTS = {
    title: 'Konfirmasi',
    confirmLabel: 'Ya, lanjutkan',
    cancelLabel: 'Batal',
    tone: /** @type {ConfirmTone} */ ('primary'),
};

const TONES = {
    primary: {
        icon: 'help',
        chip: 'bg-tac-gold-bright/15',
        accent: 'text-tac-gold-bright',
        button: 'bg-tac-gold-bright text-tac-surface-base hover:bg-tac-gold-bright/90',
        focusOk: true,
    },
    danger: {
        icon: 'warning',
        chip: 'bg-tac-status-emergency/15',
        accent: 'text-tac-status-emergency',
        button:
            'bg-tac-status-emergency/15 border border-tac-status-emergency/40 text-tac-status-emergency hover:bg-tac-status-emergency/25',
        focusOk: false,
    },
};

const MARKUP = `
  <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-body"
       class="w-full max-w-md bg-tac-surface-card/95 backdrop-blur-xl border border-tac-border-tactical shadow-2xl p-6">
    <div class="flex items-start gap-4">
      <div data-confirm-chip class="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center">
        <span data-confirm-icon class="material-symbols-outlined text-xl"></span>
      </div>
      <div class="min-w-0 flex-1">
        <h3 id="confirm-dialog-title" data-confirm-title class="text-base font-black text-tac-on-surface tac-glow-text"></h3>
        <p id="confirm-dialog-body" data-confirm-body class="text-sm text-tac-on-surface-variant mt-2 leading-relaxed whitespace-pre-line"></p>
      </div>
    </div>
    <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
      <button type="button" data-confirm-cancel
              class="min-h-11 px-4 rounded-xl border border-tac-border-tactical bg-tac-surface-container-low text-tac-on-surface-variant font-mono text-[11px] uppercase tracking-[0.15em] hover:bg-tac-surface-container hover:text-tac-on-surface transition-all"></button>
      <button type="button" data-confirm-ok
              class="min-h-11 px-4 rounded-xl font-mono text-[11px] uppercase tracking-[0.15em] transition-all active:scale-95"></button>
    </div>
  </div>
`;

/** @typedef {{ close: (result: boolean) => void }} ActiveDialog */
/** Dialog yang sedang terbuka — hanya satu, tidak pernah menumpuk. */
/** @type {ActiveDialog|null} */
let active = null;

/**
 * @param {string} message
 * @param {Partial<typeof DEFAULTS> & { tone?: ConfirmTone }} [options]
 * @returns {Promise<boolean>}
 */
export function askConfirm(message, options = {}) {
    const opts = { ...DEFAULTS, ...options, message: String(message ?? '') };
    const provider = typeof window !== 'undefined' ? /** @type {any} */ (window).__confirmModal : undefined;
    if (typeof provider === 'function') {
        return provider(opts);
    }
    // Lingkungan tanpa dialog terpasang (jsdom/tes, atau bundle lama).
    return Promise.resolve(typeof confirm === 'function' ? confirm(opts.message) : false);
}

/**
 * Pasang dialog modern sebagai provider global. Idempoten.
 * @param {any} [target]
 * @returns {boolean} true bila provider terpasang
 */
export function installConfirmDialog(target = typeof window !== 'undefined' ? window : undefined) {
    if (!target) return false;
    target.__confirmModal = showConfirmModal;
    return true;
}

/**
 * Render dialog dan tunggu keputusan user. `true` = lanjutkan.
 * @param {Partial<typeof DEFAULTS> & { message?: string, tone?: ConfirmTone }} [options]
 * @returns {Promise<boolean>}
 */
export function showConfirmModal(options = {}) {
    const cfg = { ...DEFAULTS, ...options, message: String(options.message ?? '') };

    if (typeof document === 'undefined' || !document.body) {
        return Promise.resolve(typeof confirm === 'function' ? confirm(cfg.message) : false);
    }

    // Dialog sebelumnya ditutup sebagai "batal" — jangan menumpuk.
    if (active) active.close(false);

    const tone = TONES[cfg.tone] || TONES.primary;
    const root = document.createElement('div');
    root.className =
        'fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4';
    // `MARKUP` adalah konstanta statis tanpa interpolasi; seluruh teks dinamis
    // diisi lewat `textContent` di bawah, jadi tidak ada jalur XSS dari sini.
    root.innerHTML = MARKUP;

    const panel = /** @type {HTMLElement} */ (root.firstElementChild);
    const chip = /** @type {HTMLElement} */ (root.querySelector('[data-confirm-chip]'));
    const icon = /** @type {HTMLElement} */ (root.querySelector('[data-confirm-icon]'));
    const okBtn = /** @type {HTMLButtonElement} */ (root.querySelector('[data-confirm-ok]'));
    const cancelBtn = /** @type {HTMLButtonElement} */ (root.querySelector('[data-confirm-cancel]'));

    /** @type {HTMLElement} */ (root.querySelector('[data-confirm-title]')).textContent = cfg.title;
    /** @type {HTMLElement} */ (root.querySelector('[data-confirm-body]')).textContent = cfg.message;
    okBtn.textContent = cfg.confirmLabel;
    cancelBtn.textContent = cfg.cancelLabel;
    chip.classList.add(...tone.chip.split(' '));
    icon.classList.add(...tone.accent.split(' '));
    icon.textContent = tone.icon;
    okBtn.classList.add(...tone.button.split(' '));
    panel.classList.add('confirm-dialog-panel');

    const previousFocus = /** @type {any} */ (document.activeElement);

    return new Promise((resolve) => {
        let settled = false;

        /** @param {boolean} result */
        const close = (result) => {
            if (settled) return;
            settled = true;
            document.removeEventListener('keydown', onKey, true);
            root.remove();
            active = null;
            if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
            resolve(result);
        };

        /** @param {KeyboardEvent} event */
        function onKey(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close(false);
            }
        }

        okBtn.addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));
        root.addEventListener('click', (event) => {
            if (event.target === root) close(false);
        });
        document.addEventListener('keydown', onKey, true);

        active = { close };
        document.body.appendChild(root);
        (tone.focusOk ? okBtn : cancelBtn).focus();
    });
}
