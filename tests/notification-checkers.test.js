// @vitest-environment jsdom
/**
 * Unit tests untuk checker notifikasi di `src/js/modules/notification.js` (Q-1).
 *
 * Seluruh fungsi checker (`checkLowStockParts`, `checkPendingWorkOrders`,
 * `checkPMOverdue`, `checkWarrantyExpiry`) bersifat privat dan hanya bisa
 * dipanggil lewat `checkAllNotifications()`, jadi test di sini menggerakkan
 * `window.app` lalu memeriksa isi `window.app.notifications` (panel lonceng).
 *
 * Catatan: `shouldNotify()` adalah anti-spam per sesi, jadi `resetNotifBlocker()`
 * wajib dipanggil di setiap `beforeEach`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    checkAllNotifications,
    resetNotifBlocker,
    requestNotificationPermission,
    sendBrowserNotification,
} from '../src/js/modules/notification.js';

/** Stub `Notification` global; mengembalikan daftar panggilan konstruktor. */
function stubNotification(permission = 'granted', requestResult = 'granted') {
    const calls = [];
    const Ctor = vi.fn(function NotificationStub(title, options) {
        calls.push({ title, options });
    });
    Ctor.permission = permission;
    Ctor.requestPermission = vi.fn(async () => requestResult);
    vi.stubGlobal('Notification', Ctor);
    return { Ctor, calls };
}

/** Stub `navigator.serviceWorker.ready` dengan registration palsu. */
function stubServiceWorker(showNotification = vi.fn(async () => {})) {
    Object.defineProperty(navigator, 'serviceWorker', {
        value: { ready: Promise.resolve({ showNotification }) },
        configurable: true,
    });
    return showNotification;
}

function resetApp(overrides = {}) {
    window.app = {
        notifications: [],
        logs: [],
        allParts: [],
        pmList: [],
        ...overrides,
    };
    return window.app;
}

const findNotif = (type) => window.app.notifications.find((n) => n.type === type);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
const daysAhead = (n) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

beforeEach(() => {
    resetNotifBlocker();
    resetApp();
    stubNotification('granted');
    delete navigator.serviceWorker;
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete window.app;
    delete navigator.serviceWorker;
});

