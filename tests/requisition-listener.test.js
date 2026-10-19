// @vitest-environment jsdom
/**
 * Unit tests untuk `setupRequisitionsListener` di `src/js/modules/requisition.js`.
 *
 * Listener RTDB tidak bisa dijalankan sungguhan di unit test, jadi
 * `window.onValue` di-stub dan callback-nya dipanggil manual — persis seperti
 * snapshot Firebase datang. `push-client` di-mock supaya tidak ada fetch nyata.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/js/modules/push-client.js', () => ({
  sendPushViaProxy: vi.fn().mockResolvedValue(undefined),
}));

import { sendPushViaProxy } from '../src/js/modules/push-client.js';
import { requisitionModule } from '../src/js/modules/requisition.js';

let handlers;
let unsubscribe;

function makeCtx(overrides = {}) {
  const self = Object.create(requisitionModule);
  Object.assign(self, {
    requisitions: [],
    reqLoading: true,
    _reqUnsubscribe: null,
    _reqPrevStatuses: {},
    _reqSeenIds: undefined,
    showNotification: vi.fn(),
  }, overrides);
  return self;
}

/** Snapshot palsu: `val()` mengembalikan objek record atau undefined. */
function snapshot(value) {
  return { exists: () => value !== undefined, val: () => value };
}

function start(self) {
  self.setupRequisitionsListener();
  return handlers;
}

