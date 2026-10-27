// @vitest-environment jsdom
/**
 * Hapus massal (multi-select) — Spare Parts, Work Orders, Request Part.
 *
 * Aturan yang dikunci:
 *  1. Konfirmasi sekali per batch, bukan per item (`askConfirm`).
 *  2. Penghapusan tetap lewat `deleteItem`/`deleteRequisition` yang sudah ada
 *     (offline queue, pemangkasan cache, state lokal) dengan `skipConfirm`
 *     supaya tidak muncul dialog berlapis.
 *  3. Satu item gagal tidak menghentikan sisanya.
 *  4. Seleksi dibersihkan setelah batch selesai.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/js/modules/confirm-dialog.js', () => ({ askConfirm: vi.fn(async () => true) }));
vi.mock('../src/js/modules/notification.js', () => ({
  sendBrowserNotification: vi.fn(),
  resetNotifBlocker: vi.fn(),
  requestNotificationPermission: vi.fn(),
  sendBrowserNotificationAsync: vi.fn(),
  registerFCMToken: vi.fn(),
  removeFCMToken: vi.fn(),
  setupForegroundListener: vi.fn(),
  checkAllNotifications: vi.fn(),
}));
vi.mock('../src/js/modules/push-client.js', () => ({ sendPushViaProxy: vi.fn() }));

import { dataModule } from '../src/js/modules/data.js';
import { requisitionModule } from '../src/js/modules/requisition.js';
import { app } from '../src/js/app.js';

const appState = () => app();
import { askConfirm } from '../src/js/modules/confirm-dialog.js';

const withList = (ctx, name, value) => {
  Object.defineProperty(ctx, name, { value, writable: true, configurable: true });
  return ctx;
};

const makeCtx = (proto, overrides = {}) =>
  Object.assign(Object.create(proto), { showNotification: vi.fn(), isOnline: true }, overrides);

beforeEach(() => {
  askConfirm.mockClear();
  askConfirm.mockResolvedValue(true);
});

describe('data.js — bulkDeleteItems', () => {
  it('konfirmasi sekali, lalu hapus tiap id unik dengan skipConfirm', async () => {
    const deleteItem = vi.fn(async () => {});
    const ctx = makeCtx(dataModule, { deleteItem });

    const removed = await ctx.bulkDeleteItems('SpareParts', ['P1', 'P2', 'P2'], 'part');

    expect(askConfirm).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledTimes(2);
    expect(deleteItem).toHaveBeenCalledWith('SpareParts', 'P1', { skipConfirm: true });
    expect(removed).toBe(2);
    expect(ctx.showNotification).toHaveBeenCalled();
  });

  it('daftar kosong: tidak konfirmasi, tidak menghapus', async () => {
    const deleteItem = vi.fn(async () => {});
    const ctx = makeCtx(dataModule, { deleteItem });

    expect(await ctx.bulkDeleteItems('SpareParts', [], 'part')).toBe(0);
    expect(askConfirm).not.toHaveBeenCalled();
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('dibatalkan: tidak menghapus apa pun', async () => {
    askConfirm.mockResolvedValueOnce(false);
    const deleteItem = vi.fn(async () => {});
    const ctx = makeCtx(dataModule, { deleteItem });

    expect(await ctx.bulkDeleteItems('HistoryLog', ['W1'], 'work order')).toBe(0);
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('satu item gagal: sisanya tetap dihapus dan kegagalan dilaporkan', async () => {
    const deleteItem = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('permission_denied'))
      .mockResolvedValueOnce(undefined);
    const ctx = makeCtx(dataModule, { deleteItem });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    const removed = await ctx.bulkDeleteItems('HistoryLog', ['W1', 'W2', 'W3'], 'work order');

    expect(deleteItem).toHaveBeenCalledTimes(3);
    expect(removed).toBe(2);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('deleteItem(skipConfirm) tidak memanggil confirmDelete lagi', async () => {
    const confirmDelete = vi.fn(async () => true);
    const ctx = makeCtx(dataModule, { confirmDelete });
    window.ref = vi.fn(() => ({}));
    window.remove = vi.fn(async () => {});

    await ctx.deleteItem('SpareParts', 'P1', { skipConfirm: true }).catch(() => {});

    expect(confirmDelete).not.toHaveBeenCalled();
  });
});

describe('Work Orders — pilih & hapus massal', () => {
  const rows = [{ LogID: 'W1' }, { LogID: 'W2' }];

  it('toggle per baris dan pilih-semua mengikuti daftar yang tampil', () => {
    const ctx = withList(makeCtx(appState()), 'woVisible', rows);

    ctx.toggleWOSelect('W1');
    expect(ctx.woSelectedIds).toEqual(['W1']);
    ctx.toggleWOSelect('W1');
    expect(ctx.woSelectedIds).toEqual([]);

    ctx.toggleSelectAllWOs();
    expect(ctx.woSelectedIds).toEqual(['W1', 'W2']);
    ctx.toggleSelectAllWOs();
    expect(ctx.woSelectedIds).toEqual([]);
  });

  it('bulkDeleteWOs menghapus node HistoryLog lalu membersihkan seleksi', async () => {
    const bulkDeleteItems = vi.fn(async () => 2);
    const ctx = withList(makeCtx(appState(), { bulkDeleteItems }), 'woVisible', rows);
    ctx.woSelectedIds = ['W1', 'W2'];

    await ctx.bulkDeleteWOs();

    expect(bulkDeleteItems).toHaveBeenCalledWith('HistoryLog', ['W1', 'W2'], 'work order');
    expect(ctx.woSelectedIds).toEqual([]);
  });
});

describe('Spare Parts — pilih & hapus massal', () => {
  const rows = [{ PartID: 'P1' }, { PartID: 'P2' }];

  it('pilih-semua hanya menyentuh baris yang tampil (hasil filter)', () => {
    const ctx = withList(makeCtx(appState()), 'filteredAllParts', rows);

    ctx.toggleSelectAllParts();
    expect(ctx.partSelectedIds).toEqual(['P1', 'P2']);
    ctx.togglePartSelect('P1');
    expect(ctx.partAllVisibleSelected).toBe(false);
  });

  it('bulkDeleteParts memakai node SpareParts lalu membersihkan seleksi', async () => {
    const bulkDeleteItems = vi.fn(async () => 1);
    const ctx = withList(makeCtx(appState(), { bulkDeleteItems }), 'filteredAllParts', rows);
    ctx.partSelectedIds = ['P2'];

    await ctx.bulkDeleteParts();

    expect(bulkDeleteItems).toHaveBeenCalledWith('SpareParts', ['P2'], 'part');
    expect(ctx.partSelectedIds).toEqual([]);
  });
});

describe('Request Part — pilih & hapus massal', () => {
  const rows = [{ id: 'R1' }, { id: 'R2' }];

  it('pilih-semua memakai daftar hasil filter', () => {
    const ctx = makeCtx(requisitionModule, { reqGetFilteredList: () => rows });

    ctx.toggleSelectAllRequisitions();
    expect(ctx.reqSelectedIds).toEqual(['R1', 'R2']);
    ctx.toggleSelectAllRequisitions();
    expect(ctx.reqSelectedIds).toEqual([]);
  });

  it('bulkDeleteRequisitions menghapus tiap id tanpa dialog berlapis', async () => {
    const deleteRequisition = vi.fn(async () => {});
    const ctx = makeCtx(requisitionModule, { deleteRequisition });
    ctx.reqSelectedIds = ['R1', 'R2'];

    await ctx.bulkDeleteRequisitions();

    expect(askConfirm).toHaveBeenCalledTimes(1);
    expect(deleteRequisition).toHaveBeenCalledWith('R1', { skipConfirm: true });
    expect(deleteRequisition).toHaveBeenCalledWith('R2', { skipConfirm: true });
    expect(ctx.reqSelectedIds).toEqual([]);
  });
});

describe('komposisi app() — fungsi multi-select terpasang di state', () => {
  it('semua fungsi pilih & hapus massal tersedia dari app()', () => {
    const s = app();
    for (const fn of [
      'bulkDeleteItems',
      'togglePartSelect',
      'toggleSelectAllParts',
      'bulkDeleteParts',
      'toggleWOSelect',
      'toggleSelectAllWOs',
      'bulkDeleteWOs',
    ]) {
      expect(typeof s[fn], fn).toBe('function');
    }
  });
});

describe('state seleksi tersedia sejak render pertama', () => {
  it('app() sudah punya array seleksi — binding x-show tidak meledak', () => {
    const s = app();
    for (const key of ['woSelectedIds', 'partSelectedIds', 'reqSelectedIds']) {
      expect(Array.isArray(s[key]), `${key} harus array sejak awal, bukan dibuat malas`).toBe(true);
    }
  });
});

describe('semua identifier di markup multi-select ada di state app()', () => {
  // Alpine mengevaluasi binding mentah (`woSelectedIds.length`). Kalau key-nya
  // belum ada saat render, Alpine melempar ReferenceError dan halaman gagal muat
  // — persis kejadian di menu Work Orders sebelum `woSelectedIds` dideklarasikan.
  const IDENTIFIERS = [
    ['array', 'woSelectedIds'],
    ['array', 'partSelectedIds'],
    ['array', 'reqSelectedIds'],
    ['fn', 'toggleWOSelect'],
    ['fn', 'toggleSelectAllWOs'],
    ['fn', 'bulkDeleteWOs'],
    ['fn', 'togglePartSelect'],
    ['fn', 'toggleSelectAllParts'],
    ['fn', 'bulkDeleteParts'],
    ['fn', 'toggleSelectAllRequisitions'],
    ['fn', 'bulkDeleteRequisitions'],
    ['getter', 'woAllVisibleSelected'],
    ['getter', 'partAllVisibleSelected'],
    ['getter', 'reqAllVisibleSelected'],
  ];

  it.each(IDENTIFIERS)('%s %s tersedia dari app()', (kind, name) => {
    const s = app();
    expect(s[name], name).toBeDefined();
    if (kind === 'fn') expect(typeof s[name], name).toBe('function');
    if (kind === 'array') expect(Array.isArray(s[name]), name).toBe(true);
  });
});