describe('notification.js — requestNotificationPermission', () => {
    it('mengembalikan false bila Notification API tidak tersedia', async () => {
        vi.unstubAllGlobals();
        delete globalThis.Notification;

        await expect(requestNotificationPermission()).resolves.toBe(false);
    });

    it('langsung true bila izin sudah granted', async () => {
        const { Ctor } = stubNotification('granted');

        await expect(requestNotificationPermission()).resolves.toBe(true);
        expect(Ctor.requestPermission).not.toHaveBeenCalled();
    });

    it('false tanpa meminta ulang bila izin sudah denied', async () => {
        const { Ctor } = stubNotification('denied');

        await expect(requestNotificationPermission()).resolves.toBe(false);
        expect(Ctor.requestPermission).not.toHaveBeenCalled();
    });

    it('true setelah user memberi izin lewat prompt', async () => {
        stubNotification('default', 'granted');

        await expect(requestNotificationPermission()).resolves.toBe(true);
    });

    it('false bila user menolak prompt', async () => {
        stubNotification('default', 'denied');

        await expect(requestNotificationPermission()).resolves.toBe(false);
    });

    it('false dan mencatat warning bila prompt melempar error', async () => {
        const { Ctor } = stubNotification('default');
        Ctor.requestPermission = vi.fn(async () => {
            throw new Error('blocked by policy');
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(requestNotificationPermission()).resolves.toBe(false);
        expect(warn).toHaveBeenCalled();
    });
});

describe('notification.js — sendBrowserNotification', () => {
    it('false bila izin belum granted', async () => {
        stubNotification('denied');

        await expect(sendBrowserNotification('Judul', 'Isi')).resolves.toBe(false);
    });

    it('memakai Notification langsung bila service worker tidak ada', async () => {
        const { calls } = stubNotification('granted');

        await expect(sendBrowserNotification('Judul', 'Isi')).resolves.toBe(true);
        expect(calls[0].title).toBe('Judul');
        expect(calls[0].options).toMatchObject({ body: 'Isi', icon: '/logo.png' });
    });

    it('memakai registration.showNotification bila service worker siap', async () => {
        stubNotification('granted');
        const showNotification = stubServiceWorker();

        await expect(sendBrowserNotification('Judul', 'Isi', { tag: 'tag-x', data: { a: 1 } })).resolves.toBe(true);

        expect(showNotification).toHaveBeenCalledTimes(1);
        const [title, options] = showNotification.mock.calls[0];
        expect(title).toBe('Judul');
        expect(options).toMatchObject({ body: 'Isi', tag: 'tag-x', data: { a: 1 }, badge: '/logo.png' });
    });

    it('memakai tag default mtc-notification', async () => {
        stubNotification('granted');
        const showNotification = stubServiceWorker();

        await sendBrowserNotification('Judul', 'Isi');

        expect(showNotification.mock.calls[0][1].tag).toBe('mtc-notification');
    });

    it('false bila konstruktor Notification melempar', async () => {
        const Ctor = vi.fn(function Throwing() {
            throw new Error('diblokir browser');
        });
        Ctor.permission = 'granted';
        vi.stubGlobal('Notification', Ctor);
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(sendBrowserNotification('Judul', 'Isi')).resolves.toBe(false);
    });

    it('mengirim actions default berupa array kosong', async () => {
        stubNotification('granted');
        const showNotification = stubServiceWorker();

        await sendBrowserNotification('Judul', 'Isi');

        expect(showNotification.mock.calls[0][1].actions).toEqual([]);
        expect(showNotification.mock.calls[0][1].requireInteraction).toBe(true);
    });
});

describe('notification.js — checkAllNotifications: low stock', () => {
    it('memberi tahu part yang stoknya 0', () => {
        resetApp({ allParts: [{ PartID: 'P1', NamaPart: 'Bearing', Stok: 0 }] });

        checkAllNotifications();

        expect(findNotif('Low Stock').message).toBe('1 part stok 0: Bearing');
    });

    it('memberi tahu part yang menyentuh MinStock', () => {
        resetApp({ allParts: [{ PartID: 'P1', NamaPart: 'Seal', Stok: 2, MinStock: 5 }] });

        checkAllNotifications();

        expect(findNotif('Low Stock').message).toBe('1 part di bawah minimum: Seal');
    });

    it('meringkas daftar lebih dari 3 part', () => {
        resetApp({
            allParts: [
                { PartID: 'P1', NamaPart: 'A', Stok: 0 },
                { PartID: 'P2', NamaPart: 'B', Stok: 0 },
                { PartID: 'P3', NamaPart: 'C', Stok: 0 },
                { PartID: 'P4', NamaPart: 'D', Stok: 0 },
            ],
        });

        checkAllNotifications();

        expect(findNotif('Low Stock').message).toBe('4 part stok 0: A, B, C +1');
    });

    it('memakai PartID bila NamaPart kosong', () => {
        resetApp({ allParts: [{ PartID: 'P-77', Stok: 0 }] });

        checkAllNotifications();

        expect(findNotif('Low Stock').message).toContain('P-77');
    });

    it('tidak memberi tahu saat stok aman', () => {
        resetApp({ allParts: [{ PartID: 'P1', NamaPart: 'A', Stok: 50, MinStock: 5 }] });

        checkAllNotifications();

        expect(window.app.notifications).toEqual([]);
    });

    it('mengabaikan part tanpa MinStock saat menghitung low stock', () => {
        resetApp({ allParts: [{ PartID: 'P1', NamaPart: 'A', Stok: 1, MinStock: 0 }] });

        checkAllNotifications();

        expect(window.app.notifications).toEqual([]);
    });
});

describe('notification.js — checkAllNotifications: work order', () => {
    it('memberi tahu WO berprioritas Emergency/Urgent yang belum di-approve', () => {
        resetApp({
            logs: [
                { Status: 'Pending', woPriority: 'Emergency', woNumber: 'WO-1' },
                { Status: 'Draft', woPriority: 'Urgent', woNumber: 'WO-2' },
                { Status: 'Pending', woPriority: 'Normal', woNumber: 'WO-3' },
                { Status: 'Approved', woPriority: 'Emergency', woNumber: 'WO-4' },
            ],
        });

        checkAllNotifications();

        expect(findNotif('Work Order').message).toBe('2 WO urgent: #WO-1 (Emergency), #WO-2 (Urgent)');
    });

    it('memberi tahu WO pending lebih dari 3 hari beserta umurnya', () => {
        resetApp({ logs: [{ Status: 'Pending', Tanggal: daysAgo(5), woNumber: 'WO-9' }] });

        checkAllNotifications();

        expect(findNotif('WO Aging').message).toBe('1 WO pending > 3 hari: #WO-9 (5d)');
    });

    it('tidak menghitung WO pending yang belum lewat 3 hari', () => {
        resetApp({ logs: [{ Status: 'Pending', Tanggal: daysAgo(3), woNumber: 'WO-9' }] });

        checkAllNotifications();

        expect(findNotif('WO Aging')).toBeUndefined();
    });

    it('mengabaikan log tanpa tanggal atau tanggal tidak valid', () => {
        resetApp({
            logs: [
                { Status: 'Pending', woNumber: 'WO-1' },
                { Status: 'Pending', Tanggal: 'bukan-tanggal', woNumber: 'WO-2' },
            ],
        });

        checkAllNotifications();

        expect(findNotif('WO Aging')).toBeUndefined();
    });

    it('memakai N/A bila woNumber kosong', () => {
        resetApp({ logs: [{ Status: 'Pending', woPriority: 'Urgent' }] });

        checkAllNotifications();

        expect(findNotif('Work Order').message).toContain('#N/A (Urgent)');
    });
});

describe('notification.js — checkAllNotifications: PM', () => {
    it('memisahkan PM overdue dan PM jatuh tempo H-3', () => {
        resetApp({
            pmList: [
                { status: 'pending', date: daysAgo(2), taskName: 'Ganti oli' },
                { status: 'pending', date: daysAhead(2), taskName: 'Cek belt' },
                { status: 'done', date: daysAgo(2), taskName: 'Sudah selesai' },
            ],
        });

        checkAllNotifications();

        expect(findNotif('PM Overdue').message).toBe('1 task lewat jadwal: Ganti oli');
        expect(findNotif('PM Due Soon').message).toBe('1 task jatuh tempo H-3: Cek belt');
    });

    it('tidak memberi tahu bila semua PM masih jauh', () => {
        resetApp({ pmList: [{ status: 'pending', date: daysAhead(30), taskName: 'Nanti' }] });

        checkAllNotifications();

        expect(findNotif('PM Overdue')).toBeUndefined();
        expect(findNotif('PM Due Soon')).toBeUndefined();
    });
});

describe('notification.js — checkAllNotifications: umur pakai part', () => {
    it('memberi tahu part yang melewati avgLifetimeDays', () => {
        resetApp({
            allParts: [
                {
                    PartID: 'P1',
                    NamaPart: 'Seal',
                    lastReplaceDate: daysAgo(400),
                    avgLifetimeDays: 365,
                },
            ],
        });

        checkAllNotifications();

        expect(findNotif('Lifetime Check').message).toBe('1 part lewat umur pakai: Seal');
    });

    it('mengabaikan part tanpa tanggal pasang atau tanpa lifetime', () => {
        resetApp({
            allParts: [
                { PartID: 'P1', NamaPart: 'A', avgLifetimeDays: 365 },
                { PartID: 'P2', NamaPart: 'B', lastReplaceDate: daysAgo(400) },
                { PartID: 'P3', NamaPart: 'C', lastReplaceDate: 'bukan-tanggal', avgLifetimeDays: 1 },
            ],
        });

        checkAllNotifications();

        expect(findNotif('Lifetime Check')).toBeUndefined();
    });
});

describe('notification.js — checkAllNotifications: perilaku umum', () => {
    it('tidak menambah notifikasi duplikat saat dipanggil berulang', () => {
        resetApp({ allParts: [{ PartID: 'P1', NamaPart: 'A', Stok: 0 }] });

        checkAllNotifications();
        const after1 = window.app.notifications.length;
        checkAllNotifications();

        expect(window.app.notifications.length).toBe(after1);
    });

    it('aman saat window.app belum siap', () => {
        delete window.app;

        expect(() => checkAllNotifications()).not.toThrow();
    });

    it('menjalankan auto-reorder hanya untuk admin/supervisor', () => {
        const autoReorderLowStock = vi.fn(async () => {});
        resetApp({ autoReorderLowStock, isAdminOrSupervisor: true });

        checkAllNotifications();

        expect(autoReorderLowStock).toHaveBeenCalledTimes(1);
    });

    it('tidak menjalankan auto-reorder untuk role biasa', () => {
        const autoReorderLowStock = vi.fn(async () => {});
        resetApp({ autoReorderLowStock, isAdminOrSupervisor: false });

        checkAllNotifications();

        expect(autoReorderLowStock).not.toHaveBeenCalled();
    });

    it('tidak melempar bila auto-reorder menolak', async () => {
        const autoReorderLowStock = vi.fn(async () => {
            throw new Error('offline');
        });
        resetApp({ autoReorderLowStock, isAdminOrSupervisor: true });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        checkAllNotifications();
        await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    });

    it('menandai notifikasi in-app dengan ikon + warna', () => {
        resetApp({ allParts: [{ PartID: 'P1', NamaPart: 'A', Stok: 0 }] });

        checkAllNotifications();

        const notif = findNotif('Low Stock');
        // Dulu `fa-box` + `border-red-500` — FontAwesome sudah dibuang, jadi
        // ikonnya tidak pernah tampil. Sekarang ligatur Material Symbols lokal.
        expect(notif.icon).toBe('inventory_2');
        expect(notif.color).toContain('border-tac-status-emergency');
        expect(notif.exiting).toBe(false);
        expect(typeof notif.id).toBe('number');
    });

    it('resetNotifBlocker memungkinkan pemeriksaan ulang setelah blocker aktif', () => {
        resetApp({ allParts: [{ PartID: 'P1', NamaPart: 'A', Stok: 0 }] });
        checkAllNotifications();
        const first = window.app.notifications.length;

        resetNotifBlocker();
        window.app.notifications = [];
        checkAllNotifications();

        expect(window.app.notifications.length).toBe(first);
    });
});
