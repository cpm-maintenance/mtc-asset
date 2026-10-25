// @vitest-environment jsdom
/**
 * `approveWO()` pada record yang tidak ada di RTDB (S39).
 *
 * Bug: update parsial 6 field ke node kosong selalu ditolak
 * `HistoryLog/$logId/.validate` (`hasChildren(['LogID','EquipmentID','Jenis','Deskripsi'])`)
 * dan dilaporkan sebagai `permission_denied` — terbaca seperti masalah role.
 * Guard sekarang memeriksa `exists()` sebelum memotong stok atau menulis apa pun.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeApp, stubFirebase } from './helpers/app-harness.js';

beforeEach(() => {
    vi.useRealTimers();
    stubFirebase();
});

const ghost = () => makeApp({ logs: [{ LogID: 'LOG-GHOST', Status: 'Pending', Jenis: 'Breakdown', EquipmentID: 'EQ-1', Deskripsi: 'x' }] });

describe('approveWO — record hantu', () => {
    it('node tidak ada: tidak menulis apa pun, record dibuang dari state, pesan jelas', async () => {
        const s = ghost();
        window.get = vi.fn().mockResolvedValue({ val: () => null, exists: () => false });

        await s.approveWO('LOG-GHOST');

        expect(window.update).not.toHaveBeenCalled();
        expect(window.set).not.toHaveBeenCalled();
        expect(window.runTransaction?.mock?.calls?.length ?? 0).toBe(0);
        expect(s.logs).toEqual([]);
        expect(s.showNotification).toHaveBeenCalledWith(expect.stringContaining('tidak ada lagi'), 'error');
        expect(s.showNotification).not.toHaveBeenCalledWith('Work Order Approved!');
    });

    it('node ada: update parsial tetap jalan seperti sebelumnya', async () => {
        const s = ghost();
        window.get = vi.fn().mockResolvedValue({
            val: () => ({ LogID: 'LOG-GHOST', Status: 'Pending' }),
            exists: () => true,
        });

        await s.approveWO('LOG-GHOST');

        expect(window.update).toHaveBeenCalledTimes(1);
        const [ref, updates] = window.update.mock.calls[0];
        expect(ref).toBeTruthy();
        expect(updates).toMatchObject({ Status: 'Approved', rejectedBy: '', rejectionDate: '', rejectionReason: '' });
        expect(s.showNotification).toHaveBeenCalledWith('Work Order Approved!');
        expect(s.logs).toHaveLength(1);
    });

    it('pemeriksaan gagal (jaringan): approve tetap dicoba, tidak menelan error', async () => {
        const s = ghost();
        window.get = vi.fn().mockRejectedValue(new Error('offline'));

        await s.approveWO('LOG-GHOST');

        expect(window.update).toHaveBeenCalledTimes(1);
        expect(s.showNotification).toHaveBeenCalledWith('Work Order Approved!');
    });
});
