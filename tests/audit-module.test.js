// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/audit.js` (kartu A, S24).
 *
 * Modul ini 0% karena mengimpor `db.js` (yang men-inisialisasi Firebase nyata).
 * Yang diuji di sini adalah logika yang berisiko — bukan Firebase-nya:
 *
 *  - bentuk entri audit (uid/email/role/page/details) & pemotongan 200 char
 *  - guard: audit dimatikan, belum login, `window.app` tidak ada
 *  - kegagalan tulis **tidak boleh** menjatuhkan aplikasi (PERMISSION_DENIED senyap)
 *  - `setupAuditHooks()` mem-patch login/logout sekali saja (idempoten)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
    db: { name: 'db' },
    ref: vi.fn((db, path) => ({ db, path })),
    set: vi.fn(async () => {}),
}));

vi.mock('../src/js/db.js', () => dbMock);

const { logAudit, setupAuditHooks, disableAudit, enableAudit } = await import('../src/js/modules/audit.js');

function makeApp(overrides = {}) {
    return {
        user: { uid: 'u1', email: 'teknisi@x.id' },
        userRole: 'technician',
        currentPage: 'workorders',
        ...overrides,
    };
}

beforeEach(() => {
    dbMock.ref.mockClear();
    dbMock.set.mockClear();
    dbMock.set.mockResolvedValue(undefined);
    enableAudit();
    delete window.app;
    delete window.appState;
    delete window.auditModule;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('logAudit — guard', () => {
    it('tidak menulis saat audit dimatikan', async () => {
        window.app = makeApp();
        disableAudit();
        await logAudit('Login');
        expect(dbMock.set).not.toHaveBeenCalled();
        enableAudit();
    });

    it('tidak menulis tanpa user login (window.app maupun window.appState)', async () => {
        await logAudit('Login');
        window.app = { user: null };
        await logAudit('Login');
        window.app = undefined;
        window.appState = { user: {} };
        await logAudit('Login');
        expect(dbMock.set).not.toHaveBeenCalled();
    });
});

describe('logAudit — bentuk entri', () => {
    it('menulis ke AuditTrail dengan uid/email/role/page + details objek sebagai JSON', async () => {
        window.app = makeApp();
        await logAudit('Create Equipment', { id: 'EQ-1', nama: 'Pompa' });

        expect(dbMock.set).toHaveBeenCalledTimes(1);
        const [refArg, entry] = dbMock.set.mock.calls[0];
        expect(refArg.path).toMatch(/^AuditTrail\/\d+_[a-z0-9]{4}$/);
        expect(entry).toMatchObject({
            uid: 'u1',
            email: 'teknisi@x.id',
            role: 'technician',
            action: 'Create Equipment',
            page: 'workorders',
        });
        expect(typeof entry.timestamp).toBe('number');
        expect(new Date(entry.date).toString()).not.toBe('Invalid Date');
        expect(JSON.parse(entry.details)).toEqual({ id: 'EQ-1', nama: 'Pompa' });
    });

    it('detail string dipakai apa adanya; fallback email/role/page', async () => {
        window.appState = makeApp({ user: { uid: 'u2' }, userRole: undefined, currentPage: undefined });
        await logAudit('Logout', 'sesi berakhir');

        const [, entry] = dbMock.set.mock.calls[0];
        expect(entry.details).toBe('sesi berakhir');
        expect(entry.email).toBe('unknown');
        expect(entry.role).toBe('user');
        expect(entry.page).toBe('-');
    });

    it('details dipotong di 200 karakter + elipsis', async () => {
        window.app = makeApp();
        await logAudit('Bulk', { blob: 'x'.repeat(500) });

        const [, entry] = dbMock.set.mock.calls[0];
        expect(entry.details).toHaveLength(201);
        expect(entry.details.endsWith('…')).toBe(true);
    });

    it('default details = {} → "{}"', async () => {
        window.app = makeApp();
        await logAudit('Ping');
        expect(dbMock.set.mock.calls[0][1].details).toBe('{}');
    });
});

describe('logAudit — kegagalan tidak boleh merusak aplikasi', () => {
    it('PERMISSION_DENIED ditelan tanpa console.warn', async () => {
        window.app = makeApp();
        dbMock.set.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' }));

        await expect(logAudit('Login')).resolves.toBeUndefined();
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('error lain hanya di-warn, tetap tidak melempar', async () => {
        window.app = makeApp();
        dbMock.set.mockRejectedValueOnce(new Error('network down'));

        await expect(logAudit('Login')).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalledWith('[Audit] Write failed:', 'network down');
    });
});

describe('setupAuditHooks', () => {
    it('tanpa window.app: tidak melakukan apa pun', () => {
        expect(() => setupAuditHooks()).not.toThrow();
        expect(window.auditModule).toBeUndefined();
    });

    it('mendaftarkan window.auditModule', () => {
        window.app = makeApp({ login: vi.fn(async () => 'ok'), logout: vi.fn(async () => 'bye') });
        setupAuditHooks();
        expect(window.auditModule).toMatchObject({ logAudit, setupAuditHooks });
    });

    it('login ter-patch sekali dan hanya menulis audit bila isLoggedIn', async () => {
        const login = vi.fn(async () => 'ok');
        const app = makeApp({ login, isLoggedIn: false });
        window.app = app;

        setupAuditHooks();
        setupAuditHooks(); // idempoten

        expect(app.__auditPatched).toBe(true);
        expect(await app.login()).toBe('ok');
        expect(login).toHaveBeenCalledTimes(1);
        expect(dbMock.set).not.toHaveBeenCalled();

        app.isLoggedIn = true;
        await app.login();
        expect(login).toHaveBeenCalledTimes(2);
        expect(dbMock.set).toHaveBeenCalledTimes(1);
        expect(dbMock.set.mock.calls[0][1].action).toBe('Login');
    });

    it('logout ter-patch: audit ditulis SEBELUM signOut, email ikut', async () => {
        const logout = vi.fn(async () => 'bye');
        const app = makeApp({ logout });
        window.app = app;

        setupAuditHooks();
        await app.logout();

        expect(logout).toHaveBeenCalledTimes(1);
        expect(dbMock.set).toHaveBeenCalledTimes(1);
        const entry = dbMock.set.mock.calls[0][1];
        expect(entry.action).toBe('Logout');
        expect(JSON.parse(entry.details)).toEqual({ email: 'teknisi@x.id' });
    });

    it('tanpa app.logout: memakai app.signOut sebagai sumber', async () => {
        const signOut = vi.fn(async () => 'bye');
        const app = makeApp({ signOut });
        window.app = app;

        setupAuditHooks();
        await app.logout();
        expect(signOut).toHaveBeenCalledTimes(1);
        expect(dbMock.set).toHaveBeenCalledTimes(1);
    });

    it('tidak menimpa window.auditModule yang sudah ada', () => {
        window.app = makeApp({ login: vi.fn(), logout: vi.fn() });
        window.auditModule = { custom: true };
        setupAuditHooks();
        expect(window.auditModule).toEqual({ custom: true });
    });
});
