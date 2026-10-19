// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { partsModule } from '../src/js/modules/parts.js';

/**
 * parts.js memakai `this` = AppState. Isolasi per tes dengan Object.create(modul).
 */
function makeCtx(overrides = {}) {
  const self = Object.create(partsModule);
  Object.assign(self, {
    partForm: null,
    allParts: [],
    user: { uid: 'u1' },
    isAdmin: true,
    isOnline: true,
    isLoading: false,
    isEditingPart: false,
    showPartModal: false,
    showUsageHistory: false,
    showNotification: vi.fn(),
    queueOfflineOperation: vi.fn(),
    saveToIndexedDB: vi.fn().mockResolvedValue(undefined),
  }, overrides);
  return self;
}

const validForm = (extra = {}) => ({
  id: 'SP-01', nama: 'Bearing 6205', namaSingkat: 'BRG', partNumber: 'PN-1',
  equipIds: [], stok: 10, minStock: 5, lokasi: 'Gudang A', vendor: 'PT X',
  harga: 150000, foto: '', lastReplaceDate: '', avgLifetimeDays: '',
  avgLifetimeHours: '', usageHours: '',
  ...extra,
});

describe('parts.js: riwayat pemakaian', () => {
  it('showPartUsageHistory menyimpan id, nama, dan membuka panel', () => {
    const self = makeCtx();

    self.showPartUsageHistory('SP-01', 'Bearing 6205');

    expect(self.usageHistoryPartId).toBe('SP-01');
    expect(self.usageHistoryPartName).toBe('Bearing 6205');
    expect(self.showUsageHistory).toBe(true);
  });
});

describe('parts.js: openPartModal', () => {
  it('membuat partForm kosong bila belum ada (guard)', () => {
    const self = makeCtx({ partForm: null });

    self.openPartModal();

    expect(self.partForm).toMatchObject({ id: '', nama: '', equipIds: [], stok: 0, minStock: 0, harga: 0 });
    expect(self.showPartModal).toBe(true);
    expect(self.isEditingPart).toBe(false);
  });

  it('mode tambah menimpa form lama dengan form kosong', () => {
    const self = makeCtx({ partForm: { id: 'lama', nama: 'lama' } });

    self.openPartModal();

    expect(self.partForm.id).toBe('');
    expect(self.partForm.nama).toBe('');
  });

  it('edit dengan EquipmentIDs berupa array', () => {
    const self = makeCtx();

    self.openPartModal(true, {
      PartID: 'SP-01', NamaPart: 'Bearing', EquipmentIDs: ['EX-01', 'EX-02'],
      Stok: 3, MinStock: 7, Harga: 1000,
    });

    expect(self.partForm.equipIds).toEqual(['EX-01', 'EX-02']);
    expect(self.partForm).toMatchObject({ id: 'SP-01', nama: 'Bearing', stok: 3, minStock: 7, harga: 1000 });
    expect(self.isEditingPart).toBe(true);
  });

  it('edit dengan EquipmentIDs berupa string tunggal dibungkus jadi array', () => {
    const self = makeCtx();

    self.openPartModal(true, { PartID: 'SP-01', EquipmentIDs: 'EX-09' });

    expect(self.partForm.equipIds).toEqual(['EX-09']);
  });

  it('edit data lama dengan EquipmentID tunggal (legacy)', () => {
    const self = makeCtx();

    self.openPartModal(true, { PartID: 'SP-01', EquipmentID: 'EX-LEGACY' });

    expect(self.partForm.equipIds).toEqual(['EX-LEGACY']);
  });

  it('edit tanpa equip sama sekali: equipIds kosong', () => {
    const self = makeCtx();

    self.openPartModal(true, { PartID: 'SP-01' });

    expect(self.partForm.equipIds).toEqual([]);
  });

  it('Stok/MinStock/Harga 0 dipertahankan (bukan jatuh ke default)', () => {
    const self = makeCtx();

    self.openPartModal(true, { PartID: 'SP-01', Stok: 0, MinStock: 0, Harga: 0 });

    expect(self.partForm).toMatchObject({ stok: 0, minStock: 0, harga: 0 });
  });
});

