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
        value: { ready: Promise.resolve({ active: {}, showNotification }) },
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

/**
 * Sisi cabang yang tidak pernah dieksekusi tes berdata: `window.app` belum ada
 * (boot awal / setelah logout), panel lonceng rusak (`notifications` bukan
 * array), notifikasi duplikat, dan ServiceWorker yang belum siap. Semuanya
 * jalur "aplikasi setengah jadi" — justru yang paling sering muncul di lapangan.
 */
describe('notification — guard state kosong & ServiceWorker absen', () => {
    beforeEach(() => {
        resetNotifBlocker();
        stubNotification('granted');
    });

    it('checkAllNotifications tanpa window.app tidak melempar', () => {
        delete window.app;

        expect(() => checkAllNotifications()).not.toThrow();
    });

    it('panel lonceng rusak (notifications bukan array) diabaikan, bukan crash', () => {
        window.app = { notifications: null, allParts: [{ PartID: 'P1', Stok: 0 }], logs: [], pmList: [], performanceData: [] };

        expect(() => checkAllNotifications()).not.toThrow();
        expect(window.app.notifications).toBeNull();
    });

    it('notifikasi duplikat (tipe + pesan sama) tidak didorong dua kali', () => {
        window.app = {
            notifications: [{ type: 'Low Stock', message: 'sudah ada' }],
            allParts: [],
            logs: [],
            pmList: [],
            performanceData: [],
        };
        checkAllNotifications();
        const countAfterFirst = window.app.notifications.length;

        checkAllNotifications();

        expect(window.app.notifications.length).toBe(countAfterFirst);
    });

    it('auto-reorder hanya jalan untuk admin/supervisor', () => {
        const autoReorder = vi.fn(async () => {});

        window.app = { notifications: [], allParts: [], logs: [], pmList: [], performanceData: [], autoReorderLowStock: autoReorder, isAdminOrSupervisor: false };
        checkAllNotifications();
        expect(autoReorder).not.toHaveBeenCalled();

        window.app.isAdminOrSupervisor = true;
        checkAllNotifications();
        expect(autoReorder).toHaveBeenCalledTimes(1);
    });

    it('auto-reorder yang gagal tidak menjatuhkan checkAllNotifications', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        window.app = {
            notifications: [],
            allParts: [],
            logs: [],
            pmList: [],
            performanceData: [],
            autoReorderLowStock: vi.fn(async () => { throw new Error('offline'); }),
            isAdminOrSupervisor: true,
        };

        expect(() => checkAllNotifications()).not.toThrow();
        await Promise.resolve();
        await Promise.resolve();

        expect(warn).toHaveBeenCalledWith('[Notif] Auto-reorder:', 'offline');
        warn.mockRestore();
    });
});

describe('sendBrowserNotification — izin & ServiceWorker', () => {
    afterEach(() => {
        Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    });

    it('izin belum diberikan → false, tanpa membuat Notification', async () => {
        const { calls } = stubNotification('default');

        await expect(sendBrowserNotification('Judul', 'Isi')).resolves.toBe(false);
        expect(calls).toHaveLength(0);
    });

    it('ServiceWorker belum siap → jatuh ke Notification biasa, tetap terkirim', async () => {
        const { calls } = stubNotification('granted');
        Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });

        await expect(sendBrowserNotification('Fallback', 'tanpa SW')).resolves.toBe(true);
        expect(calls).toHaveLength(1);
        expect(calls[0].title).toBe('Fallback');
    });

    it('ServiceWorker siap → memakai showNotification milik registrasi', async () => {
        stubNotification('granted');
        const showNotification = stubServiceWorker();

        await expect(sendBrowserNotification('Lewat SW', 'isi', { tag: 'x' })).resolves.toBe(true);
        expect(showNotification).toHaveBeenCalledWith('Lewat SW', expect.objectContaining({ tag: 'x' }));
    });
});

/**
 * Sisi `true` dari setiap ternary `length > 3 ? ' +N lainnya' : ''` dan fallback
 * `NamaPart || PartID` / `woNumber || 'N/A'`. Tes berdata sebelumnya selalu
 * memakai 1 item, jadi jalur "kebanyakan item" tidak pernah dieksekusi padahal
 * itulah kondisi shift normal (belasan part low stock sekaligus).
 */
