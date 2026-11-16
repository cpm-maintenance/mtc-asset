// @vitest-environment jsdom
/**
 * Seksi "Department Request" pada modal log (S40).
 *
 * `openLogModal(true, log)` mengisi `requestedBy`/`approvedBy`/`requestDate`/
 * `requestSource`, tetapi `<details>`-nya tidak punya state sehingga datanya
 * terisi tanpa pernah terlihat — probe browser S40 mencatat `details.open ===
 * false` sementara keempat field berisi. Flag `logDeptOpen` yang menjembatani.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { logsModule } from '../src/js/modules/logs.js';

const makeCtx = (logs = []) => Object.assign(Object.create(logsModule), { logs });

const RECORD = {
    LogID: 'LOG-S40-DEPT',
    EquipmentID: 'EQ-1',
    Jenis: 'Corrective',
    Deskripsi: 'Permintaan departemen',
    Status: 'Pending',
    Tanggal: '2026-10-24',
    assignedTo: 'Sardi',
    requestSource: 'Safety',
    requestedBy: 'Budi Santoso',
    requestDate: '2026-10-18',
    approvedBy: 'Ir. Fahmi',
};

describe('logDeptOpen', () => {
    it('default tertutup', () => {
        expect(makeCtx().logDeptOpen).toBe(false);
    });

    it('edit record yang punya data permintaan → terbuka', () => {
        const ctx = makeCtx([RECORD]);
        ctx.openLogModal(true, RECORD);
        expect(ctx.logDeptOpen).toBe(true);
        expect(ctx.logForm.requestedBy).toBe('Budi Santoso');
    });

    it('edit record tanpa data permintaan → tetap tertutup', () => {
        const bare = { ...RECORD, requestedBy: '', approvedBy: '' };
        const ctx = makeCtx([bare]);
        ctx.openLogModal(true, bare);
        expect(ctx.logDeptOpen).toBe(false);
    });

    it('entri baru selalu tertutup walau sebelumnya terbuka', () => {
        const ctx = makeCtx([RECORD]);
        ctx.openLogModal(true, RECORD);
        expect(ctx.logDeptOpen).toBe(true);
        ctx.openLogModal(false);
        expect(ctx.logDeptOpen).toBe(false);
    });
});

describe('kontrak fragmen: <details> terikat ke flag', () => {
    const html = readFileSync(resolve(process.cwd(), 'public/pages/app-shell.html'), 'utf8');
    const start = html.lastIndexOf('Department Request');
    const open = html.lastIndexOf('<details', start);
    const tag = html.slice(open, html.indexOf('>', open) + 1);

    it('memakai :open="logDeptOpen"', () => {
        expect(tag).toContain(':open="logDeptOpen"');
    });

    it('menyimpan state toggle dari pengguna', () => {
        const attrs = html.slice(open, html.indexOf('</details>', open));
        expect(attrs).toContain('@toggle="logDeptOpen = $event.target.open"');
    });
});

describe('department request extension prefill/reset', () => {
    it('restores new request and Other details without overwriting maintenance schedule', () => {
        const record = { ...RECORD, requestedBy: '', approvedBy: '', requesterContact: 'Ext 123', neededByDate: '2030-12-01', dueDate: '2030-12-05', rca: 'Other', rcaOther: 'Non-equipment work', woPriority: 'Other', woPriorityOther: 'Shutdown window' };
        const ctx = makeCtx([record]);
        ctx.openLogModal(true, record);
        expect(ctx.logDeptOpen).toBe(true);
        expect(ctx.logForm).toMatchObject({ requesterContact: 'Ext 123', neededByDate: '2030-12-01', dueDate: '2030-12-05', rcaOther: 'Non-equipment work', woPriorityOther: 'Shutdown window' });
        ctx.openLogModal(false);
        expect(ctx.logForm).toMatchObject({ requesterContact: '', neededByDate: '', rcaOther: '', woPriorityOther: '' });
    });

    it('opens section when only needed-by date exists', () => {
        const record = { ...RECORD, requestedBy: '', approvedBy: '', neededByDate: '2030-12-01' };
        const ctx = makeCtx([record]);
        ctx.openLogModal(true, record);
        expect(ctx.logDeptOpen).toBe(true);
    });

    it('legacy data supplies empty extensions', () => {
        const ctx = makeCtx([RECORD]);
        ctx.openLogModal(true, RECORD);
        expect(ctx.logForm).toMatchObject({ requesterContact: '', neededByDate: '', rcaOther: '', woPriorityOther: '' });
    });
});