describe('parts.js: submitSparePart — penjaga', () => {
  it('form belum ada: notifikasi, tidak menyimpan', async () => {
    const self = makeCtx({ partForm: null });

    await self.submitSparePart();

    expect(self.showNotification).toHaveBeenCalledWith('Form not initialized', 'error');
    expect(window.set).not.toHaveBeenCalled();
  });

  it('validasi gagal: error pertama ditampilkan', async () => {
    const self = makeCtx({ partForm: validForm({ id: '' }) });

    await self.submitSparePart();

    expect(self.showNotification).toHaveBeenCalledWith('Part ID is required', 'error');
    expect(window.set).not.toHaveBeenCalled();
  });

  it('bukan admin: ditolak walau form valid', async () => {
    const self = makeCtx({ partForm: validForm(), isAdmin: false });

    await self.submitSparePart();

    expect(self.showNotification).toHaveBeenCalledWith('Admin access required for this operation', 'error');
    expect(window.set).not.toHaveBeenCalled();
  });
});

describe('parts.js: submitSparePart — jalur online', () => {
  it('membuat part baru: payload lengkap, createdBy terisi, unshift', async () => {
    const self = makeCtx({ partForm: validForm({ equipIds: ['EX-01', 'EX-02'] }) });

    await self.submitSparePart();

    const [ref, payload] = window.set.mock.calls[0];
    expect(ref).toMatchObject({ path: 'SpareParts/SP-01' });
    expect(payload).toMatchObject({
      PartID: 'SP-01', NamaPart: 'Bearing 6205', EquipmentIDs: ['EX-01', 'EX-02'],
      EquipmentID: 'EX-01', Stok: 10, MinStock: 5, Harga: 150000,
      isLowStock: false, createdBy: 'u1', updatedBy: 'u1',
    });
    expect(self.allParts).toHaveLength(1);
    expect(self.showPartModal).toBe(false);
    expect(self.showNotification).toHaveBeenCalledWith('Spare part data synchronized!');
  });

  it('isLowStock true saat stok <= minStock', async () => {
    const self = makeCtx({ partForm: validForm({ stok: 5, minStock: 5 }) });

    await self.submitSparePart();

    expect(window.set.mock.calls[0][1].isLowStock).toBe(true);
  });

  it('equipIds kosong: EquipmentID jadi string kosong', async () => {
    const self = makeCtx({ partForm: validForm({ equipIds: [] }) });

    await self.submitSparePart();

    expect(window.set.mock.calls[0][1].EquipmentID).toBe('');
  });

  it('edit part: createdBy lama dipertahankan', async () => {
    const self = makeCtx({
      partForm: validForm(),
      isEditingPart: true,
      allParts: [{ PartID: 'SP-01', createdBy: 'pembuat-asli' }],
    });

    await self.submitSparePart();

    expect(window.set.mock.calls[0][1].createdBy).toBe('pembuat-asli');
    expect(self.allParts[0].createdBy).toBe('pembuat-asli');
  });

  it('edit part yang tidak ada di array: createdBy tidak diisi', async () => {
    const self = makeCtx({ partForm: validForm(), isEditingPart: true, allParts: [] });

    await self.submitSparePart();

    expect(window.set.mock.calls[0][1]).not.toHaveProperty('createdBy');
  });

  it('audit trail: aksi Create lalu Update', async () => {
    const self = makeCtx({ partForm: validForm() });
    await self.submitSparePart();
    expect(window.auditModule.logAudit).toHaveBeenCalledWith('Create Spare Part', { id: 'SP-01', nama: 'Bearing 6205' });

    const self2 = makeCtx({ partForm: validForm(), isEditingPart: true, allParts: [] });
    await self2.submitSparePart();
    expect(window.auditModule.logAudit).toHaveBeenLastCalledWith('Update Spare Part', { id: 'SP-01', nama: 'Bearing 6205' });
  });

  it('audit melempar: ditelan, penyimpanan tetap sukses', async () => {
    window.auditModule.logAudit.mockImplementationOnce(() => { throw new Error('audit mati'); });
    const self = makeCtx({ partForm: validForm() });

    await self.submitSparePart();

    expect(self.allParts).toHaveLength(1);
  });

  it('part yang sudah ada diganti di tempat, bukan diduplikasi', async () => {
    const self = makeCtx({
      partForm: validForm(),
      allParts: [{ PartID: 'SP-01', NamaPart: 'Lama' }],
    });

    await self.submitSparePart();

    expect(self.allParts).toHaveLength(1);
    expect(self.allParts[0].NamaPart).toBe('Bearing 6205');
  });

  it('window.set gagal: notifikasi Sync Error, isLoading kembali false', async () => {
    vi.useFakeTimers();
    window.set.mockRejectedValue(new Error('denied'));
    const self = makeCtx({ partForm: validForm() });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const run = self.submitSparePart();
    await vi.advanceTimersByTimeAsync(4000);
    await run;

    expect(self.showNotification).toHaveBeenCalledWith('Sync Error: denied', 'error');
    expect(self.isLoading).toBe(false);
    expect(self.showPartModal).toBe(false);
    errSpy.mockRestore();
    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('parts.js: submitSparePart — jalur offline', () => {
  it('antrean berhasil: array lokal diperbarui, RTDB tidak disentuh', async () => {
    const self = makeCtx({
      partForm: validForm(),
      isOnline: false,
      queueOfflineOperation: vi.fn().mockResolvedValue(true),
    });

    await self.submitSparePart();

    expect(self.queueOfflineOperation).toHaveBeenCalledWith('parts', expect.objectContaining({ PartID: 'SP-01' }));
    expect(window.set).not.toHaveBeenCalled();
    expect(self.allParts).toHaveLength(1);
    expect(self.saveToIndexedDB).toHaveBeenCalled();
    expect(self.showNotification).toHaveBeenCalledWith('Part saved offline, will sync when online');
    expect(self.showPartModal).toBe(false);
    expect(self.isLoading).toBe(false);
  });

  it('antrean berhasil untuk part yang sudah ada: diganti di tempat', async () => {
    const self = makeCtx({
      partForm: validForm(),
      isOnline: false,
      allParts: [{ PartID: 'SP-01', NamaPart: 'Lama' }],
      queueOfflineOperation: vi.fn().mockResolvedValue(true),
    });

    await self.submitSparePart();

    expect(self.allParts).toHaveLength(1);
    expect(self.allParts[0].NamaPart).toBe('Bearing 6205');
  });

  it('antrean gagal: lanjut ke jalur online', async () => {
    const self = makeCtx({
      partForm: validForm(),
      isOnline: false,
      queueOfflineOperation: vi.fn().mockResolvedValue(false),
    });

    await self.submitSparePart();

    expect(window.set).toHaveBeenCalled();
    expect(self.showNotification).toHaveBeenCalledWith('Spare part data synchronized!');
  });
});

describe('parts.js: retry jaringan', () => {
  it('kegagalan jaringan: memberi tahu "Network error, retrying..." lalu sukses di percobaan kedua', async () => {
    vi.useFakeTimers();
    window.set
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValue(undefined);
    const self = makeCtx({ partForm: validForm() });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const run = self.submitSparePart();
    await vi.advanceTimersByTimeAsync(1500);
    await run;

    expect(self.showNotification).toHaveBeenCalledWith('Network error, retrying...', 'info');
    expect(window.set).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});

beforeEach(() => {
  window.db = {};
  window.set = vi.fn().mockResolvedValue(undefined);
  window.ref = vi.fn((_db, path) => ({ path }));
  window.auditModule = { logAudit: vi.fn() };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.auditModule;
});
