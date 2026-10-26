/**
 * formatAssignee (S40): nama teknisi multi-orang dari RTDB berupa **larik**.
 *
 * `x-text="wo.assignedTo"` pada larik dirender Alpine lewat `String(array)`,
 * jadi record `['Yuli','Gunawan','Maruf M']` tampil `Yuli,Gunawan,Maruf M` —
 * tanpa spasi, dan terbaca sebagai satu nama. Helper ini yang menormalkannya.
 *
 * Tes ini menjaga dua hal sekaligus: perilaku helper, dan **kontrak fragmen**
 * bahwa tidak ada lagi binding mentah `x-text="….assignedTo"` di halaman mana pun.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatAssignee } from '../src/js/utils.js';

const frag = (name) => readFileSync(resolve(process.cwd(), 'public/pages', name), 'utf8');

describe('formatAssignee', () => {
    it('larik dirangkai dengan koma + spasi', () => {
        expect(formatAssignee(['Yuli', 'Gunawan', 'Maruf M'])).toBe('Yuli, Gunawan, Maruf M');
    });

    it('satu nama tetap satu nama', () => {
        expect(formatAssignee(['Sardi'])).toBe('Sardi');
    });

    it('entri kosong di dalam larik dibuang', () => {
        expect(formatAssignee(['Sardi', '  ', null, 'Lutfi'])).toBe('Sardi, Lutfi');
    });

    it('string dibiarkan apa adanya (setelah trim)', () => {
        expect(formatAssignee('  Sardi  ')).toBe('Sardi');
    });

    it('kosong jadi UNASSIGNED', () => {
        expect(formatAssignee('')).toBe('UNASSIGNED');
        expect(formatAssignee('   ')).toBe('UNASSIGNED');
        expect(formatAssignee([])).toBe('UNASSIGNED');
        expect(formatAssignee(['', '   '])).toBe('UNASSIGNED');
        expect(formatAssignee(null)).toBe('UNASSIGNED');
        expect(formatAssignee(undefined)).toBe('UNASSIGNED');
        expect(formatAssignee(0)).toBe('UNASSIGNED');
    });
});

describe('kontrak fragmen: tiga lokasi memakai helper', () => {
    const files = ['AllLogs.html', 'PlanningBoard.html', 'WorkOrders.html'];

    it('tidak ada lagi binding mentah ke assignedTo', () => {
        for (const name of files) {
            const html = frag(name);
            const raw = [...html.matchAll(/x-text="([^"]*\.assignedTo[^"]*)"/g)]
                .map((m) => m[1])
                .filter((expr) => !expr.includes('formatAssignee(') && !expr.includes('.slice('));
            expect(raw, `${name} masih merender assignedTo mentah`).toEqual([]);
        }
    });

    it('setiap lokasi memanggil formatAssignee()', () => {
        const expected = { 'AllLogs.html': 1, 'PlanningBoard.html': 2, 'WorkOrders.html': 2 };
        for (const name of files) {
            const html = frag(name);
            const calls = [...html.matchAll(/x-text="formatAssignee\([^"]*\)"/g)].length;
            expect(calls, `${name} memakai formatAssignee()`).toBe(expected[name]);
        }
    });
});
