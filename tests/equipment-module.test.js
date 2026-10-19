// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { equipmentModule } from '../src/js/modules/equipment.js';
import { DEFAULT_EQUIP_FORM } from '../src/js/constants';

/**
 * equipment.js memakai `this` = AppState. Isolasi dengan Object.create(modul)
 * supaya state tiap tes bersih dan getter modul tidak dibekukan object spread.
 */
function makeCtx(overrides = {}) {
  const self = Object.create(equipmentModule);
  Object.assign(self, {
    equipForm: DEFAULT_EQUIP_FORM(),
    equipment: [],
    user: { uid: 'u1' },
    isOnline: true,
    isLoading: false,
    isEditingEquip: false,
    showEquipModal: false,
    tempEquipFile: null,
    selectedEquip: null,
    showNotification: vi.fn(),
    uploadImage: vi.fn(),
    queueOfflineOperation: vi.fn(),
    saveToIndexedDB: vi.fn().mockResolvedValue(undefined),
    showCropModal: vi.fn(),
  }, overrides);
  return self;
}

describe('equipment.js: openEquipModal', () => {
  it('mode tambah memakai DEFAULT_EQUIP_FORM dan membuka modal', () => {
    const self = makeCtx({ equipForm: { id: 'lama' } });
    self.openEquipModal();

    expect(self.isEditingEquip).toBe(false);
    expect(self.equipForm).toEqual(DEFAULT_EQUIP_FORM());
    expect(self.showEquipModal).toBe(true);
    expect(self.tempEquipFile).toBeNull();
  });

  it('mode edit memetakan seluruh field data ke equipForm', () => {
    const self = makeCtx();
    self.openEquipModal(true, {
      EquipmentID: 'EX-01', Nama: 'Jaw Crusher', Tipe: 'Crusher', Lokasi: 'Plant 1',
      Status: 'Active', SerialNumber: 'SN-9', CurrentHM: 1234, TglInstalasi: '2024-01-05',
      Vendor: 'PT Alat', FotoURL: 'https://img/x.jpg', NextPMDate: '2026-11-01',
      Criticality: 'High',
    });

    expect(self.isEditingEquip).toBe(true);
    expect(self.equipForm).toMatchObject({
      id: 'EX-01', nama: 'Jaw Crusher', tipe: 'Crusher', lokasi: 'Plant 1',
      status: 'Active', sn: 'SN-9', current: 1234, tglInstalasi: '2024-01-05',
      vendor: 'PT Alat', foto: 'https://img/x.jpg', criticality: 'High',
    });
    expect(self.equipForm.nextPM).toBeTypeOf('string');
    expect(self.showEquipModal).toBe(true);
  });

  it('mode edit dengan data kosong jatuh ke nilai default', () => {
    const self = makeCtx();
    self.openEquipModal(true, {});

    expect(self.equipForm).toMatchObject({
      id: '', nama: '', tipe: 'Crusher', status: 'Active', current: 0, criticality: 'Medium',
    });
  });
});

describe('equipment.js: handleEquipPhoto', () => {
  it('tanpa berkas: keluar tanpa menyentuh state', async () => {
    const self = makeCtx();
    await self.handleEquipPhoto({ target: { files: [] } });

    expect(self.tempEquipFile).toBeNull();
    expect(self.showCropModal).not.toHaveBeenCalled();
  });

  it('dengan berkas: simpan file, buat object URL, buka crop modal', async () => {
    const self = makeCtx();
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    await self.handleEquipPhoto({ target: { files: [file] } });

    expect(self.tempEquipFile).toBe(file);
    expect(self.equipForm.foto).toMatch(/^blob:/);
    expect(self.showCropModal).toHaveBeenCalledTimes(1);
  });

  it('callback crop mengganti file dan foto dengan hasil potongan', async () => {
    const self = makeCtx();
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await self.handleEquipPhoto({ target: { files: [file] } });

    const [url, onCrop] = self.showCropModal.mock.calls[0];
    expect(url).toMatch(/^blob:/);
    const blob = new Blob(['y'], { type: 'image/jpeg' });
    onCrop(blob);

    expect(self.tempEquipFile).toBe(blob);
    expect(self.equipForm.foto).toMatch(/^blob:/);
  });
});

describe('equipment.js: submitEquipment — validasi', () => {
  it('form tidak valid: notifikasi error pertama, tidak menyimpan', async () => {
    const self = makeCtx({ equipForm: { ...DEFAULT_EQUIP_FORM() } });

    await self.submitEquipment();

    expect(self.showNotification).toHaveBeenCalledWith('Asset ID is required', 'error');
    expect(window.set).not.toHaveBeenCalled();
    expect(self.isLoading).toBe(false);
  });
});

