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
import { waLink, waShareLink } from '../utils.js';
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
 * Teks reminder Work Order. Pendek dengan sengaja: dibaca di layar HP, bukan
 * dokumen. Kata kerja mengikuti status — sebelum approved pesannya berbunyi
 * "menunggu persetujuan", bukan "disetujui".
 *
 * @param {any} wo
 * @returns {string}
 */
export function woReminderText(wo) {
    const w = wo || {};
    const approved = String(w.Status || '') === 'Approved';
    const lines = [`*MTC ASSET — Work Order ${approved ? 'disetujui' : 'menunggu persetujuan'}*`, ''];
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
 * Teks reminder permintaan part. Semua baris item ikut, karena bagian part
 * perlu tahu jumlah per item — bukan hanya totalnya.
 *
 * @param {any} req
 * @returns {string}
 */
export function partReminderText(req) {
    const r = req || {};
    const lines = ['*MTC ASSET — Permintaan part*', ''];
    if (r.id) lines.push(`No: ${r.id}`);
    const items = Array.isArray(r.items) && r.items.length
        ? r.items
        : [{ itemName: r.itemName, quantity: r.quantity, unit: r.unit, partId: r.partId }];
    for (const it of items) {
        if (!it) continue;
        const qty = [it.quantity, it.unit].filter(Boolean).join(' ');
        const name = it.itemName || it.partId || '';
        if (!qty && !name) continue;
        lines.push(`- ${[qty, name].filter(Boolean).join(' x ')}${it.partId && it.partId !== name ? ` (${it.partId})` : ''}`);
    }
    if (r.priority) lines.push(`Prioritas: ${r.priority}`);
    if (r.woNumber) lines.push(`Untuk WO: ${r.woNumber}`);
    if (r.status) lines.push(`Status: ${r.status}`);
    if (r.notes) lines.push(`Catatan: ${String(r.notes).slice(0, 140)}`);
    lines.push('', `Buka aplikasi: ${APP_URL}`);
    return lines.join('\n');
}

/**
 * Tautan siap pakai: ke nomor penerima bila nomornya diketahui, kalau tidak
 * tautan **tanpa nomor** supaya operator bisa meneruskan sendiri.
 *
 * @param {any[]} users
 * @param {any} person uid / nama / email / larik
 * @param {string} text
 * @returns {{ url: string, name: string, phone: string, targeted: boolean, text: string }}
 */
function reminderFor(users, person, text) {
    const tech = resolveTechnician(users, person);
    if (tech) {
        return { url: waLink(tech.phone, text) || waShareLink(text), name: tech.name, phone: tech.phone, targeted: true, text };
    }
    return { url: waShareLink(text), name: '', phone: '', targeted: false, text };
}

/**
 * @param {any} wo
 * @param {any[]} users
 * @returns {{ url: string, name: string, phone: string, targeted: boolean, text: string }}
 */
export function buildWoReminder(wo, users) {
    return reminderFor(users, wo && wo.assignedTo, woReminderText(wo));
}

/**
 * @param {any} req
 * @param {any[]} users
 * @returns {{ url: string, name: string, phone: string, targeted: boolean, text: string }}
 */
export function buildPartReminder(req, users) {
    const person = req && (req.requestedBy || req.createdBy || req.technician || req.assignedTo);
    return reminderFor(users, person, partReminderText(req));
}

export const whatsappModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
    /**
     * Buka WhatsApp dengan pesan reminder Work Order.
     *
     * `window.open` dipanggil langsung dari klik (tidak setelah `await`) supaya
     * tidak diblokir popup blocker. Tanpa nomor penerima, WhatsApp membuka
     * pemilih kontak — operator meneruskan sendiri.
     *
     * @param {any} wo
     * @returns {string} URL yang dibuka
     */
    openWaReminder(wo) {
        const reminder = buildWoReminder(wo, this.allUsers || []);
        window.open(reminder.url, '_blank', 'noopener');
        this.showNotification(
            reminder.targeted
                ? `Reminder WhatsApp untuk ${reminder.name}`
                : 'Tautan WhatsApp siap — teruskan ke teknisi'
        );
        return reminder.url;
    },

    /**
     * Sama untuk permintaan part (`Requisitions`).
     *
     * @param {any} req
     * @returns {string} URL yang dibuka
     */
    openWaPartReminder(req) {
        const reminder = buildPartReminder(req, this.allUsers || []);
        window.open(reminder.url, '_blank', 'noopener');
        this.showNotification(
            reminder.targeted
                ? `Reminder WhatsApp untuk ${reminder.name}`
                : 'Tautan WhatsApp siap — teruskan ke bagian part'
        );
        return reminder.url;
    },
});
