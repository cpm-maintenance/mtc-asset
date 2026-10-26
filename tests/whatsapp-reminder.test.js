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

import { waPhoneDigits, waLink } from '../src/js/utils.js';
import {
    resolveTechnician,
    reminderText,
    buildApprovedReminder,
    whatsappModule,
} from '../src/js/modules/whatsapp.js';

const workOrders = readFileSync(resolve(process.cwd(), 'public/pages/WorkOrders.html'), 'utf8');
const shell = readFileSync(resolve(process.cwd(), 'public/pages/app-shell.html'), 'utf8');
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

describe('reminderText', () => {
    it('memuat identitas WO, aset, prioritas, tenggat, dan tautan aplikasi', () => {
        const text = reminderText(WO);
        expect(text).toContain('*MTC ASSET — Work Order disetujui*');
        expect(text).toContain('WO: MTC-005');
        expect(text).toContain('Aset: Feeding Pump PU12 (5060-PU-12)');
        expect(text).toContain('Prioritas: Emergency');
        expect(text).toContain('Tenggat: 2026-10-24');
        expect(text).toContain('Buka aplikasi: https://mtc-asset.web.app');
    });

    it('deskripsi dipotong 160 karakter supaya pesan tetap satu blok', () => {
        const text = reminderText({ Deskripsi: 'x'.repeat(400) });
        expect(text).toContain('Pekerjaan: ' + 'x'.repeat(160));
        expect(text).not.toContain('x'.repeat(161));
    });

    it('tidak melempar untuk WO kosong', () => {
        expect(() => reminderText(null)).not.toThrow();
        expect(reminderText({})).toContain('MTC ASSET');
    });
});

describe('buildApprovedReminder', () => {
    it('menghasilkan URL siap buka + nama teknisi', () => {
        const r = buildApprovedReminder(WO, USERS);
        expect(r).not.toBeNull();
        expect(r.name).toBe('Yuli');
        expect(r.url.startsWith('https://wa.me/6281234567890?text=')).toBe(true);
        expect(decodeURIComponent(r.url.split('?text=')[1])).toContain('MTC-005');
    });

    it('null saat teknisi tidak punya nomor', () => {
        expect(buildApprovedReminder({ ...WO, assignedTo: 'Gunawan' }, USERS)).toBeNull();
    });
});

describe('openWaReminder', () => {
    function makeCtx(overrides = {}) {
        return {
            allUsers: USERS,
            showNotification: vi.fn(),
            ...overrides,
        };
    }

    it('membuka WhatsApp di tab baru dan memberi notifikasi', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const ctx = makeCtx();

        const url = whatsappModule.openWaReminder.call(ctx, WO);

        expect(open).toHaveBeenCalledTimes(1);
        expect(open.mock.calls[0][0]).toBe(url);
        expect(open.mock.calls[0][1]).toBe('_blank');
        expect(ctx.showNotification).toHaveBeenCalledWith('Reminder WhatsApp siap dikirim ke Yuli');
    });

    it('nomor tidak tersedia: tidak membuka tab, memberi error yang jelas', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const ctx = makeCtx();

        const url = whatsappModule.openWaReminder.call(ctx, { ...WO, assignedTo: 'Gunawan' });

        expect(url).toBeNull();
        expect(open).not.toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Nomor WhatsApp teknisi belum ada di profil pengguna',
            'error'
        );
    });
});

describe('kontrak UI', () => {
    it('tombol REMINDER WA ada di inspector dan memanggil openWaReminder', () => {
        expect(workOrders).toMatch(/@click="openWaReminder\(woSelected\)"/);
        expect(workOrders).toContain('aria-label="Kirim reminder WhatsApp"');
        expect(workOrders).toMatch(/x-show="woSelected\.Status === 'Approved'"/);
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
