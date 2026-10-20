// Retensi backup: berkas lebih tua dari 7 hari harus dibuang (kartu: retensi 7 hari).
import { describe, expect, it } from 'vitest';
import { selectExpiredBackups } from '../scripts/backup-firebase.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-19T23:00:00Z');

const file = (name, ageDays) => ({ name, mtimeMs: now - ageDays * DAY });

describe('selectExpiredBackups', () => {
  it('membuang berkas lebih tua dari 7 hari', () => {
    const files = [file('backup-baru.json', 1), file('backup-tua.json', 8)];
    expect(selectExpiredBackups(files, now)).toEqual(['backup-tua.json']);
  });

  it('berkas tepat 7 hari belum dibuang (batas eksklusif)', () => {
    expect(selectExpiredBackups([file('backup-7.json', 7)], now)).toEqual([]);
  });

  it('semua berkas muda -> tidak ada yang dibuang', () => {
    const files = [file('a.json', 0), file('b.json', 3), file('c.json', 6)];
    expect(selectExpiredBackups(files, now)).toEqual([]);
  });

  it('menghormati parameter hari', () => {
    const files = [file('a.json', 2), file('b.json', 4)];
    expect(selectExpiredBackups(files, now, 3)).toEqual(['b.json']);
  });

  it('daftar kosong aman', () => {
    expect(selectExpiredBackups([], now)).toEqual([]);
  });
});
