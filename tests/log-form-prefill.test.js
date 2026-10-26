// @vitest-environment jsdom
/**
 * Prefill form WO (S39i): tenggat default +7 hari dan saran nama teknisi.
 *
 * Nama teknisi **tidak** diisi otomatis — planner sering menugaskan orang lain,
 * jadi yang disediakan hanya datalist saran dari riwayat `assignedTo`. Sumbernya
 * riwayat log, bukan node `Users`, karena `.read` Users hanya untuk
 * admin/supervisor sehingga operator biasa akan melihat daftar kosong.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_DUE_DATE, DEFAULT_LOG_FORM } from '../src/js/constants.ts';
import { logsModule } from '../src/js/modules/logs.js';

const isoPlus = (days) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

const makeCtx = (logs) => Object.assign(Object.create(logsModule), { logs });

describe('due date default', () => {
    it('DEFAULT_DUE_DATE = hari ini + 7', () => {
        expect(DEFAULT_DUE_DATE()).toBe(isoPlus(7));
    });

    it('DEFAULT_LOG_FORM memakai tenggat +7 dan teknisi tetap kosong', () => {
        const form = DEFAULT_LOG_FORM();
        expect(form.dueDate).toBe(isoPlus(7));
        expect(form.assignedTo).toBe('');
    });
});

describe('technicianSuggestions', () => {
    it('mengumpulkan nama unik, urut, dan membuang nilai kosong', () => {
        const ctx = makeCtx([
            { assignedTo: 'Yuli' },
            { assignedTo: 'Andi' },
            { assignedTo: 'Yuli' },
            { assignedTo: '' },
            { assignedTo: null },
            {},
        ]);
        expect(ctx.technicianSuggestions).toEqual(['Andi', 'Yuli']);
    });

    it('meratakan assignedTo berbentuk array (data legacy multi-teknisi)', () => {
        const ctx = makeCtx([{ assignedTo: ['Yuli', 'Gunawan'] }, { assignedTo: 'Sardi' }]);
        expect(ctx.technicianSuggestions).toEqual(['Gunawan', 'Sardi', 'Yuli']);
    });

    it('menyaring uid Firebase supaya yang muncul hanya nama orang', () => {
        const ctx = makeCtx([
            { assignedTo: 'DhBF4lw6otV5aPu3xUl4pDvyA9u2' },
            { assignedTo: 'jtUxorQdOfcaY8cDnJsppVjRAE52' },
            { assignedTo: 'Maruf M' },
        ]);
        expect(ctx.technicianSuggestions).toEqual(['Maruf M']);
    });

    it('dibatasi 20 saran', () => {
        const logs = Array.from({ length: 30 }, (_, i) => ({ assignedTo: 'Teknisi ' + String(i).padStart(2, '0') }));
        expect(makeCtx(logs).technicianSuggestions).toHaveLength(20);
    });

    it('tanpa log: daftar kosong, tidak melempar', () => {
        expect(makeCtx(undefined).technicianSuggestions).toEqual([]);
        expect(makeCtx([]).technicianSuggestions).toEqual([]);
    });
});
