// @vitest-environment jsdom
/**
 * Kontrak form log maintenance + aksesibilitas viewport.
 *
 * Tiga hal di sini pernah salah dan gagal SENYAP:
 *
 * 1. `index.html` memakai `maximum-scale=1, user-scalable=no` → pinch-zoom mati,
 *    melanggar WCAG 1.4.4 (Resize Text) dan menggagalkan audit Lighthouse
 *    `meta-viewport`.
 * 2. Field `logForm.actualHours` dan `logForm.completedDate` **ada di state dan
 *    ikut tersimpan** (`constants.ts` + `logs.js` submit) tetapi modal log inline
 *    tidak punya input-nya — nilainya selalu `0` / `''`. Input-nya dulu hanya
 *    ada di fragment mati `public/components/modals/LogModal.html` (dihapus di
 *    Q-3). Sekarang sudah dipindah ke `index.html`.
 * 3. Field permintaan departemen (`requesterContact`, `neededByDate`) dan
 *    keterangan `Other` (`rcaOther`, `woPriorityOther`) ikut tersimpan, tetapi
 *    tanpa kontrol di UI nilainya selalu kosong; tanpa `syncLogFormErrors()` di
 *    `@change`/`@input` pesan "wajib diisi" tetap tampil setelah pilihan
 *    diganti kembali (stale validation).
 */
import { describe, it, expect, afterEach } from 'vitest';
import Alpine from 'alpinejs';
import { fireEvent, getByLabelText, getByRole, waitFor } from '@testing-library/dom';
import { logsModule } from '../src/js/modules/logs.js';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOG_FORM } from '../src/js/constants.ts';

const ROOT = process.cwd();
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
// Modal form log tinggal di fragmen shell (index.html hanya layar login).
const shell = fs.readFileSync(path.join(ROOT, 'public/pages/app-shell.html'), 'utf-8');
const markup = `${index}\n${shell}`;
const workOrders = fs.readFileSync(path.join(ROOT, 'public/pages/WorkOrders.html'), 'utf-8');

describe('viewport — zoom tidak boleh diblokir (WCAG 1.4.4)', () => {
    it('meta viewport tidak mematikan pinch-zoom', () => {
        const m = index.match(/<meta name="viewport" content="([^"]+)"/);
        expect(m).not.toBeNull();
        const content = m[1];

        expect(content).toContain('width=device-width');
        expect(content).not.toMatch(/user-scalable\s*=\s*no/i);
        expect(content).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
    });
});

