// @ts-check
/**
 * Reminder WhatsApp untuk Work Order yang sudah di-approve.
 *
 * Kanal: tautan `wa.me` — tanpa server, tanpa token, tanpa biaya. Tombol
 * menyiapkan pesan lalu membuka WhatsApp; **pengiriman tetap di tangan
 * operator**, jadi tidak ada pesan yang terkirim diam-diam dan tidak ada
 * kuota API yang bisa habis.
 *
 * Nomor tujuan diambil dari `Users/<uid>/phone` (diisi admin di kelola
 * pengguna). `assignedTo` pada data legacy bisa berupa uid, nama, atau larik
 * keduanya — resolusi mencoba uid dulu, lalu nama, lalu email.
 */
import { waLink } from '../utils.js';
/** @typedef {import('../appstate').AppState} AppState */

const APP_URL = 'https://mtc-asset.web.app';

/**
 * @param {any} value
 * @returns {any[]}
 */
function asArray(value) {
    if (value == null || value === '') return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * @param {any} user
 * @returns {string}
 */
function phoneOf(user) {
    if (!user) return '';
    return String(user.phone || user.Phone || user.noHp || user.NoHP || '').trim();
}

/**
 * Nomor WhatsApp teknisi yang ditugaskan.
 *
 * @param {any[]} users baris `allUsers` ({ uid, email, name?, phone? })
 * @param {any} assignedTo uid / nama / email / larik ketiganya
 * @returns {{ name: string, phone: string } | null} `null` bila tidak ada yang cocok atau nomornya kosong
 */
export function resolveTechnician(users, assignedTo) {
    const list = Array.isArray(users) ? users : [];
    if (!list.length) return null;
    for (const candidate of asArray(assignedTo)) {
        const needle = String(candidate || '').trim();
        if (!needle) continue;
        const lower = needle.toLowerCase();
        const hit =
            list.find((u) => u && u.uid === needle) ||
            list.find((u) => u && String(u.name || '').trim().toLowerCase() === lower) ||
            list.find(
                (u) =>
                    u &&
                    String(u.email || '')
                        .split('@')[0]
                        .toLowerCase() === lower
            );
        const phone = phoneOf(hit);
        if (hit && phone) return { name: hit.name || hit.email || needle, phone };
    }
    return null;
}

/**
 * Teks reminder. Pendek dengan sengaja: dibaca di layar HP teknisi, bukan
 * dokumen — satu blok, tanpa tabel.
 *
 * @param {any} wo
 * @returns {string}
 */
export function reminderText(wo) {
    const w = wo || {};
    const lines = ['*MTC ASSET — Work Order disetujui*', ''];
    if (w.woNumber) lines.push(`WO: ${w.woNumber}`);
    const aset = [w.externalEquipName || w.equipName || '', w.EquipmentID ? `(${w.EquipmentID})` : '']
        .filter(Boolean)
        .join(' ');
    if (aset) lines.push(`Aset: ${aset}`);
    if (w.Jenis) lines.push(`Jenis: ${w.Jenis}`);
    if (w.Prioritas) lines.push(`Prioritas: ${w.Prioritas}`);
    if (w.DueDate) lines.push(`Tenggat: ${w.DueDate}`);
    if (w.Deskripsi) lines.push(`Pekerjaan: ${String(w.Deskripsi).slice(0, 160)}`);
    lines.push('', `Buka aplikasi: ${APP_URL}`);
    return lines.join('\n');
}

/**
 * Siapkan tautan reminder untuk satu WO.
 *
 * @param {any} wo
 * @param {any[]} users
 * @returns {{ url: string, name: string, phone: string, text: string } | null}
 */
export function buildApprovedReminder(wo, users) {
    const tech = resolveTechnician(users, wo && wo.assignedTo);
    if (!tech) return null;
    const text = reminderText(wo);
    const url = waLink(tech.phone, text);
    return url ? { url, name: tech.name, phone: tech.phone, text } : null;
}

export const whatsappModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
    /**
     * Buka WhatsApp dengan pesan reminder untuk satu WO.
     *
     * `window.open` dipanggil langsung dari klik (tidak setelah `await`) supaya
     * tidak diblokir popup blocker.
     *
     * @param {any} wo
     * @returns {string|null} URL yang dibuka, atau `null` bila nomor tidak tersedia
     */
    openWaReminder(wo) {
        const reminder = buildApprovedReminder(wo, this.allUsers || []);
        if (!reminder) {
            this.showNotification('Nomor WhatsApp teknisi belum ada di profil pengguna', 'error');
            return null;
        }
        window.open(reminder.url, '_blank', 'noopener');
        this.showNotification(`Reminder WhatsApp siap dikirim ke ${reminder.name}`);
        return reminder.url;
    },
});