describe('equipment.js: submitEquipment — jalur online', () => {
  const validForm = () => ({
    ...DEFAULT_EQUIP_FORM(), id: 'EX-01', nama: 'Jaw Crusher', foto: '',
  });

  it('membuat aset baru: set + runTransaction, createdBy terisi, array unshift', async () => {
    const self = makeCtx({ equipForm: validForm() });

    await self.submitEquipment();

    const [, payload] = window.set.mock.calls[0];
    expect(window.set.mock.calls[0][0]).toMatchObject({ path: 'Equipment/EX-01' });
    expect(payload).toMatchObject({
      EquipmentID: 'EX-01', Nama: 'Jaw Crusher', CurrentHM: 0,
      createdBy: 'u1', updatedBy: 'u1',
    });
    expect(window.runTransaction).toHaveBeenCalledTimes(1);
    expect(self.equipment).toHaveLength(1);
    expect(self.showEquipModal).toBe(false);
    expect(self.showNotification).toHaveBeenCalledWith('Asset saved successfully!');
  });

  it('edit aset: tidak menaikkan Stats/totalEquip dan mempertahankan createdBy lama', async () => {
    const self = makeCtx({
      equipForm: validForm(),
      isEditingEquip: true,
      equipment: [{ EquipmentID: 'EX-01', createdBy: 'pembuat-asli' }],
    });

    await self.submitEquipment();

    expect(window.runTransaction).not.toHaveBeenCalled();
    expect(window.set.mock.calls[0][1].createdBy).toBe('pembuat-asli');
    expect(self.equipment[0].createdBy).toBe('pembuat-asli');
  });

  it('edit aset yang tidak ada di array: createdBy tidak diisi', async () => {
    const self = makeCtx({ equipForm: validForm(), isEditingEquip: true, equipment: [] });

    await self.submitEquipment();

    expect(window.set.mock.calls[0][1]).not.toHaveProperty('createdBy');
  });

  it('unggah foto: URL hasil upload dipakai sebagai FotoURL', async () => {
    const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' });
    const self = makeCtx({
      equipForm: validForm(),
      tempEquipFile: file,
      uploadImage: vi.fn().mockResolvedValue('https://cdn/f.jpg'),
    });

    await self.submitEquipment();

    expect(self.uploadImage).toHaveBeenCalledWith(file);
    // sanitizeDataForFirebase meng-escape "/" jadi "&#x2F;" — lihat tes BUG di bawah.
    expect(window.set.mock.calls[0][1].FotoURL).toBe('https:&#x2F;&#x2F;cdn&#x2F;f.jpg');
  });

  it('upload gagal mengembalikan string kosong: jatuh ke foto lama', async () => {
    const self = makeCtx({
      equipForm: { ...validForm(), foto: 'https://cdn/lama.jpg' },
      tempEquipFile: new File(['x'], 'f.jpg', { type: 'image/jpeg' }),
      uploadImage: vi.fn().mockResolvedValue(''),
    });

    await self.submitEquipment();

    expect(window.set.mock.calls[0][1].FotoURL).toBe('https:&#x2F;&#x2F;cdn&#x2F;lama.jpg');
  });

  it('FotoURL "null" dibersihkan jadi string kosong', async () => {
    const self = makeCtx({ equipForm: { ...validForm(), foto: 'null' } });

    await self.submitEquipment();

    expect(window.set.mock.calls[0][1].FotoURL).toBe('');
  });

  it('aset yang sudah ada diganti di tempat, bukan diduplikasi', async () => {
    const self = makeCtx({
      equipForm: validForm(),
      equipment: [{ EquipmentID: 'EX-01', Nama: 'Lama' }],
    });

    await self.submitEquipment();

    expect(self.equipment).toHaveLength(1);
    expect(self.equipment[0].Nama).toBe('Jaw Crusher');
  });

  it('selectedEquip ikut diperbarui bila aset yang sama sedang dibuka', async () => {
    const self = makeCtx({
      equipForm: validForm(),
      selectedEquip: { EquipmentID: 'EX-01', Nama: 'Lama', extra: 'tetap' },
    });

    await self.submitEquipment();

    expect(self.selectedEquip).toMatchObject({ EquipmentID: 'EX-01', Nama: 'Jaw Crusher', extra: 'tetap' });
  });

  it('audit trail dicatat dengan aksi Create/Update', async () => {
    const self = makeCtx({ equipForm: validForm() });
    await self.submitEquipment();
    expect(window.auditModule.logAudit).toHaveBeenCalledWith('Create Equipment', { id: 'EX-01', nama: 'Jaw Crusher' });

    const self2 = makeCtx({ equipForm: validForm(), isEditingEquip: true, equipment: [] });
    await self2.submitEquipment();
    expect(window.auditModule.logAudit).toHaveBeenLastCalledWith('Update Equipment', { id: 'EX-01', nama: 'Jaw Crusher' });
  });

  it('audit trail melempar: ditelan, penyimpanan tetap sukses', async () => {
    window.auditModule.logAudit.mockImplementationOnce(() => { throw new Error('audit mati'); });
    const self = makeCtx({ equipForm: validForm() });

    await self.submitEquipment();

    expect(self.equipment).toHaveLength(1);
    expect(self.showNotification).toHaveBeenCalledWith('Asset saved successfully!');
  });

  it('window.set gagal: error dilaporkan lewat notifikasi, isLoading kembali false', async () => {
    // withRetry menunggu 1s lalu 2s sebelum menyerah — jalankan dengan timer palsu.
    vi.useFakeTimers();
    window.set.mockRejectedValue(new Error('permission denied'));
    const self = makeCtx({ equipForm: validForm() });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const run = self.submitEquipment();
    await vi.advanceTimersByTimeAsync(4000);
    await run;

    expect(window.set).toHaveBeenCalledTimes(3);
    expect(self.showNotification).toHaveBeenCalledWith('Error: permission denied', 'error');
    expect(self.isLoading).toBe(false);
    expect(self.showEquipModal).toBe(false);
    errSpy.mockRestore();
    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('equipment.js: submitEquipment — jalur offline', () => {
  const validForm = () => ({ ...DEFAULT_EQUIP_FORM(), id: 'EX-01', nama: 'Jaw Crusher' });

  it('antrean berhasil: state lokal diperbarui, tidak menyentuh RTDB', async () => {
    const self = makeCtx({
      equipForm: validForm(),
      isOnline: false,
      queueOfflineOperation: vi.fn().mockResolvedValue(true),
    });

    await self.submitEquipment();

    expect(self.queueOfflineOperation).toHaveBeenCalledWith('equipment', expect.objectContaining({ EquipmentID: 'EX-01' }));
    expect(window.set).not.toHaveBeenCalled();
    expect(self.equipment).toHaveLength(1);
    expect(self.saveToIndexedDB).toHaveBeenCalled();
    expect(self.showNotification).toHaveBeenCalledWith('Asset saved offline, will sync when online');
    expect(self.showEquipModal).toBe(false);
    expect(self.isLoading).toBe(false);
  });

  it('antrean berhasil untuk aset yang sudah ada: diganti di tempat', async () => {
    const self = makeCtx({
      equipForm: validForm(),
      isOnline: false,
      equipment: [{ EquipmentID: 'EX-01', Nama: 'Lama' }],
      queueOfflineOperation: vi.fn().mockResolvedValue(true),
    });

    await self.submitEquipment();

    expect(self.equipment).toHaveLength(1);
    expect(self.equipment[0].Nama).toBe('Jaw Crusher');
  });

  it('antrean gagal: lanjut ke jalur online', async () => {
    const self = makeCtx({
      equipForm: validForm(),
      isOnline: false,
      queueOfflineOperation: vi.fn().mockResolvedValue(false),
    });

    await self.submitEquipment();

    expect(window.set).toHaveBeenCalled();
    expect(self.showNotification).toHaveBeenCalledWith('Asset saved successfully!');
  });
});

describe('equipment.js: goToDetail', () => {
  it('aset ditemukan: pindah ke halaman detail tab riwayat dan scroll ke atas', () => {
    const self = makeCtx({ equipment: [{ EquipmentID: 'EX-01' }] });

    self.goToDetail('EX-01');

    expect(self.selectedEquip).toEqual({ EquipmentID: 'EX-01' });
    expect(self.currentPage).toBe('detail');
    expect(self.activeTab).toBe('hist');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('aset tidak ditemukan: notifikasi error, halaman tidak berubah', () => {
    const self = makeCtx({ equipment: [] });

    self.goToDetail('NOPE');

    expect(self.selectedEquip).toBeUndefined();
    expect(self.currentPage).toBeUndefined();
    expect(self.showNotification).toHaveBeenCalledWith('Asset not found in database', 'error');
  });
});

describe('equipment.js: retry jaringan', () => {
  it('kegagalan jaringan: memberi tahu "Network error, retrying..." lalu sukses di percobaan kedua', async () => {
    vi.useFakeTimers();
    window.set
      .mockRejectedValueOnce(new Error('network request failed'))
      .mockResolvedValue(undefined);
    const self = makeCtx({ equipForm: { ...DEFAULT_EQUIP_FORM(), id: 'EX-01', nama: 'Jaw Crusher' } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const run = self.submitEquipment();
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
  window.runTransaction = vi.fn().mockResolvedValue(1);
  window.scrollTo = vi.fn();
  window.auditModule = { logAudit: vi.fn() };
  URL.createObjectURL = vi.fn(() => 'blob:mock-' + Math.random().toString(36).slice(2));
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.auditModule;
});