describe('form log — field yang disubmit punya input di UI', () => {
    it('DEFAULT_LOG_FORM mendeklarasikan actualHours dan completedDate', () => {
        const form = DEFAULT_LOG_FORM();

        // Tanpa deklarasi ini `x-model` mengikat ke properti undefined dan nilai
        // awalnya tidak pernah ter-reset saat modal dibuka ulang.
        // Nilai awal numerik sengaja string kosong: field baru harus tampil kosong
        // dengan placeholder, bukan "0" yang terbaca seperti data terisi.
        // `submitLog` menormalkan dengan Number(...) || 0, jadi simpanan tetap angka.
        expect(form).toHaveProperty('actualHours', '');
        expect(form).toHaveProperty('estimatedHours', '');
        expect(form).toHaveProperty('downtime', '');
        expect(form).toHaveProperty('cost', '');
        expect(form).toHaveProperty('completedDate', '');
    });

    it('modal log inline punya input Actual Hours', () => {
        expect(markup).toContain('x-model="logForm.actualHours"');
        expect(markup).toMatch(/x-model="logForm\.actualHours"[^>]*step="0\.1"/);
    });

    it('modal log inline punya input Completed Date yang dibatasi hari ini', () => {
        expect(markup).toContain('x-model="logForm.completedDate"');
        expect(markup).toMatch(/x-model="logForm\.completedDate"[^>]*:max="new Date\(\)\.toISOString\(\)/);
    });

    it('Completed Date hanya muncul saat status Completed', () => {
        const at = markup.indexOf('x-model="logForm.completedDate"');
        expect(at).toBeGreaterThan(-1);
        // `x-show` berada di pembungkus <div> sebelum input-nya.
        const wrapper = markup.slice(Math.max(0, at - 400), at);
        expect(wrapper).toContain(`x-show="logForm.status === 'Completed'"`);
    });

    it('memilih status Completed mengisi completedDate otomatis', () => {
        const at = markup.indexOf('x-model="logForm.status"');
        expect(at).toBeGreaterThan(-1);
        const tag = markup.slice(at, markup.indexOf('>', at));
        expect(tag).toContain('@change=');
        expect(tag).toMatch(/logForm\.completedDate\s*=/);
    });

    it('field ini benar-benar ikut tersimpan saat submit', () => {
        const logs = fs.readFileSync(path.join(ROOT, 'src/js/modules/logs.js'), 'utf-8');
        expect(logs).toMatch(/actualHours:\s*Number\(this\.logForm\.actualHours\)/);
        expect(logs).toMatch(/completedDate:\s*this\.logForm\.completedDate/);
    });
});

/**
 * Bagian interaktif: fragmen asli di-mount di jsdom dengan `Alpine.initTree`,
 * memakai `syncLogFormErrors` asli dari `logsModule`. Yang diuji perilakunya —
 * nilai state, atribut `required`, dan pesan error — bukan teks sumber.
 */
let mounted = null;

async function mountFragments(...nodes) {
    mounted = document.createElement('div');
    mounted.setAttribute('x-data', 'logFormContract');
    mounted.append(...nodes);
    Alpine.data('logFormContract', () => ({
        logForm: Object.assign(DEFAULT_LOG_FORM(), { equipmentId: 'EQ-1', date: '2026-11-15', desc: 'Repair' }),
        logFormErrors: {},
        logDeptOpen: true,
        technicianSuggestions: [],
        syncLogFormErrors: logsModule.syncLogFormErrors,
    }));
    document.body.append(mounted);
    Alpine.initTree(mounted);
    await Alpine.nextTick();
    return Alpine.$data(mounted);
}

afterEach(() => {
    if (mounted) {
        Alpine.destroyTree(mounted);
        mounted.remove();
        mounted = null;
    }
});

/** Ambil node dari fragmen HTML tanpa menjalankan Alpine pada salinannya. */
function fragmentOf(html) {
    const t = document.createElement('template');
    t.innerHTML = html;
    return t.content;
}

const shellNodes = fragmentOf(shell);
const modalSource = shellNodes.querySelector('template[x-if="showLogModal"]');
const modalNodes = modalSource.content;
const deptBlock = modalNodes.querySelector('details');
const settingsBlock = modalNodes.querySelector('[x-model="logForm.woPriority"]').closest('.form-grid').parentElement;
const rcaBlock = modalNodes.querySelector('[x-model="logForm.rca"]').closest('.form-grid').parentElement;

describe('form log — kontak peminta & tanggal dibutuhkan', () => {
    // Menghapus salah satu kontrol (atau `x-model`-nya) membuat data permintaan
    // departemen hilang diam-diam saat submit.
    it('kontak dan tanggal kebutuhan opsional mengisi state tanpa mengubah tanggal lain', async () => {
        const state = await mountFragments(deptBlock.cloneNode(true));
        const contact = getByRole(mounted, 'textbox', { name: 'Kontak peminta' });
        const neededBy = getByLabelText(mounted, 'Tanggal dibutuhkan');
        expect(contact.required).toBe(false);
        expect(neededBy.required).toBe(false);
        expect(neededBy.type).toBe('date');
        // Tidak ada batas minimal: tanggal kebutuhan boleh lampau.
        expect(neededBy.min).toBe('');
        expect(mounted.querySelector('details summary').textContent).toContain('6 field');
        const help = document.getElementById(neededBy.getAttribute('aria-describedby')).textContent;
        expect(help).toMatch(/needed by/i);
        expect(help).toMatch(/due date/i);

        fireEvent.input(contact, { target: { value: '  Budi / ext 123  ' } });
        fireEvent.input(neededBy, { target: { value: '2020-01-01' } });
        await Alpine.nextTick();
        expect(state.logForm.requesterContact).toBe('  Budi / ext 123  ');
        expect(state.logForm.neededByDate).toBe('2020-01-01');
        expect(neededBy.checkValidity()).toBe(true);
        // Kolom lain tidak tersentuh: requestDate & dueDate tetap nilai awalnya.
        expect(state.logForm.requestDate).toBe(DEFAULT_LOG_FORM().requestDate);
        expect(state.logForm.dueDate).toBe(DEFAULT_LOG_FORM().dueDate);
    });

    // Tanpa `@input` yang menyegarkan error, pesan tanggal lama tetap terlihat
    // setelah pengguna memasukkan tanggal yang sah.
    it('tanggal kebutuhan menampilkan error lalu menyegarkannya ketika dikoreksi', async () => {
        const state = await mountFragments(deptBlock.cloneNode(true));
        state.logForm.neededByDate = '2026-13-45';
        state.logFormErrors = { neededByDate: 'Tanggal dibutuhkan tidak valid' };
        await Alpine.nextTick();
        const error = mounted.querySelector('[x-text="logFormErrors.neededByDate"]');
        expect(error).not.toBeNull();
        expect(error.textContent).toBe('Tanggal dibutuhkan tidak valid');
        await waitFor(() => expect(error.style.display).not.toBe('none'));

        const neededBy = getByLabelText(mounted, 'Tanggal dibutuhkan');
        fireEvent.input(neededBy, { target: { value: '2026-12-01' } });
        await Alpine.nextTick();
        expect(state.logFormErrors.neededByDate).toBeUndefined();
        await waitFor(() => expect(error.style.display).toBe('none'));
    });
});

describe('form log — Other wajib keterangan', () => {
    // Menghapus `x-show`/`x-bind:required` atau handler `@change` membuat field
    // keterangan tetap tampil, tetap wajib, atau mempertahankan error basi.
    it('keterangan hanya wajib saat Other dan error disegarkan ketika beralih', async () => {
        const state = await mountFragments(settingsBlock.cloneNode(true), rcaBlock.cloneNode(true));
        const pick = (name) => getByRole(mounted, 'combobox', { name });

        for (const [selName, key, normal] of [
            ['Prioritas work order', 'woPriorityOther', 'Planned'],
            ['RCA', 'rcaOther', 'Human Error'],
        ]) {
            const select = pick(selName);
            const other = mounted.querySelector(`[x-model="logForm.${key}"]`);
            const wrapper = other.parentElement;
            expect(other.required, `${key} wajib sebelum Other`).toBe(false);
            expect(wrapper.style.display, `${key} tampil sebelum Other`).toBe('none');

            fireEvent.change(select, { target: { value: 'Other' } });
            await Alpine.nextTick();
            await waitFor(() => expect(wrapper.style.display, `${key} tersembunyi saat Other`).not.toBe('none'));
            expect(other.required).toBe(true);
            expect(state.logFormErrors[key], `${key} error saat kosong`).toBeTruthy();
            const error = mounted.querySelector(`[x-text="logFormErrors.${key}"]`);
            expect(error.textContent).toBe(state.logFormErrors[key]);
            await waitFor(() => expect(error.style.display).not.toBe('none'));

            fireEvent.input(other, { target: { value: '   ' } });
            await Alpine.nextTick();
            expect(state.logFormErrors[key], `${key} spasi dianggap kosong`).toBeTruthy();

            fireEvent.input(other, { target: { value: '  Special case  ' } });
            await Alpine.nextTick();
            expect(state.logForm[key]).toBe('  Special case  ');
            expect(state.logFormErrors[key]).toBeUndefined();
            await waitFor(() => expect(error.style.display).toBe('none'));

            fireEvent.change(select, { target: { value: normal } });
            await Alpine.nextTick();
            expect(other.required).toBe(false);
            await waitFor(() => expect(wrapper.style.display).toBe('none'));
            expect(state.logFormErrors[key], `${key} error basi tersisa`).toBeUndefined();
        }
    });
});

describe('WorkOrders — filter prioritas', () => {
    // Tanpa opsi Other, WO berprioritas khusus tidak bisa difilter sama sekali.
    it('pilihan Other mengisi filter prioritas', async () => {
        const source = fragmentOf(workOrders);
        mounted = document.createElement('div');
        mounted.setAttribute('x-data', '{ filterWOPriority: "" }');
        mounted.append(
            source.querySelector('label[for="wo-priority"]').cloneNode(true),
            source.querySelector('#wo-priority').cloneNode(true),
        );
        document.body.append(mounted);
        Alpine.initTree(mounted);
        const filter = getByRole(mounted, 'combobox', { name: 'Filter prioritas' });
        fireEvent.change(filter, { target: { value: 'Other' } });
        await Alpine.nextTick();
        expect(Alpine.$data(mounted).filterWOPriority).toBe('Other');
    });
});
