import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendPushViaProxy } from '../src/js/modules/push-client.js';

/**
 * push-client hanya punya satu jalur: POST ke proxy FCM, fire-and-forget.
 * Yang perlu dikunci: bentuk badan request (nama field ala OneSignal tetap
 * dipakai karena `/api/fcm-push` menerimanya), dan bahwa kegagalan jaringan
 * TIDAK pernah melempar ke pemanggil.
 */
describe('push-client: sendPushViaProxy', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mengirim POST JSON ke URL proxy', async () => {
    await sendPushViaProxy('Judul', 'Isi pesan');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/fcm-push');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('badan request memakai headings/contents + segmen All + ikon', async () => {
    await sendPushViaProxy('WO Baru', 'WO-123 dibuat');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      headings: { en: 'WO Baru' },
      contents: { en: 'WO-123 dibuat' },
      included_segments: ['All'],
      data: {},
      icon: '/logo.png',
    });
  });

  it('data tambahan ikut terkirim apa adanya', async () => {
    await sendPushViaProxy('T', 'B', { woId: 'WO-9', url: '/pages/WorkOrders.html' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data).toEqual({ woId: 'WO-9', url: '/pages/WorkOrders.html' });
  });

  it('tidak mengirim app_id (endpoint FCM mengabaikannya)', async () => {
    await sendPushViaProxy('T', 'B');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('app_id');
  });

  it('fetch gagal: ditelan, hanya console.warn, tidak melempar', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(sendPushViaProxy('T', 'B')).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[PushProxy] Error:', 'network down');
  });

  it('HTTP error tidak dilempar (fire-and-forget, respons tidak diperiksa)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(sendPushViaProxy('T', 'B')).resolves.toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
