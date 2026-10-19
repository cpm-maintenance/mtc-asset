// Tes fungsi murni migrasi legacy URL (scripts/migrate-fotourl.mjs).
import { describe, expect, it } from 'vitest';
import { chunkUpdates, collectLegacyUpdates, decodeLegacyUrl, isLegacyValue } from '../scripts/migrate-fotourl.mjs';

describe('decodeLegacyUrl', () => {
  it('mengembalikan URL ter-escape jadi URL asli', () => {
    expect(decodeLegacyUrl('https:&#x2F;&#x2F;res.cloudinary.com&#x2F;demo&#x2F;a.jpg')).toBe(
      'https://res.cloudinary.com/demo/a.jpg'
    );
  });

  it('tidak menyentuh URL yang sudah bersih', () => {
    expect(decodeLegacyUrl('https://cdn/x.jpg')).toBe('https://cdn/x.jpg');
  });

  it('decode &amp; tanpa merusak query string', () => {
    expect(decodeLegacyUrl('https:&#x2F;&#x2F;x.com&#x2F;a.jpg?w=1&amp;h=2')).toBe('https://x.com/a.jpg?w=1&h=2');
  });

  it('nilai non-string dikembalikan apa adanya', () => {
    expect(decodeLegacyUrl(null)).toBe(null);
    expect(decodeLegacyUrl(42)).toBe(42);
  });
});

describe('isLegacyValue', () => {
  it('mengenali entitas hasil escaping', () => {
    expect(isLegacyValue('https:&#x2F;&#x2F;x')).toBe(true);
    expect(isLegacyValue('https:&#47;&#47;x')).toBe(true);
    expect(isLegacyValue('a&amp;b')).toBe(true);
  });

  it('URL bersih bukan legacy', () => {
    expect(isLegacyValue('https://x/y.jpg')).toBe(false);
  });
});

describe('collectLegacyUpdates', () => {
  it('hanya menyentuh field berakhiran URL/Url/URLs', () => {
    const tree = {
      'EQ-1': { FotoURL: 'https:&#x2F;&#x2F;cdn&#x2F;f.jpg', Nama: 'pipa&#x2F;air', Lokasi: 'A&B' },
    };
    const { updates } = collectLegacyUpdates(tree);
    expect(updates).toEqual({ 'EQ-1/FotoURL': 'https://cdn/f.jpg' });
  });

  it('menangani array PhotoURLs', () => {
    const tree = { L1: { PhotoURLs: ['https:&#x2F;&#x2F;a&#x2F;1.jpg', 'https://ok/2.jpg'] } };
    const { updates } = collectLegacyUpdates(tree);
    expect(updates).toEqual({ 'L1/PhotoURLs': ['https://a/1.jpg', 'https://ok/2.jpg'] });
  });

  it('idempoten: pohon bersih menghasilkan nol update', () => {
    const clean = { 'EQ-1': { FotoURL: 'https://cdn/f.jpg', Nama: 'pipa/air' } };
    const { updates, scanned } = collectLegacyUpdates(clean);
    expect(updates).toEqual({});
    expect(scanned).toBe(1);
  });

  it('menghitung field URL yang diperiksa', () => {
    const tree = { A: { FotoURL: 'https://a' }, B: { PhotoURL: 'https:&#x2F;&#x2F;b' }, C: { Nama: 'x' } };
    const { scanned, updates } = collectLegacyUpdates(tree);
    expect(scanned).toBe(2);
    expect(Object.keys(updates)).toEqual(['B/PhotoURL']);
  });
});

describe('chunkUpdates', () => {
  it('memecah update besar jadi potongan', () => {
    const updates = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, 'v']));
    const chunks = chunkUpdates(updates, 2);
    expect(chunks).toHaveLength(3);
    expect(Object.keys(chunks[0])).toEqual(['k0', 'k1']);
  });
});
