// @vitest-environment jsdom
/**
 * Reminder WhatsApp untuk WO yang sudah di-approve (S45d).
 *
 * Kanal yang dipilih: tautan **`wa.me`** — tanpa server, tanpa token, tanpa
 * biaya. Tombol menyiapkan pesan lalu membuka WhatsApp; pengiriman tetap di
 * tangan operator, jadi tidak ada pesan terkirim diam-diam.
 *
 * Nomor tujuan: `Users/<uid>/phone`, diisi admin di kelola pengguna.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { waPhoneDigits, waLink, waShareLink } from '../src/js/utils.js';
import {
    resolveTechnician,
    woReminderText,
    partReminderText,
    buildWoReminder,
    buildPartReminder,
    whatsappModule,
} from '../src/js/modules/whatsapp.js';

const workOrders = readFileSync(resolve(process.cwd(), 'public/pages/WorkOrders.html'), 'utf8');
const shell = readFileSync(resolve(process.cwd(), 'public/pages/app-shell.html'), 'utf8');
const parts = readFileSync(resolve(process.cwd(), 'public/pages/RequestPart.html'), 'utf8');
const auth = readFileSync(resolve(process.cwd(), 'src/js/modules/auth.js'), 'utf8');

const USERS = [
    { uid: 'uid-yuli', email: 'yuli@mtc.local', name: 'Yuli', phone: '0812-3456-7890' },
    { uid: 'uid-gun', email: 'gunawan@mtc.local', name: 'Gunawan', phone: '' },
    { uid: 'uid-mar', email: 'maruf@mtc.local', phone: '+62 813 1111 2222' },
];

const WO = {
    LogID: 'LOG-1',
    woNumber: 'MTC-005',
    EquipmentID: '5060-PU-12',
    externalEquipName: 'Feeding Pump PU12',
    Jenis: 'Corrective',
    Prioritas: 'Emergency',
    DueDate: '2026-10-24',
    Deskripsi: 'Perbaikan seal pompa',
    assignedTo: 'uid-yuli',
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('waPhoneDigits — normalisasi nomor Indonesia', () => {
    it('bentuk yang benar-benar diketik operator', () => {
        expect(waPhoneDigits('0812-3456-7890')).toBe('6281234567890');
        expect(waPhoneDigits('+62 812 3456 7890')).toBe('6281234567890');
        expect(waPhoneDigits('62 812 3456 7890')).toBe('6281234567890');
        expect(waPhoneDigits('8123456789')).toBe('628123456789');
    });

    it('menolak nomor yang tidak masuk akal', () => {
        expect(waPhoneDigits('')).toBeNull();
        expect(waPhoneDigits(null)).toBeNull();
        expect(waPhoneDigits('12345')).toBeNull();
        expect(waPhoneDigits('1234567890123456789')).toBeNull();
    });
});

describe('waLink', () => {
    it('membentuk tautan wa.me dengan teks ter-encode', () => {
        const url = waLink('0812-3456-7890', 'Halo *MTC* & rekan');
        expect(url).toBe('https://wa.me/6281234567890?text=Halo%20*MTC*%20%26%20rekan');
    });

    it('null kalau nomor tidak sah', () => {
        expect(waLink('123', 'x')).toBeNull();
    });

    it('waShareLink: tautan tanpa nomor untuk diteruskan sendiri', () => {
        expect(waShareLink('Halo & rekan')).toBe('https://wa.me/?text=Halo%20%26%20rekan');
    });
});

describe('resolveTechnician', () => {
    it('cocok lewat uid', () => {
        expect(resolveTechnician(USERS, 'uid-yuli')).toEqual({ name: 'Yuli', phone: '0812-3456-7890' });
    });

    it('cocok lewat nama (tanpa peduli huruf besar/kecil)', () => {
        expect(resolveTechnician(USERS, 'yuli')).toEqual({ name: 'Yuli', phone: '0812-3456-7890' });
    });

    it('cocok lewat email tanpa domain', () => {
        expect(resolveTechnician(USERS, 'maruf')).toEqual({ name: 'maruf@mtc.local', phone: '+62 813 1111 2222' });
    });

    it('larik legacy: lewati yang nomornya kosong, ambil yang punya nomor', () => {
        expect(resolveTechnician(USERS, ['Gunawan', 'Yuli'])).toEqual({ name: 'Yuli', phone: '0812-3456-7890' });
    });

    it('null saat tidak ada yang cocok atau nomornya kosong', () => {
        expect(resolveTechnician(USERS, 'Gunawan')).toBeNull();
        expect(resolveTechnician(USERS, 'Tidak Ada')).toBeNull();
        expect(resolveTechnician([], 'uid-yuli')).toBeNull();
    });
});

describe('woReminderText', () => {
    it('memuat identitas WO, aset, prioritas, tenggat, dan tautan aplikasi', () => {
        const text = woReminderText({ ...WO, Status: 'Approved' });
        expect(text).toContain('*MTC ASSET — Work Order disetujui*');
        expect(text).toContain('WO: MTC-005');
        expect(text).toContain('Aset: Feeding Pump PU12 (5060-PU-12)');
        expect(text).toContain('Prioritas: Emergency');
        expect(text).toContain('Tenggat: 2026-10-24');
        expect(text).toContain('Buka aplikasi: https://mtc-asset.web.app');
    });

    it('sebelum approved kata kerjanya "menunggu persetujuan"', () => {
        expect(woReminderText({ ...WO, Status: 'Pending' })).toContain('menunggu persetujuan');
        expect(woReminderText({ ...WO, Status: 'Draft' })).not.toContain('disetujui');
    });

    it('deskripsi dipotong 160 karakter supaya pesan tetap satu blok', () => {
        const text = woReminderText({ Deskripsi: 'x'.repeat(400) });
        expect(text).toContain('Pekerjaan: ' + 'x'.repeat(160));
        expect(text).not.toContain('x'.repeat(161));
    });

    it('tidak melempar untuk WO kosong', () => {
        expect(() => woReminderText(null)).not.toThrow();
        expect(woReminderText({})).toContain('MTC ASSET');
    });
});

describe('partReminderText', () => {
    const REQ = {
        id: 'REQ_1',
        items: [
            { itemName: 'Bearing SKF 6205', quantity: 2, unit: 'pcs', partId: 'P-001' },
            { itemName: 'Seal kit', quantity: 1, unit: 'set' },
        ],
        priority: 'high',
        woNumber: 'MTC-005',
        status: 'pending',
        notes: 'Mendesak',
    };

    it('menuliskan setiap item dengan qty + satuan', () => {
        const text = partReminderText(REQ);
        expect(text).toContain('*MTC ASSET — Permintaan part*');
        expect(text).toContain('No: REQ_1');
        expect(text).toContain('- 2 pcs x Bearing SKF 6205 (P-001)');
        expect(text).toContain('- 1 set x Seal kit');
        expect(text).toContain('Untuk WO: MTC-005');
        expect(text).toContain('Catatan: Mendesak');
    });

    it('record lama tanpa larik items tetap terbaca', () => {
        const text = partReminderText({ itemName: 'V-Belt', quantity: 3, unit: 'pcs' });
        expect(text).toContain('- 3 pcs x V-Belt');
    });
});

describe('buildWoReminder / buildPartReminder', () => {
    it('nomor teknisi diketahui: tautan menuju nomor itu', () => {
        const r = buildWoReminder(WO, USERS);
        expect(r.targeted).toBe(true);
        expect(r.name).toBe('Yuli');
        expect(r.url.startsWith('https://wa.me/6281234567890?text=')).toBe(true);
        expect(decodeURIComponent(r.url.split('?text=')[1])).toContain('MTC-005');
    });

    it('nomor tidak diketahui: tautan tanpa nomor supaya bisa diteruskan sendiri', () => {
        const r = buildWoReminder({ ...WO, assignedTo: 'Gunawan' }, USERS);
        expect(r.targeted).toBe(false);
        expect(r.name).toBe('');
        expect(r.url.startsWith('https://wa.me/?text=')).toBe(true);
        expect(decodeURIComponent(r.url.split('?text=')[1])).toContain('MTC-005');
    });

    it('permintaan part: penerima dari requestedBy', () => {
        const r = buildPartReminder({ id: 'REQ_1', items: [{ itemName: 'Seal kit', quantity: 1 }], requestedBy: 'yuli' }, USERS);
        expect(r.targeted).toBe(true);
        expect(r.name).toBe('Yuli');
        expect(decodeURIComponent(r.url.split('?text=')[1])).toContain('Seal kit');
    });

    it('permintaan part tanpa penerima: tautan generik', () => {
        const r = buildPartReminder({ id: 'REQ_2', itemName: 'V-Belt', quantity: 2 }, USERS);
        expect(r.targeted).toBe(false);
        expect(r.url.startsWith('https://wa.me/?text=')).toBe(true);
    });
});

describe('openWaReminder / openWaPartReminder', () => {
    function makeCtx(overrides = {}) {
        return {
            allUsers: USERS,
            showNotification: vi.fn(),
            ...overrides,
        };
    }

    it('WO: membuka tab baru dan menyebut penerimanya', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const ctx = makeCtx();

        const url = whatsappModule.openWaReminder.call(ctx, WO);

        expect(open).toHaveBeenCalledTimes(1);
        expect(open.mock.calls[0][0]).toBe(url);
        expect(open.mock.calls[0][1]).toBe('_blank');
        expect(ctx.showNotification).toHaveBeenCalledWith('Reminder WhatsApp untuk Yuli');
    });

    it('WO tanpa nomor: tetap membuka tautan, pesannya "teruskan sendiri"', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const ctx = makeCtx();

        const url = whatsappModule.openWaReminder.call(ctx, { ...WO, assignedTo: 'Gunawan' });

        expect(open).toHaveBeenCalledTimes(1);
        expect(url.startsWith('https://wa.me/?text=')).toBe(true);
        expect(ctx.showNotification).toHaveBeenCalledWith('Tautan WhatsApp siap — teruskan ke teknisi');
    });

    it('permintaan part: membuka tautan dan memberi notifikasi', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const ctx = makeCtx();

        const url = whatsappModule.openWaPartReminder.call(ctx, { id: 'REQ_3', itemName: 'Seal', quantity: 1 });

        expect(open).toHaveBeenCalledTimes(1);
        expect(url.startsWith('https://wa.me/?text=')).toBe(true);
        expect(ctx.showNotification).toHaveBeenCalledWith('Tautan WhatsApp siap — teruskan ke bagian part');
    });
});

describe('kontrak UI', () => {
    it('tombol reminder WA ada di inspector WO dan tampil sebelum approved', () => {
        expect(workOrders).toMatch(/@click="openWaReminder\(woSelected\)"/);
        expect(workOrders).toContain('aria-label="Kirim reminder WhatsApp"');
        // Bukan hanya saat Approved: yang diminta justru tautan sebelum approval.
        expect(workOrders).toContain("woSelected.Status !== 'Completed' && woSelected.Status !== 'Cancelled'");
        expect(workOrders).not.toMatch(/x-show="woSelected\.Status === 'Approved'"\s*\n\s*@click="openWaReminder/);
    });

    it('tombol reminder WA ada di setiap kartu permintaan part', () => {
        expect(parts).toMatch(/@click\.stop="openWaPartReminder\(req\)"/);
        expect(parts).toContain('aria-label="Kirim reminder WhatsApp permintaan part"');
    });

    it('tombol memakai ikon WhatsApp inline, bukan ligatur notifications', () => {
        for (const frag of [workOrders, parts]) {
            expect(frag).toContain('data-wa-icon');
            expect(frag).toMatch(/data-wa-icon[^>]*fill="currentColor"/);
            // Ikon brand tidak ada di subset Material Symbols; kalau ligatur
            // dipakai lagi, yang tampil adalah teks "notifications".
            expect(frag).not.toMatch(/openWa(Part)?Reminder[\s\S]{0,600}?>notifications</);
        }
    });

    it('input nomor WhatsApp ada di kedua modal pengguna dengan label statis', () => {
        expect(shell).toContain('x-model="newUserForm.phone"');
        expect(shell).toContain('x-model="editUserForm.phone"');
        expect(shell).toContain('aria-label="Nomor WhatsApp pengguna baru"');
        expect(shell).toContain('aria-label="Nomor WhatsApp pengguna"');
        expect(shell).not.toContain(':aria-label="Nomor WhatsApp');
    });

    it('nomor disimpan saat buat & edit pengguna', () => {
        expect(auth).toContain('async createUser(email, password, role = \'user\', phone = \'\')');
        expect(auth).toMatch(/phone: String\(phone \|\| ''\)\.trim\(\)/);
        expect(auth).toMatch(/phone: String\(this\.editUserForm\.phone \|\| ''\)\.trim\(\)/);
        expect(auth).toContain('this.newUserForm.phone');
    });
});