describe('requisition.js — setupRequisitionsListener', () => {
  it('tanpa window.db: tidak memasang listener', () => {
    window.db = null;
    const self = makeCtx();

    self.setupRequisitionsListener();

    expect(window.onValue).not.toHaveBeenCalled();
  });

  it('melepas listener lama sebelum memasang yang baru', () => {
    const oldUnsub = vi.fn();
    const self = makeCtx({ _reqUnsubscribe: oldUnsub });

    start(self);

    expect(oldUnsub).toHaveBeenCalledTimes(1);
    expect(self._reqUnsubscribe).not.toBe(oldUnsub);
    expect(typeof self._reqUnsubscribe).toBe('function');
  });

  it('snapshot pertama hanya menyemai state, tanpa notifikasi', () => {
    const self = makeCtx();
    const h = start(self);

    h.next(snapshot({
      REQ_A: { id: 'REQ_A', status: 'pending', itemName: 'Bearing' },
      REQ_B: { id: 'REQ_B', status: 'approved', itemName: 'Seal' },
    }));

    expect(self.requisitions).toHaveLength(2);
    expect(self.showNotification).not.toHaveBeenCalled();
    expect(sendPushViaProxy).not.toHaveBeenCalled();
    expect(self.reqLoading).toBe(false);
  });

  it('snapshot kosong: daftar dikosongkan', () => {
    const self = makeCtx({ requisitions: [{ id: 'lama' }] });
    const h = start(self);

    h.next(snapshot(undefined));

    expect(self.requisitions).toEqual([]);
    expect(self.reqLoading).toBe(false);
  });

  it('request baru setelah muat awal: notifikasi in-app + push + tambah ke seen', () => {
    const self = makeCtx();
    const h = start(self);
    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'pending', itemName: 'Bearing' } }));

    h.next(snapshot({
      REQ_A: { id: 'REQ_A', status: 'pending', itemName: 'Bearing' },
      REQ_C: { id: 'REQ_C', status: 'pending', itemName: 'V-Belt', requesterName: 'Andi' },
    }));

    expect(self.showNotification).toHaveBeenCalledWith('📦 Andi requested: V-Belt', 'info');
    expect(sendPushViaProxy).toHaveBeenCalledWith('📦 Request Part Baru', 'Andi meminta: V-Belt');
    expect(self._reqSeenIds.has('REQ_C')).toBe(true);
  });

  it('request baru multi-item: label memakai "+N others"', () => {
    const self = makeCtx();
    const h = start(self);
    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'pending' } }));

    h.next(snapshot({
      REQ_A: { id: 'REQ_A', status: 'pending' },
      REQ_D: { id: 'REQ_D', status: 'pending', requesterName: 'Budi', items: [{ itemName: 'Bearing' }, { itemName: 'Seal' }, { itemName: 'Hose' }] },
    }));

    expect(self.showNotification).toHaveBeenCalledWith('📦 Budi requested: Bearing +2 others', 'info');
  });

  it('requester kosong jatuh ke createdBy lalu "Someone"', () => {
    const self = makeCtx();
    const h = start(self);
    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'pending' } }));

    h.next(snapshot({
      REQ_A: { id: 'REQ_A', status: 'pending' },
      REQ_E: { id: 'REQ_E', status: 'pending', createdBy: 'uid-9', itemName: 'Gasket' },
    }));

    expect(self.showNotification).toHaveBeenCalledWith('📦 uid-9 requested: Gasket', 'info');
  });

  it('transisi pending → approved memberi notifikasi disetujui', () => {
    const self = makeCtx();
    const h = start(self);
    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'pending', itemName: 'Bearing' } }));

    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'approved', itemName: 'Bearing' } }));

    expect(self.showNotification).toHaveBeenCalledWith('📋 Bearing approved!', 'success');
    expect(sendPushViaProxy).toHaveBeenCalledWith('✅ Request Disetujui', 'Bearing telah disetujui');
    expect(self._reqPrevStatuses.REQ_A).toBe('approved');
  });

  it('transisi approved → arrived memberi notifikasi barang tiba', () => {
    const self = makeCtx();
    const h = start(self);
    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'approved', itemName: 'Seal' } }));

    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'arrived', itemName: 'Seal' } }));

    expect(self.showNotification).toHaveBeenCalledWith('📦 Seal arrived!', 'success');
    expect(sendPushViaProxy).toHaveBeenCalledWith('📦 Barang Tiba', 'Seal sudah sampai');
  });

  it('transisi arrived → closed memberi notifikasi ditutup', () => {
    const self = makeCtx();
    const h = start(self);
    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'arrived', itemName: 'Hose' } }));

    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'closed', itemName: 'Hose' } }));

    expect(self.showNotification).toHaveBeenCalledWith('🔒 Hose closed', 'info');
    expect(sendPushViaProxy).toHaveBeenCalledWith('🔒 Request Ditutup', 'Hose selesai');
  });

  it('perubahan status lain (bukan rantai resmi) tidak memberi notifikasi', () => {
    const self = makeCtx();
    const h = start(self);
    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'pending', itemName: 'X' } }));

    h.next(snapshot({ REQ_A: { id: 'REQ_A', status: 'closed', itemName: 'X' } }));

    expect(self.showNotification).not.toHaveBeenCalled();
    expect(self._reqPrevStatuses.REQ_A).toBe('closed');
  });

  it('snapshot rusak (val melempar): ditangkap, reqLoading tetap ditutup', () => {
    const self = makeCtx();
    const h = start(self);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    h.next({ exists: () => true, val: () => { throw new Error('decode gagal'); } });

    expect(warn).toHaveBeenCalledWith('[Requisition] Listener error:', 'decode gagal');
    expect(self.reqLoading).toBe(false);
  });

  it('callback error RTDB: dicatat dan loading dimatikan', () => {
    const self = makeCtx();
    const h = start(self);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    h.error(new Error('permission_denied'));

    expect(err).toHaveBeenCalledWith('[Requisition] Listener error:', new Error('permission_denied'));
    expect(self.reqLoading).toBe(false);
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  window.db = {};
  window.ref = vi.fn((_db, path) => ({ path }));
  unsubscribe = vi.fn();
  window.onValue = vi.fn((_ref, next, error) => {
    handlers = { next, error };
    return unsubscribe;
  });
  window.auditModule = { logAudit: vi.fn() };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.onValue;
  delete window.auditModule;
});
