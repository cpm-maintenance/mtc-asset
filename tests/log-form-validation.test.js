// @vitest-environment jsdom
/**
 * Pesan validasi inline form log (S39h).
 *
 * Aturan blokir tetap milik `validateLogForm()` di `utils.js` (dipakai
 * `submitLog`); `syncLogFormErrors()` hanya menerjemahkan kondisi yang sama
 * menjadi pesan per field untuk ditampilkan di markup, plus dua aturan yang
 * tidak ada di utils: tenggat lebih awal dari tanggal, dan angka negatif.
 */
import { describe, it, expect, vi } from 'vitest';
import { logsModule } from '../src/js/modules/logs.js';
import { validateLogForm } from '../src/js/utils.js';

const makeCtx = (logForm) =>
    Object.assign(Object.create(logsModule), {
        logForm,
        logFormErrors: {},
        showNotification: vi.fn(),
    });

const valid = () => ({
    equipmentId: 'EQ-1',
    date: '2026-10-25',
    desc: 'Seal aus',
    estimatedHours: '',
    actualHours: '',
    dueDate: '',
});

describe('syncLogFormErrors', () => {
    it('form lengkap: tidak ada error dan dianggap valid', () => {
        const ctx = makeCtx(valid());
        expect(ctx.syncLogFormErrors()).toBe(true);
        expect(ctx.logFormErrors).toEqual({});
        expect(ctx.isLogFormValid).toBe(true);
        expect(ctx.logFormErrorCount).toBe(0);
    });

    it('tiga field wajib kosong: satu pesan per field', () => {
        const ctx = makeCtx({ equipmentId: '', date: '', desc: '   ' });
        expect(ctx.syncLogFormErrors()).toBe(false);
        expect(Object.keys(ctx.logFormErrors).sort()).toEqual(['date', 'desc', 'equipmentId']);
        expect(ctx.logFormErrors.equipmentId).toBe('Pilih aset dulu');
        expect(ctx.logFormErrorCount).toBe(3);
        expect(ctx.isLogFormValid).toBe(false);
    });

    it('tenggat lebih awal dari tanggal pekerjaan ditolak', () => {
        const ctx = makeCtx({ ...valid(), dueDate: '2026-10-20' });
        expect(ctx.syncLogFormErrors()).toBe(false);
        expect(ctx.logFormErrors.dueDate).toContain('Tenggat');
        expect(ctx.logFormErrorCount).toBe(1);
    });

    it('tenggat sama dengan tanggal boleh', () => {
        const ctx = makeCtx({ ...valid(), dueDate: '2026-10-25' });
        expect(ctx.syncLogFormErrors()).toBe(true);
    });

    it('jam negatif ditolak, string kosong dianggap belum diisi', () => {
        const neg = makeCtx({ ...valid(), estimatedHours: -1 });
        expect(neg.syncLogFormErrors()).toBe(false);
        expect(neg.logFormErrors.estimatedHours).toBe('Tidak boleh negatif');

        const blank = makeCtx({ ...valid(), estimatedHours: '' });
        expect(blank.syncLogFormErrors()).toBe(true);
    });

    it('validasi dijalankan ulang: pesan lama hilang setelah field diperbaiki', () => {
        const ctx = makeCtx({ equipmentId: '', date: '', desc: '' });
        ctx.syncLogFormErrors();
        expect(ctx.logFormErrorCount).toBe(3);

        Object.assign(ctx.logForm, valid());
        expect(ctx.syncLogFormErrors()).toBe(true);
        expect(ctx.logFormErrors).toEqual({});
    });
});

// Guard: missing Other explanations or impossible needed-by dates must block writes.
describe('WO request extensions validation', () => {
    it.each([
        ['rca', 'rcaOther'],
        ['woPriority', 'woPriorityOther'],
    ])('%s Other rejects absent, empty and whitespace explanations', (choice, detail) => {
        for (const value of [undefined, '', '   ']) {
            const form = { ...valid(), [choice]: 'Other', [detail]: value };
            const ctx = makeCtx(form);
            expect(ctx.isLogFormValid).toBe(false);
            expect(ctx.syncLogFormErrors()).toBe(false);
            expect(ctx.logFormErrors[detail]).toBeTruthy();
            expect(ctx.logFormErrorCount).toBe(1);
            expect(validateLogForm(form)).toHaveLength(1);
        }
    });

    it.each([
        ['rca', 'rcaOther', 'PM'],
        ['woPriority', 'woPriorityOther', 'Normal'],
    ])('%s accepts explanation and removes obsolete errors when choice changes', (choice, detail, normal) => {
        const form = { ...valid(), [choice]: 'Other', [detail]: 'Pekerjaan fasilitas umum' };
        const ctx = makeCtx(form);
        expect(ctx.syncLogFormErrors()).toBe(true);
        expect(validateLogForm(form)).toEqual([]);
        form[detail] = '';
        ctx.syncLogFormErrors();
        form[choice] = normal;
        expect(ctx.isLogFormValid).toBe(true);
        expect(ctx.syncLogFormErrors()).toBe(true);
        expect(validateLogForm(form)).toEqual([]);
    });

    it('both Other selections count as two missing fields', () => {
        const ctx = makeCtx({ ...valid(), rca: 'Other', woPriority: 'Other' });
        expect(ctx.syncLogFormErrors()).toBe(false);
        expect(ctx.logFormErrorCount).toBe(2);
    });

    it.each(['2030-02-30', '2030-13-01', '2030-2-01', 'not-a-date'])('rejects invalid needed-by date %s', (neededByDate) => {
        const form = { ...valid(), neededByDate };
        const ctx = makeCtx(form);
        expect(ctx.isLogFormValid).toBe(false);
        expect(ctx.syncLogFormErrors()).toBe(false);
        expect(ctx.logFormErrors.neededByDate).toBeTruthy();
        expect(ctx.logFormErrorCount).toBe(1);
        expect(validateLogForm(form)).toHaveLength(1);
    });

    it.each([undefined, '', '2032-02-29', '2030-12-01', '2020-01-01'])('accepts optional or real needed-by date %s including future dates', (neededByDate) => {
        const form = { ...valid(), neededByDate };
        const ctx = makeCtx(form);
        expect(ctx.syncLogFormErrors()).toBe(true);
        expect(ctx.isLogFormValid).toBe(true);
        expect(validateLogForm(form)).toEqual([]);
    });
});
