// @vitest-environment jsdom
/**
 * Unit tests untuk `src/js/modules/auth.js` (kartu A, S24).
 *
 * Kenapa berkas ini prioritas: `auth.js` adalah jalur login/role/`isAdmin` —
 * berkas yang melahirkan bug P0 privilege escalation (role dulu dipetakan dari
 * email hardcoded, lalu `ensureUserProfile()` sempat self-write `role`).
 * Dua invarian itu yang dikunci di sini:
 *
 *  1. `ensureUserProfile()` **tidak pernah** menulis `role` (profil baru dibuat
 *     tanpa field `role`; profil lama hanya menyinkronkan email + lastLogin).
 *  2. Setiap jalur tulis-admin dijaga `this.isAdmin` sebelum menyentuh RTDB.
 *
 * Modul memakai `window.ref/db/get/...` (bukan import), jadi cukup
 * `vi.stubGlobal` — tidak perlu mock Firebase SDK.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authModule } from '../src/js/modules/auth.js';
// Kartu t_505ab09a: `GoogleAuthProvider` + `signInWithPopup` di-load secara
// dinamis lewat `import('firebase/auth')` di `loginWithSSO` — SDK Google tidak
// lagi menempel di chunk boot. Mock modul (bukan window) membuktikan jalur
// dynamic import benar-benar dipakai, bukan stub global.
vi.mock('firebase/auth', () => ssoMock);
// App sekunder untuk `createUser` — `firebase/app` di-mock supaya tes tidak
// perlu SDK asli dan bisa memeriksa app mana yang dipakai.
const appMock = vi.hoisted(() => ({
    initializeApp: vi.fn((options, name) => ({ name, options })),
    getApps: vi.fn(() => []),
    deleteApp: vi.fn(async () => {}),
}));
vi.mock('firebase/app', () => appMock);
// Satu referensi objek yang sama untuk factory mock & tes: mutasi di tes
// (mis. menonaktifkan provider) terlihat oleh `import('firebase/auth')`
// di dalam auth.js.
const ssoMock = vi.hoisted(() => ({
    GoogleAuthProvider: class {},
    signInWithPopup: vi.fn(),
    // `createUser` membuat akun di app Firebase SEKUNDER supaya sesi admin tidak
    // tergeser (lihat auth.js). `getAuth`/`signOut` diambil dari dynamic import
    // `firebase/auth`, jadi keduanya harus ada di mock yang sama.
    getAuth: vi.fn((app) => ({ kind: 'secondary-auth', app })),
    signOut: vi.fn(async () => {}),
    // Resolver WAJIB diberikan eksplisit di jalur SSO: `auth` dibuat lewat
    // `initializeAuth` tanpa resolver supaya iframe `__/auth/iframe` tidak
    // dimuat di layar login (lihat db.js).
    browserPopupRedirectResolver: { name: 'browserPopupRedirectResolver' },
}));
function stubFirebase(overrides = {}) {
    const fns = {
        db: { name: 'db' },
        auth: { name: 'auth' },
        firebaseConfig: { projectId: 'demo-mtc-asset' },
        browserSessionPersistence: 'session',
        browserLocalPersistence: 'local',
        ref: vi.fn((db, path) => ({ path })),
        get: vi.fn(async () => ({ exists: () => false, val: () => null })),
        update: vi.fn(async () => {}),
        set: vi.fn(async () => {}),
        remove: vi.fn(async () => {}),
        setPersistence: vi.fn(async () => {}),
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn(async () => {}),
        createUserWithEmailAndPassword: vi.fn(),
        sendPasswordResetEmail: vi.fn(async () => {}),
        ...overrides,
    };
    for (const [key, value] of Object.entries(fns)) vi.stubGlobal(key, value);
    return fns;
}

function makeCtx(overrides = {}) {
    const ctx = Object.create(authModule);
    ctx.loginForm = { email: '', password: '' };
    ctx.isLoading = false;
    ctx.isLoggedIn = false;
    ctx.user = null;
    ctx.userRole = 'user';
    ctx.isAdmin = false;
    ctx.allUsers = [];
    ctx.newUserForm = { email: '', password: '', role: 'user', phone: '' };
    ctx.editUserForm = { uid: '', email: '', role: 'user', phone: '' };
    ctx.showCreateUserModal = false;
    ctx.showEditUserModal = false;
    ctx.showNotification = vi.fn();
    return Object.assign(ctx, overrides);
}

const snap = (value) => ({ exists: () => value !== null && value !== undefined, val: () => value });

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ssoMock.GoogleAuthProvider = class {};
    ssoMock.signInWithPopup.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ensureUserProfile — invarian P0 (role tidak pernah ditulis sendiri)', () => {
    it('tidak menyentuh RTDB tanpa uid', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx();
        expect(await ctx.ensureUserProfile(null)).toBeUndefined();
        expect(await ctx.ensureUserProfile({})).toBeUndefined();
        expect(fb.get).not.toHaveBeenCalled();
    });

    it('profil lama: hanya email + lastLogin yang di-update, role dipertahankan', async () => {
        const existing = { uid: 'u1', email: 'old@x.id', role: 'admin', createdAt: '2026-01-01' };
        const fb = stubFirebase({ get: vi.fn(async () => snap(existing)) });
        const ctx = makeCtx();

        const merged = await ctx.ensureUserProfile({ uid: 'u1', email: 'new@x.id' });

        expect(fb.ref).toHaveBeenCalledWith(fb.db, 'Users/u1');
        expect(fb.update).toHaveBeenCalledTimes(1);
        const [refArg, updates] = fb.update.mock.calls[0];
        expect(refArg).toEqual({ path: 'Users/u1' });
        expect(Object.keys(updates).sort()).toEqual(['email', 'lastLogin']);
        expect(updates.role).toBeUndefined();
        expect(updates.email).toBe('new@x.id');
        expect(typeof updates.lastLogin).toBe('string');
        expect(merged.role).toBe('admin');
        expect(fb.set).not.toHaveBeenCalled();
    });

    it('profil lama tanpa email user: pakai email lama', async () => {
        const fb = stubFirebase({ get: vi.fn(async () => snap({ uid: 'u1', email: 'keep@x.id', role: 'user' })) });
        const ctx = makeCtx();
        await ctx.ensureUserProfile({ uid: 'u1' });
        expect(fb.update.mock.calls[0][1].email).toBe('keep@x.id');
    });

    it('profil baru: dibuat TANPA field role, dibaca balik dengan default user', async () => {
        const fb = stubFirebase({ get: vi.fn(async () => snap(null)) });
        const ctx = makeCtx({ userRole: 'user' });

        const created = await ctx.ensureUserProfile({ uid: 'u2', email: 'baru@x.id' });

        expect(fb.set).toHaveBeenCalledTimes(1);
        const [, payload] = fb.set.mock.calls[0];
        expect(payload.role).toBeUndefined();
        expect(payload).toMatchObject({ uid: 'u2', email: 'baru@x.id' });
        expect(typeof payload.createdAt).toBe('string');
        expect(fb.update).not.toHaveBeenCalled();
        expect(created.role).toBeUndefined();
    });

    it('kegagalan RTDB ditelan → null (login tidak ikut rusak)', async () => {
        stubFirebase({ get: vi.fn(async () => { throw new Error('permission_denied'); }) });
        const ctx = makeCtx();
        expect(await ctx.ensureUserProfile({ uid: 'u3', email: 'a@b.c' })).toBeNull();
    });
});

describe('login', () => {
    it('form kosong: notifikasi error, tidak menyentuh Firebase', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ loginForm: { email: '', password: 'x' } });
        await ctx.login();
        expect(ctx.showNotification).toHaveBeenCalledWith('Please enter email and password', 'error');
        expect(fb.signInWithEmailAndPassword).not.toHaveBeenCalled();
        expect(ctx.isLoading).toBe(false);
    });

    it('sukses: persistence sesi, role dari profil RTDB, welcome', async () => {
        const fb = stubFirebase({
            get: vi.fn(async () => snap({ uid: 'u1', email: 'a@b.c', role: 'planner' })),
            signInWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'u1', email: 'a@b.c' } })),
        });
        const ctx = makeCtx({ loginForm: { email: 'a@b.c', password: 'rahasia' } });

        await ctx.login();

        expect(fb.setPersistence).toHaveBeenCalledWith(fb.auth, fb.browserSessionPersistence);
        expect(fb.signInWithEmailAndPassword).toHaveBeenCalledWith(fb.auth, 'a@b.c', 'rahasia');
        expect(ctx.userRole).toBe('planner');
        expect(ctx.showNotification).toHaveBeenCalledWith('Welcome back!');
        expect(ctx.isLoading).toBe(false);
    });

    it('centang "simpan sesi" memakai local persistence, bukan session', async () => {
        const fb = stubFirebase({
            get: vi.fn(async () => snap({ uid: 'u1', email: 'a@b.c', role: 'planner' })),
            signInWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'u1', email: 'a@b.c' } })),
        });
        const ctx = makeCtx({ loginForm: { email: 'a@b.c', password: 'rahasia', keepSession: true } });

        await ctx.login();

        expect(fb.setPersistence).toHaveBeenCalledWith(fb.auth, fb.browserLocalPersistence);
        expect(ctx.isLoading).toBe(false);
    });

    it('profil baru tanpa role: jatuh ke "user", bukan admin', async () => {
        stubFirebase({
            get: vi.fn(async () => snap(null)),
            signInWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'u9', email: 'n@b.c' } })),
        });
        const ctx = makeCtx({ loginForm: { email: 'n@b.c', password: 'p' }, userRole: 'admin' });
        await ctx.login();
        expect(ctx.userRole).toBe('user');
    });

    it('gagal auth: pesan error diteruskan, isLoading tetap direset', async () => {
        stubFirebase({
            signInWithEmailAndPassword: vi.fn(async () => { throw new Error('auth/wrong-password'); }),
        });
        const ctx = makeCtx({ loginForm: { email: 'a@b.c', password: 'salah' } });
        await ctx.login();
        expect(ctx.showNotification).toHaveBeenCalledWith('Login failed: auth/wrong-password', 'error');
        expect(ctx.isLoading).toBe(false);
    });
});

describe('logout', () => {
    it('dibatalkan user: tidak signOut', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => false));
        const ctx = makeCtx({ isLoggedIn: true });
        await ctx.logout();
        expect(fb.signOut).not.toHaveBeenCalled();
        expect(ctx.isLoggedIn).toBe(true);
    });

    it('sukses: state login direset penuh', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => true));
        const ctx = makeCtx({ isLoggedIn: true, user: { uid: 'u1' }, userRole: 'admin' });
        await ctx.logout();
        expect(fb.signOut).toHaveBeenCalledWith(fb.auth);
        expect(ctx.isLoggedIn).toBe(false);
        expect(ctx.user).toBeNull();
        expect(ctx.userRole).toBe('user');
        expect(ctx.showNotification).toHaveBeenCalledWith('Logged out successfully', 'info');
    });

    it('signOut gagal: notifikasi error, isLoading direset', async () => {
        stubFirebase({ signOut: vi.fn(async () => { throw new Error('network'); }) });
        vi.stubGlobal('confirm', vi.fn(() => true));
        const ctx = makeCtx({ isLoggedIn: true });
        await ctx.logout();
        expect(ctx.showNotification).toHaveBeenCalledWith('Error logging out: network', 'error');
        expect(ctx.isLoading).toBe(false);
    });
});

describe('showUID', () => {
    it('menampilkan UID lewat prompt hanya saat ada user', () => {
        const promptFn = vi.fn();
        vi.stubGlobal('prompt', promptFn);
        makeCtx().showUID();
        expect(promptFn).not.toHaveBeenCalled();
        makeCtx({ user: { uid: 'abc123' } }).showUID();
        expect(promptFn).toHaveBeenCalledWith('Copy your UID below:', 'abc123');
    });
});

describe('getUserRole', () => {
    it('tanpa uid → user', async () => {
        const fb = stubFirebase();
        expect(await makeCtx().getUserRole('')).toBe('user');
        expect(fb.get).not.toHaveBeenCalled();
    });

    it('role dari RTDB', async () => {
        const fb = stubFirebase({ get: vi.fn(async () => snap('admin')) });
        expect(await makeCtx().getUserRole('u1')).toBe('admin');
        expect(fb.ref).toHaveBeenCalledWith(fb.db, 'Users/u1/role');
    });

    it('role kosong / gagal baca → user', async () => {
        stubFirebase({ get: vi.fn(async () => snap(null)) });
        expect(await makeCtx().getUserRole('u1')).toBe('user');

        stubFirebase({ get: vi.fn(async () => { throw new Error('offline'); }) });
        expect(await makeCtx().getUserRole('u2')).toBe('user');
    });
});

describe('createUser — guard admin', () => {
    it('email/password kosong: ditolak sebelum cek admin', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ isAdmin: true });
        expect(await ctx.createUser('', '')).toEqual({ success: false, message: 'Email and password required' });
        expect(fb.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('bukan admin: tidak membuat user di Firebase', async () => {
        const fb = stubFirebase();
        const ctx = makeCtx({ isAdmin: false });
        const res = await ctx.createUser('a@b.c', 'p', 'admin');
        expect(res).toEqual({ success: false, message: 'Admin only' });
        expect(fb.createUserWithEmailAndPassword).not.toHaveBeenCalled();
        expect(fb.set).not.toHaveBeenCalled();
    });

    it('admin: user dibuat + profil RTDB memuat role & createdBy', async () => {
        const fb = stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'baru' } })),
        });
        const ctx = makeCtx({ isAdmin: true, user: { email: 'admin@x.id' } });

        const res = await ctx.createUser('teknisi@x.id', 'pw', 'technician');

        expect(res.success).toBe(true);
        expect(res.user.uid).toBe('baru');
        const [refArg, payload] = fb.set.mock.calls[0];
        expect(refArg).toEqual({ path: 'Users/baru' });
        expect(payload).toMatchObject({
            uid: 'baru',
            email: 'teknisi@x.id',
            role: 'technician',
            createdBy: 'admin@x.id',
        });
        expect(ctx.isLoading).toBe(false);
    });

    it('admin tanpa user login: createdBy fallback "admin"', async () => {
        const fb = stubFirebase({ createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'x' } })) });
        await makeCtx({ isAdmin: true, user: null }).createUser('a@b.c', 'p');
        expect(fb.set.mock.calls[0][1]).toMatchObject({ role: 'user', createdBy: 'admin' });
    });

    it('Firebase error: pesan diteruskan, isLoading direset', async () => {
        stubFirebase({ createUserWithEmailAndPassword: vi.fn(async () => { throw new Error('email-in-use'); }) });
        const ctx = makeCtx({ isAdmin: true });
        const res = await ctx.createUser('a@b.c', 'p');
        expect(res).toEqual({ success: false, message: 'email-in-use' });
        expect(ctx.showNotification).toHaveBeenCalledWith('Failed to create user: email-in-use', 'error');
        expect(ctx.isLoading).toBe(false);
    });
});

describe('modal create user', () => {
    it('open mereset form, close membersihkan form + flag', () => {
        const ctx = makeCtx({ newUserForm: { email: 'x', password: 'y', role: 'admin' } });
        ctx.openCreateUserModal();
        expect(ctx.showCreateUserModal).toBe(true);
        expect(ctx.newUserForm).toEqual({ email: '', password: '', role: 'user', phone: '' });

        ctx.showCreateUserModal = true;
        ctx.newUserForm = { email: 'a', password: 'b', role: 'admin' };
        ctx.closeCreateUserModal();
        expect(ctx.showCreateUserModal).toBe(false);
        expect(ctx.newUserForm).toEqual({ email: '', password: '', role: 'user', phone: '' });
    });

    it('submit sukses menutup modal, gagal membiarkannya terbuka', async () => {
        const ctx = makeCtx({ isAdmin: true });
        ctx.createUser = vi.fn(async () => ({ success: true }));
        ctx.closeCreateUserModal = vi.fn();
        ctx.newUserForm = { email: 'a@b.c', password: 'p', role: 'user', phone: '' };

        await ctx.submitCreateUser();
        expect(ctx.createUser).toHaveBeenCalledWith('a@b.c', 'p', 'user', '');
        expect(ctx.closeCreateUserModal).toHaveBeenCalled();

        ctx.createUser = vi.fn(async () => ({ success: false, message: 'nope' }));
        ctx.closeCreateUserModal.mockClear();
        await ctx.submitCreateUser();
        expect(ctx.closeCreateUserModal).not.toHaveBeenCalled();
    });
});

describe('edit user', () => {
    it('open/close memindahkan data user ke form', () => {
        const ctx = makeCtx();
        ctx.openEditUser({ uid: 'u1', email: 'a@b.c', role: 'admin' });
        expect(ctx.showEditUserModal).toBe(true);
        expect(ctx.editUserForm).toEqual({ uid: 'u1', email: 'a@b.c', role: 'admin', phone: '' });

        ctx.openEditUser({ uid: 'u2', email: 'c@d.e' });
        expect(ctx.editUserForm.role).toBe('user');

        ctx.closeEditUserModal();
        expect(ctx.showEditUserModal).toBe(false);
        expect(ctx.editUserForm).toEqual({ uid: '', email: '', role: 'user', phone: '' });
    });

    it('guard: bukan admin / uid kosong / email kosong → tidak menulis', async () => {
        const fb = stubFirebase();
        const notAdmin = makeCtx({ isAdmin: false, editUserForm: { uid: 'u1', email: 'a@b.c', role: 'admin' } });
        await notAdmin.saveEditUser();

        const noUid = makeCtx({ isAdmin: true, editUserForm: { uid: '', email: 'a@b.c', role: 'user' } });
        await noUid.saveEditUser();

        const blankEmail = makeCtx({ isAdmin: true, editUserForm: { uid: 'u1', email: '   ', role: 'user' } });
        await blankEmail.saveEditUser();

        expect(fb.set).not.toHaveBeenCalled();
    });

    it('admin: merge profil lama + update entri allUsers', async () => {
        const fb = stubFirebase({ get: vi.fn(async () => snap({ uid: 'u1', createdAt: '2026-01-01', role: 'user' })) });
        const ctx = makeCtx({
            isAdmin: true,
            allUsers: [
                { uid: 'u1', email: 'lama@x.id', role: 'user' },
                { uid: 'u2', email: 'lain@x.id', role: 'user' },
            ],
            editUserForm: { uid: 'u1', email: '  baru@x.id  ', role: 'admin' },
        });
        ctx.closeEditUserModal = vi.fn();

        await ctx.saveEditUser();

        const [refArg, payload] = fb.set.mock.calls[0];
        expect(refArg).toEqual({ path: 'Users/u1' });
        expect(payload).toMatchObject({ createdAt: '2026-01-01', email: 'baru@x.id', role: 'admin' });
        expect(ctx.allUsers[0]).toMatchObject({ email: 'baru@x.id', role: 'admin' });
        expect(ctx.allUsers[1].email).toBe('lain@x.id');
        expect(ctx.closeEditUserModal).toHaveBeenCalled();
        expect(ctx.showNotification).toHaveBeenCalledWith('User updated successfully');
    });

    it('uid tidak ada di allUsers: tetap tersimpan tanpa crash', async () => {
        stubFirebase({ get: vi.fn(async () => snap(null)) });
        const ctx = makeCtx({ isAdmin: true, allUsers: [], editUserForm: { uid: 'ghost', email: 'a@b.c', role: 'user' } });
        await ctx.saveEditUser();
        expect(ctx.allUsers).toEqual([]);
        expect(ctx.showNotification).toHaveBeenCalledWith('User updated successfully');
    });

    it('gagal tulis: notifikasi error, modal tidak ditutup', async () => {
        stubFirebase({ set: vi.fn(async () => { throw new Error('denied'); }) });
        const ctx = makeCtx({ isAdmin: true, editUserForm: { uid: 'u1', email: 'a@b.c', role: 'user' } });
        ctx.closeEditUserModal = vi.fn();
        await ctx.saveEditUser();
        expect(ctx.showNotification).toHaveBeenCalledWith('Failed to update user', 'error');
        expect(ctx.closeEditUserModal).not.toHaveBeenCalled();
        expect(ctx.isLoading).toBe(false);
    });
});

describe('sendPasswordReset', () => {
    it('user tidak dikenal / tanpa email → tidak mengirim', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => true));
        await makeCtx({ allUsers: [{ uid: 'u1' }] }).sendPasswordReset('u1');
        await makeCtx({ allUsers: [] }).sendPasswordReset('nope');
        expect(fb.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('dibatalkan user → tidak mengirim', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => false));
        await makeCtx({ allUsers: [{ uid: 'u1', email: 'a@b.c' }] }).sendPasswordReset('u1');
        expect(fb.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('sukses & gagal masing-masing memberi notifikasi', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => true));
        const ctx = makeCtx({ allUsers: [{ uid: 'u1', email: 'a@b.c' }] });

        await ctx.sendPasswordReset('u1');
        expect(fb.sendPasswordResetEmail).toHaveBeenCalledWith(fb.auth, 'a@b.c');
        expect(ctx.showNotification).toHaveBeenCalledWith('Reset email sent to a@b.c');

        fb.sendPasswordResetEmail.mockRejectedValueOnce(new Error('quota'));
        await ctx.sendPasswordReset('u1');
        expect(ctx.showNotification).toHaveBeenCalledWith('Failed to send reset email', 'error');
    });
});

describe('loadAllUsers', () => {
    it('bukan admin / db tidak ada → tidak membaca', async () => {
        const fb = stubFirebase();
        await makeCtx({ isAdmin: false }).loadAllUsers();
        expect(fb.get).not.toHaveBeenCalled();

        vi.stubGlobal('db', undefined);
        await makeCtx({ isAdmin: true }).loadAllUsers();
        expect(fb.get).not.toHaveBeenCalled();
    });

    it('snapshot kosong: allUsers tidak berubah, isLoading direset', async () => {
        stubFirebase({ get: vi.fn(async () => snap(null)) });
        const ctx = makeCtx({ isAdmin: true, allUsers: [{ uid: 'x' }] });
        await ctx.loadAllUsers();
        expect(ctx.allUsers).toEqual([{ uid: 'x' }]);
        expect(ctx.isLoading).toBe(false);
    });

    it('memetakan uid + data dan mengurutkan createdAt terbaru dulu', async () => {
        const users = {
            a: { email: 'a@x.id', createdAt: '2026-01-01' },
            b: { email: 'b@x.id', createdAt: '2026-03-01' },
            c: { email: 'c@x.id' },
        };
        stubFirebase({ get: vi.fn(async () => snap(users)) });
        const ctx = makeCtx({ isAdmin: true });
        await ctx.loadAllUsers();
        expect(ctx.allUsers.map((u) => u.uid)).toEqual(['b', 'a', 'c']);
        expect(ctx.allUsers[0]).toMatchObject({ uid: 'b', email: 'b@x.id' });
    });

    it('gagal baca: ditelan, isLoading direset', async () => {
        stubFirebase({ get: vi.fn(async () => { throw new Error('denied'); }) });
        const ctx = makeCtx({ isAdmin: true });
        await ctx.loadAllUsers();
        expect(ctx.isLoading).toBe(false);
        expect(console.error).toHaveBeenCalled();
    });
});

describe('deleteUser', () => {
    it('guard: bukan admin / uid kosong / dibatalkan → tidak menghapus', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => true));
        await makeCtx({ isAdmin: false }).deleteUser('u1');
        await makeCtx({ isAdmin: true }).deleteUser('');
        vi.stubGlobal('confirm', vi.fn(() => false));
        await makeCtx({ isAdmin: true }).deleteUser('u1');
        expect(fb.remove).not.toHaveBeenCalled();
    });

    it('admin: hapus node + buang dari allUsers', async () => {
        const fb = stubFirebase();
        vi.stubGlobal('confirm', vi.fn(() => true));
        const ctx = makeCtx({
            isAdmin: true,
            allUsers: [{ uid: 'u1' }, { uid: 'u2' }],
        });

        await ctx.deleteUser('u1');

        expect(fb.remove).toHaveBeenCalledWith({ path: 'Users/u1' });
        expect(ctx.allUsers).toEqual([{ uid: 'u2' }]);
        expect(ctx.showNotification).toHaveBeenCalledWith('User deleted successfully');
        expect(ctx.isLoading).toBe(false);
    });

    it('gagal hapus: notifikasi error, allUsers utuh', async () => {
        stubFirebase({ remove: vi.fn(async () => { throw new Error('denied'); }) });
        vi.stubGlobal('confirm', vi.fn(() => true));
        const ctx = makeCtx({ isAdmin: true, allUsers: [{ uid: 'u1' }] });
        await ctx.deleteUser('u1');
        expect(ctx.showNotification).toHaveBeenCalledWith('Failed to delete user', 'error');
        expect(ctx.allUsers).toEqual([{ uid: 'u1' }]);
    });
});

// ───────────────────────────────────────────────────────────────────────────
// S30 — mode akses login: PIN (kiosk cepat) + SSO Google.
// `loginMode` cuma UI state; jalur kredensial tetap Firebase Auth. Yang dikunci
// di sini: PIN tidak pernah menebak email, SSO tidak menaikkan role.
// ───────────────────────────────────────────────────────────────────────────

describe('login — mode akses (email / pin / sso)', () => {
    beforeEach(() => {
        // `mtc_last_login_email` bocor antar-tes kalau tidak dibersihkan.
        localStorage.removeItem('mtc_last_login_email');
    });

    it('setLoginMode menolak mode tak dikenal', () => {
        const ctx = makeCtx({ loginMode: 'email' });
        ctx.setLoginMode('magic');
        expect(ctx.loginMode).toBe('email');
    });

    it('setLoginMode("pin") tanpa email tersimpan: peringatan, tetap di email', () => {
        const ctx = makeCtx({ loginMode: 'email' });
        ctx.setLoginMode('pin');
        expect(ctx.loginMode).toBe('email');
        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Mode PIN butuh satu kali login email di perangkat ini dulu',
            'warning'
        );
    });

    it('setLoginMode("pin") dengan email tersimpan: pindah + isi rememberedEmail', () => {
        localStorage.setItem('mtc_last_login_email', 'op@plant.id');
        const ctx = makeCtx({ loginMode: 'email' });
        ctx.setLoginMode('pin');
        expect(ctx.loginMode).toBe('pin');
        expect(ctx.rememberedEmail).toBe('op@plant.id');
    });

    it('setLoginMode("sso") langsung pindah', () => {
        const ctx = makeCtx({ loginMode: 'email' });
        ctx.setLoginMode('sso');
        expect(ctx.loginMode).toBe('sso');
    });

    it('submitLogin meneruskan ke jalur sesuai mode', async () => {
        const ctx = makeCtx({ loginMode: 'pin' });
        ctx.loginWithPin = vi.fn(async () => {});
        ctx.login = vi.fn(async () => {});
        ctx.loginWithSSO = vi.fn(async () => {});

        await ctx.submitLogin();
        expect(ctx.loginWithPin).toHaveBeenCalledTimes(1);

        ctx.loginMode = 'sso';
        await ctx.submitLogin();
        expect(ctx.loginWithSSO).toHaveBeenCalledTimes(1);

        ctx.loginMode = 'email';
        await ctx.submitLogin();
        expect(ctx.login).toHaveBeenCalledTimes(1);
    });

    it('loginWithPin tanpa email tersimpan: error dan balik ke mode email', async () => {
        const ctx = makeCtx({ loginMode: 'pin', loginForm: { pin: '1234' } });
        await ctx.loginWithPin();
        expect(ctx.showNotification).toHaveBeenCalledWith(
            'Email operator belum tersimpan di perangkat ini',
            'error'
        );
        expect(ctx.loginMode).toBe('email');
    });

    it('loginWithPin menolak PIN yang bukan 4–6 digit', async () => {
        localStorage.setItem('mtc_last_login_email', 'op@plant.id');
        const ctx = makeCtx({ loginMode: 'pin', rememberedEmail: 'op@plant.id', loginForm: { pin: '12' } });
        ctx.login = vi.fn(async () => {});
        await ctx.loginWithPin();
        expect(ctx.showNotification).toHaveBeenCalledWith('PIN harus 4–6 digit angka', 'error');
        expect(ctx.login).not.toHaveBeenCalled();
    });

    it('loginWithPin memakai email tersimpan + PIN sebagai password', async () => {
        const ctx = makeCtx({ loginMode: 'pin', rememberedEmail: 'op@plant.id', loginForm: { pin: '8492' } });
        ctx.login = vi.fn(async () => {});
        await ctx.loginWithPin();
        expect(ctx.loginForm.email).toBe('op@plant.id');
        expect(ctx.loginForm.password).toBe('8492');
        expect(ctx.login).toHaveBeenCalledTimes(1);
    });

    it('login() yang sukses mengingat email untuk mode PIN', async () => {
        stubFirebase({
            get: vi.fn(async () => snap({ uid: 'u1', email: 'op@plant.id', role: 'planner' })),
            signInWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'u1', email: 'op@plant.id' } })),
        });
        const ctx = makeCtx({ loginForm: { email: 'op@plant.id', password: 'rahasia' } });
        await ctx.login();
        expect(localStorage.getItem('mtc_last_login_email')).toBe('op@plant.id');
        expect(ctx.rememberedEmail).toBe('op@plant.id');
    });

    it('rememberLogin mengabaikan email kosong', () => {
        const ctx = makeCtx();
        ctx.rememberLogin('');
        expect(localStorage.getItem('mtc_last_login_email')).toBeNull();
    });

    it('loginWithSSO tanpa provider terpasang: notifikasi, bukan crash', async () => {
        ssoMock.GoogleAuthProvider = undefined;
        const ctx = makeCtx({ loginMode: 'sso' });
        await ctx.loginWithSSO();
        expect(ctx.showNotification).toHaveBeenCalledWith('SSO belum tersedia di build ini', 'error');
        expect(ctx.isLoading).toBe(false);
    });

    it('loginWithSSO sukses: role dari RTDB, email diingat, welcome', async () => {
        ssoMock.signInWithPopup.mockResolvedValueOnce({ user: { uid: 'g1', email: 'op@plant.id' } });
        const fb = stubFirebase({ get: vi.fn(async () => snap({ uid: 'g1', email: 'op@plant.id', role: 'supervisor' })) });

        const ctx = makeCtx({ loginMode: 'sso' });
        await ctx.loginWithSSO();

        expect(ssoMock.GoogleAuthProvider).toBeDefined();
        // Instance auth HARUS dari jembatan window (sama seperti login email),
        // bukan `this.auth` — AppState tidak punya field `auth`.
        // Argumen ketiga = resolver nyata: tanpa itu `initializeAuth` tidak punya
        // resolver dan popup akan gagal dengan auth/argument-error.
        expect(ssoMock.signInWithPopup).toHaveBeenCalledWith(
            fb.auth,
            expect.any(ssoMock.GoogleAuthProvider),
            ssoMock.browserPopupRedirectResolver,
        );
        expect(ctx.userRole).toBe('supervisor');
        expect(localStorage.getItem('mtc_last_login_email')).toBe('op@plant.id');
        expect(ctx.showNotification).toHaveBeenCalledWith('Welcome back!');
        expect(ctx.isLoading).toBe(false);
    });

    it('loginWithSSO gagal: pesan Firebase diteruskan apa adanya', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        ssoMock.signInWithPopup.mockRejectedValueOnce(new Error('auth/operation-not-allowed'));

        const ctx = makeCtx({ loginMode: 'sso' });
        await ctx.loginWithSSO();

        expect(ctx.showNotification).toHaveBeenCalledWith(
            'SSO gagal: auth/operation-not-allowed',
            'error'
        );
        expect(ctx.isLoading).toBe(false);
    });

    it('loginWithSSO tidak menumpuk saat sudah loading', async () => {
        const ctx = makeCtx({ loginMode: 'sso', isLoading: true });
        await ctx.loginWithSSO();
        expect(ssoMock.signInWithPopup).not.toHaveBeenCalled();
    });
});

// Kartu t_2af5fb60: tanpa prefetch ini chunk `app-*.js` (57,7 KiB gzip) dan
// lapisan data (38,5 KiB) baru diminta SETELAH auth selesai — keduanya
// berurutan di jalur kritis. Diukur di emulator (slow-4G + CPU x4):
// submit -> gate terbuka 648 ms -> 334 ms.
describe('submitLogin — prefetch pasca-auth', () => {
    afterEach(() => {
        delete window.__loadDataLayer;
        delete window.__loadApp;
    });

    it('memulai pemuatan lapisan data + chunk app tanpa menunggunya', async () => {
        const loadData = vi.fn(() => Promise.resolve({}));
        const loadApp = vi.fn(() => Promise.resolve({}));
        window.__loadDataLayer = loadData;
        window.__loadApp = loadApp;

        const ctx = Object.create(authModule);
        ctx.loginMode = 'email';
        ctx.login = vi.fn(async () => 'ok');

        await ctx.submitLogin();

        expect(loadData).toHaveBeenCalledTimes(1);
        expect(loadApp).toHaveBeenCalledTimes(1);
        // Jalur login tetap dijalankan — prefetch tidak menggantikannya.
        expect(ctx.login).toHaveBeenCalledTimes(1);
    });

    it('tidak meledak kalau loader belum terpasang (unit test jsdom)', async () => {
        const ctx = Object.create(authModule);
        ctx.loginMode = 'email';
        ctx.login = vi.fn(async () => {});

        await expect(ctx.submitLogin()).resolves.toBeUndefined();
    });

    it('prefetch yang gagal tidak menjatuhkan login', async () => {
        window.__loadDataLayer = vi.fn(() => Promise.reject(new Error('offline')));
        window.__loadApp = vi.fn(() => Promise.reject(new Error('offline')));

        const ctx = Object.create(authModule);
        ctx.loginMode = 'email';
        ctx.login = vi.fn(async () => 'ok');

        await expect(ctx.submitLogin()).resolves.toBe('ok');
        expect(ctx.login).toHaveBeenCalledTimes(1);
    });
});

/**
 * `createUser` dulu memanggil `createUserWithEmailAndPassword(window.auth, ...)`.
 * Panggilan itu MENGGESER currentUser ke akun baru, sehingga penulisan
 * `Users/<uid>` dilakukan oleh akun baru (role belum ada) dan ditolak rule
 * `Users/$uid/role.validate` — hasilnya akun Auth yatim tanpa profil, lalu
 * percobaan berikutnya gagal `auth/email-already-in-use`. Tes di bawah mengunci
 * bentuk yang benar: akun dibuat di app sekunder, profil ditulis oleh admin.
 */