describe('notification — kategori dengan lebih dari 3 item', () => {
    const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
    const daysAhead = (n) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

    function seedSemua() {
        window.app = {
            notifications: [],
            allParts: [
                // 4 stok nol; yang pertama tanpa NamaPart → fallback ke PartID
                { PartID: 'Z1', Stok: 0, MinStock: 2 },
                { PartID: 'Z2', NamaPart: 'Seal', Stok: 0, MinStock: 2 },
                { PartID: 'Z3', NamaPart: 'V-Belt', Stok: 0, MinStock: 2 },
                { PartID: 'Z4', NamaPart: 'Bearing', Stok: 0, MinStock: 2 },
                // 4 mendekati minimum (di atas nol, supaya masuk lowStock)
                { PartID: 'L1', NamaPart: 'Filter', Stok: 1, MinStock: 5 },
                { PartID: 'L2', NamaPart: 'Oli', Stok: 2, MinStock: 5 },
                { PartID: 'L3', NamaPart: 'Grease', Stok: 3, MinStock: 5 },
                { PartID: 'L4', NamaPart: 'Gasket', Stok: 4, MinStock: 5 },
                // lewat umur pakai; yang pertama tanpa NamaPart, satu tanggal rusak
                { PartID: 'W1', Stok: 9, lastReplaceDate: daysAgo(400), avgLifetimeDays: 365 },
                { PartID: 'W2', NamaPart: 'Seal', Stok: 9, lastReplaceDate: daysAgo(500), avgLifetimeDays: 365 },
                { PartID: 'W3', NamaPart: 'V-Belt', Stok: 9, lastReplaceDate: daysAgo(600), avgLifetimeDays: 365 },
                { PartID: 'W4', NamaPart: 'Bearing', Stok: 9, lastReplaceDate: daysAgo(700), avgLifetimeDays: 365 },
                { PartID: 'W5', NamaPart: 'Rusak', Stok: 9, lastReplaceDate: 'bukan-tanggal', avgLifetimeDays: 365 },
            ],
            logs: [
                // 4 urgent; yang pertama tanpa woNumber → fallback 'N/A'
                { LogID: 'U1', Status: 'Pending', woPriority: 'Emergency', Tanggal: daysAgo(1) },
                { LogID: 'U2', Status: 'Pending', woPriority: 'Urgent', woNumber: 'WO-2', Tanggal: daysAgo(1) },
                { LogID: 'U3', Status: 'Draft', woPriority: 'Urgent', woNumber: 'WO-3', Tanggal: daysAgo(1) },
                { LogID: 'U4', Status: 'Pending', woPriority: 'Urgent', woNumber: 'WO-4', Tanggal: daysAgo(1) },
                // 4 aging (> 3 hari, tanpa prioritas urgent); yang pertama tanpa woNumber
                { LogID: 'A1', Status: 'Pending', Tanggal: daysAgo(10) },
                { LogID: 'A2', Status: 'Pending', woNumber: 'WO-12', Tanggal: daysAgo(11) },
                { LogID: 'A3', Status: 'Draft', woNumber: 'WO-13', Tanggal: daysAgo(12) },
                { LogID: 'A4', Status: 'Pending', woNumber: 'WO-14', Tanggal: daysAgo(13) },
            ],
            pmList: [
                // 4 overdue
                { taskName: 'PM-1', status: 'pending', date: daysAgo(5) },
                { taskName: 'PM-2', status: 'pending', date: daysAgo(6) },
                { taskName: 'PM-3', status: 'pending', date: daysAgo(7) },
                { taskName: 'PM-4', status: 'pending', date: daysAgo(8) },
                // 4 jatuh tempo H-3
                { taskName: 'PM-11', status: 'pending', date: daysAhead(1) },
                { taskName: 'PM-12', status: 'pending', date: daysAhead(2) },
                { taskName: 'PM-13', status: 'pending', date: daysAhead(3) },
                { taskName: 'PM-14', status: 'pending', date: daysAhead(3) },
            ],
            performanceData: [],
        };
    }

    beforeEach(() => {
        resetNotifBlocker();
        stubNotification('granted');
        stubServiceWorker();
        seedSemua();
    });

    it('setiap kategori > 3 item menyebut sisa item ("+N") di panel lonceng', () => {
        checkAllNotifications();

        const byType = (type) => window.app.notifications.filter((n) => n.type === type).map((n) => n.message);
        expect(byType('Low Stock').join(' | ')).toContain('+1');
        expect(byType('Work Order')[0]).toContain('+1');
        expect(byType('WO Aging')[0]).toContain('+1');
        expect(byType('PM Overdue')[0]).toContain('+1');
        expect(byType('PM Due Soon')[0]).toContain('+1');
        expect(byType('Lifetime Check')[0]).toContain('+1');
    });

    it('item tanpa NamaPart memakai PartID, WO tanpa nomor memakai N/A', () => {
        checkAllNotifications();

        const semua = window.app.notifications.map((n) => n.message).join(' | ');
        expect(semua).toContain('Z1');
        expect(semua).toContain('W1');
        expect(semua).toContain('N/A');
    });

    it('part dengan tanggal pemasangan rusak tidak dihitung lewat umur pakai', () => {
        checkAllNotifications();

        const lifetime = window.app.notifications.find((n) => n.type === 'Lifetime Check');
        expect(lifetime.message).not.toContain('Rusak');
    });
});
