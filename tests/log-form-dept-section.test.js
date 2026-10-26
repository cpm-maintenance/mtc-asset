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