describe('createUser — akun dibuat di app sekunder (sesi admin tidak tergeser)', () => {
    beforeEach(() => {
        appMock.initializeApp.mockClear();
        appMock.getApps.mockReset().mockReturnValue([]);
        appMock.deleteApp.mockReset().mockResolvedValue(undefined);
        ssoMock.getAuth.mockClear();
        ssoMock.signOut.mockReset().mockResolvedValue(undefined);
    });

    it('createUserWithEmailAndPassword dipanggil dengan auth app sekunder, bukan window.auth', async () => {
        const fb = stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'baru' } })),
        });
        const ctx = makeCtx({ isAdmin: true, user: { email: 'admin@x.id' } });

        await ctx.createUser('teknisi@x.id', 'pw', 'user');

        const authArg = fb.createUserWithEmailAndPassword.mock.calls[0][0];
        expect(authArg).not.toBe(fb.auth);
        expect(authArg.kind).toBe('secondary-auth');
        expect(appMock.initializeApp).toHaveBeenCalledTimes(1);
        // Sesi admin di app utama tidak boleh di-signOut.
        expect(fb.signOut).not.toHaveBeenCalled();
    });

    it('app sekunder dihapus setelah selesai', async () => {
        stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'baru' } })),
        });
        await makeCtx({ isAdmin: true, user: { email: 'admin@x.id' } }).createUser('a@b.c', 'pw');
        expect(appMock.deleteApp).toHaveBeenCalledTimes(1);
    });

    it('email-already-in-use + password cocok: uid lama diadopsi, profil ditulis', async () => {
        const fb = stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => {
                throw Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' });
            }),
            signInWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'lama' } })),
        });
        const ctx = makeCtx({ isAdmin: true, user: { email: 'admin@x.id' } });

        const res = await ctx.createUser('teknisi@x.id', 'pw', 'supervisor');

        expect(res.success).toBe(true);
        expect(res.user.uid).toBe('lama');
        expect(fb.set.mock.calls[0][0]).toEqual({ path: 'Users/lama' });
        expect(fb.set.mock.calls[0][1]).toMatchObject({ uid: 'lama', role: 'supervisor' });
    });

    it('email-already-in-use + password beda: gagal dengan instruksi Console, profil tidak ditulis', async () => {
        const fb = stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => {
                throw Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' });
            }),
            signInWithEmailAndPassword: vi.fn(async () => {
                throw Object.assign(new Error('wrong'), { code: 'auth/wrong-password' });
            }),
        });
        const ctx = makeCtx({ isAdmin: true, user: { email: 'admin@x.id' } });

        const res = await ctx.createUser('teknisi@x.id', 'salah', 'user');

        expect(res.success).toBe(false);
        expect(res.message).toMatch(/Firebase Console/);
        expect(fb.set).not.toHaveBeenCalled();
        expect(ctx.isLoading).toBe(false);
    });

    it('error selain email-already-in-use diteruskan apa adanya, app sekunder tetap dibersihkan', async () => {
        const fb = stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => {
                throw Object.assign(new Error('network-request-failed'), { code: 'auth/network-request-failed' });
            }),
        });
        const ctx = makeCtx({ isAdmin: true, user: { email: 'admin@x.id' } });

        const res = await ctx.createUser('teknisi@x.id', 'pw', 'user');

        expect(res).toEqual({ success: false, message: 'network-request-failed' });
        expect(fb.set).not.toHaveBeenCalled();
        expect(fb.signInWithEmailAndPassword).not.toHaveBeenCalled();
        expect(appMock.deleteApp).toHaveBeenCalledTimes(1);
        expect(ctx.isLoading).toBe(false);
    });

    it('app sekunder basi dari percobaan sebelumnya dihapus dulu', async () => {
        const stale = { name: 'user-create' };
        appMock.getApps.mockReturnValue([{ name: 'default' }, stale]);
        stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'baru' } })),
        });

        await makeCtx({ isAdmin: true, user: { email: 'admin@x.id' } }).createUser('a@b.c', 'pw');

        // sekali untuk app basi, sekali untuk app yang baru dibuat
        expect(appMock.deleteApp).toHaveBeenCalledTimes(2);
        expect(appMock.deleteApp.mock.calls[0][0]).toBe(stale);
    });

    it('cleanup yang gagal (signOut/deleteApp) tidak menjatuhkan createUser', async () => {
        ssoMock.signOut.mockRejectedValue(new Error('signOut mati'));
        appMock.deleteApp.mockRejectedValue(new Error('deleteApp mati'));
        const fb = stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'baru' } })),
        });

        const res = await makeCtx({ isAdmin: true, user: { email: 'admin@x.id' } })
            .createUser('teknisi@x.id', 'pw', 'user');

        expect(res.success).toBe(true);
        expect(fb.set).toHaveBeenCalledTimes(1);
    });

    it('password kosong saja: tetap ditolak sebelum menyentuh Firebase', async () => {
        const fb = stubFirebase();
        const res = await makeCtx({ isAdmin: true }).createUser('teknisi@x.id', '');

        expect(res).toEqual({ success: false, message: 'Email and password required' });
        expect(fb.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('admin tanpa objek user: createdBy jatuh ke "admin"', async () => {
        const fb = stubFirebase({
            createUserWithEmailAndPassword: vi.fn(async () => ({ user: { uid: 'baru' } })),
        });

        await makeCtx({ isAdmin: true, user: null }).createUser('teknisi@x.id', 'pw', 'user');

        expect(fb.set.mock.calls[0][1]).toMatchObject({ createdBy: 'admin' });
    });
});
