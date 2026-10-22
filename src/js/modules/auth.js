// @ts-check
import { logger } from '../logger.js';
/** @typedef {import('../appstate').AppState} AppState */
/**
 * Auth module for MTC.NEXUS
 */

// Role user bersumber tunggal dari RTDB `Users/{uid}/role` (dikelola admin).
// Tidak ada lagi pemetaan role hardcoded by email — lihat ensureUserProfile (P0-2).

export const authModule = /** @type {Partial<AppState> & ThisType<AppState>} */ ({
    loginForm: { email: '', password: '', pin: '', keepSession: false },
    // Toggle "tampilkan secure key" di layar login (bukan rahasia — hanya UI state).
    showLoginKey: false,
    // Mode akses di layar login: 'email' (default) · 'pin' (kiosk cepat) · 'sso'.
    loginMode: 'email',
    // PIN cepat: email operator yang terakhir sukses di perangkat ini.
    rememberedEmail: '',

    /**
     * Ganti mode akses. `pin` butuh email tersimpan — kalau belum ada, tolak.
     * @param {string} mode
     */
    setLoginMode(mode) {
        if (!['email', 'pin', 'sso'].includes(mode)) return;
        if (mode === 'pin') {
            const saved = localStorage.getItem('mtc_last_login_email') || '';
            this.rememberedEmail = saved;
            if (!saved) {
                this.showNotification(
                    'Mode PIN butuh satu kali login email di perangkat ini dulu',
                    'warning',
                );
                this.loginMode = 'email';
                return;
            }
        }
        this.loginMode = mode;
    },

    /** Titik masuk tunggal tombol submit — memilih jalur sesuai mode aktif. */
    async submitLogin() {
        // Prefetch pasca-auth dimulai DI SINI, bukan dari interaksi generik:
        // kunjungan pasif tidak membayar apa pun, sementara siapa pun yang
        // menekan submit hampir pasti login. Tanpa ini chunk `app-*.js`
        // (57,7 KiB gzip) + lapisan data (38,5 KiB) baru diminta SETELAH auth
        // selesai, dan keduanya berurutan di jalur kritis.
        // Keduanya idempoten, jadi jalur auth di `main.js` tinggal menunggu
        // promise yang sama. Kegagalan prefetch diabaikan: jalur sebenarnya
        // akan mencoba lagi dan melaporkan errornya sendiri.
        if (typeof window.__loadDataLayer === 'function') window.__loadDataLayer().catch(() => {});
        if (typeof window.__loadApp === 'function') window.__loadApp().catch(() => {});
        // Bundel CSS penuh ikut dimulai di sini (S33ab): 13,2 KB-nya dulu
        // render-blocking; sekarang berjalan paralel dengan round-trip auth dan
        // sudah mendarat sebelum shell dirender.
        if (typeof window.__loadFullCss === 'function') window.__loadFullCss();
        if (this.loginMode === 'pin') return this.loginWithPin?.();
        if (this.loginMode === 'sso') return this.loginWithSSO?.();
        return this.login();
    },

    /** PIN cepat: pakai email tersimpan + PIN sebagai password Firebase. */
    async loginWithPin() {
        const pin = String(this.loginForm.pin || '').trim();
        const email = this.rememberedEmail || localStorage.getItem('mtc_last_login_email') || '';
        if (!email) {
            this.showNotification('Email operator belum tersimpan di perangkat ini', 'error');
            this.loginMode = 'email';
            return;
        }
        if (!/^\d{4,6}$/.test(pin)) {
            this.showNotification('PIN harus 4–6 digit angka', 'error');
            return;
        }
        this.loginForm.email = email;
        this.loginForm.password = pin;
        await this.login();
    },

    /** SSO Google lewat popup Firebase. Provider harus aktif di Firebase Console. */
    async loginWithSSO() {
        if (this.isLoading) return;
        this.isLoading = true;
        try {
            // Kartu t_505ab09a: import dinamis — `firebase/auth` (yang membawa
            // GoogleAuthProvider + signInWithPopup, plus iframe `__/auth/iframe`
            // dan `apis.google.com`) baru diunduh saat tombol SSO diklik, bukan
            // saat boot. API Google keluar dari jalur kritis login.
            // `browserPopupRedirectResolver` wajib diberikan eksplisit: `auth`
            // dibuat lewat `initializeAuth` tanpa resolver (lihat db.js) supaya
            // iframe auth tidak dimuat di layar login.
            const { GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver } = await import('firebase/auth');
            if (!signInWithPopup || !GoogleAuthProvider) {
                this.showNotification('SSO belum tersedia di build ini', 'error');
                return;
            }
            const provider = new GoogleAuthProvider();
            // `window.auth` — sama seperti login email di berkas ini; AppState
            // tidak menyimpan instance auth.
            const cred = await signInWithPopup(window.auth, provider, browserPopupRedirectResolver);
            const userData = await this.ensureUserProfile(cred.user);
            this.userRole = userData?.role || 'user';
            this.rememberLogin?.(cred.user?.email || '');
            this.showNotification('Welcome back!');
        } catch (/** @type {any} */ error) {
            console.error(error);
            this.showNotification('SSO gagal: ' + (error?.message || error), 'error');
        } finally {
            this.isLoading = false;
        }
    },

    /**
     * Simpan email terakhir untuk mode PIN. Hanya email, bukan kredensial.
     * @param {string} [email]
     */
    rememberLogin(email) {
        if (!email) return;
        localStorage.setItem('mtc_last_login_email', email);
        this.rememberedEmail = email;
    },

    async ensureUserProfile(user) {
        if (!user?.uid) return;

        // Lapisan data (SDK RTDB) dimuat MALAS sejak S33p, sementara fungsi ini
        // dipanggil tepat setelah `signInWithEmailAndPassword` — sebelum listener
        // auth di bootstrap.js selesai menunggu `__loadDataLayer()`. Tanpa baris
        // ini `window.ref` masih undefined → "Failed to sync user profile:
        // TypeError: window.ref is not a function", `lastLogin` tidak pernah
        // tertulis, dan profil user baru tidak pernah dibuat. Idempoten, jadi
        // aman dipanggil walau lapisan data sudah ada.
        if (typeof window.__loadDataLayer === 'function') {
            try {
                await window.__loadDataLayer();
            } catch (/** @type {any} */ error) {
                logger.warn('[auth] lapisan data gagal dimuat:', error);
            }
        }

        try {
            const userRef = window.ref(window.db, `Users/${user.uid}`);
            const snapshot = await window.get(userRef);
            const existingData = snapshot.exists() ? snapshot.val() : null;

            // P0-2: `role` HANYA boleh ditulis admin (lihat database.rules.json).
            // Jangan pernah self-write `role` di sini — kalau ditulis, rules menolak
            // dan seluruh sinkronisasi profil gagal (login user biasa ikut rusak).
            if (existingData) {
                // Profil sudah ada → sinkronkan field non-privileged saja.
                const updates = {
                    email: user.email || existingData.email,
                    lastLogin: new Date().toISOString(),
                };
                await window.update(userRef, updates);
                const merged = { ...existingData, ...updates };
                logger.debug('User profile synced:', merged.role || 'user');
                return merged;
            }

            // Profil belum ada → buat TANPA `role`. Admin akan menetapkan role
            // lewat User Management (satu-satunya penulis `role` yang sah).
            const userData = {
                uid: user.uid,
                email: user.email,
                lastLogin: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };
            await window.set(userRef, userData);
            logger.debug('User profile created (role menunggu penetapan admin)');

            return userData;
        } catch (/** @type {any} */ error) {
            console.error('Failed to sync user profile:', error);
            return null;
        }
    },

    async login() {
        const form = this.loginForm;
        if (!form.email || !form.password) {
            this.showNotification("Please enter email and password", "error");
            return;
        }
        this.isLoading = true;
        try {
            // Persistensi mengikuti centang "simpan sesi": shift bawah tanah sering
            // kehilangan sinyal, jadi operator butuh sesi yang bertahan melewati
            // reload. Default tetap session-only (perilaku lama).
            await window.setPersistence(
                window.auth,
                form.keepSession ? window.browserLocalPersistence : window.browserSessionPersistence,
            );
            const cred = await window.signInWithEmailAndPassword(window.auth, form.email, form.password);
            
            const userData = await this.ensureUserProfile(cred.user);
            this.userRole = userData?.role || 'user';
            this.rememberLogin?.(form.email);
            
            this.showNotification("Welcome back!");
        } catch (/** @type {any} */ error) {
            console.error(error);
            this.showNotification("Login failed: " + error.message, "error");
        } finally {
            this.isLoading = false;
        }
    },

    async logout() {
        if (confirm('Are you sure you want to logout?')) {
            this.isLoading = true;
            try {
                await window.signOut(window.auth);
                this.isLoggedIn = false;
                this.user = null;
                this.userRole = 'user';
                this.showNotification("Logged out successfully", "info");
            } catch (/** @type {any} */ error) {
                this.showNotification("Error logging out: " + error.message, "error");
            } finally {
                this.isLoading = false;
            }
        }
    },

    showUID() {
        if (this.user) {
            prompt("Copy your UID below:", this.user.uid);
        }
    },

    async getUserRole(uid) {
        if (!uid) return 'user';
        try {
            const snapshot = await window.get(window.ref(window.db, `Users/${uid}/role`));
            return snapshot.val() || 'user';
        } catch {
            return 'user';
        }
    },
    
    async createUser(email, password, role = 'user') {
        if (!email || !password) {
            this.showNotification("Email and password required", "error");
            return { success: false, message: "Email and password required" };
        }
        
        if (!this.isAdmin) {
            this.showNotification("Only admin can create users", "error");
            return { success: false, message: "Admin only" };
        }
        
        this.isLoading = true;
        try {
            // Create user in Firebase Auth
            const cred = await window.createUserWithEmailAndPassword(window.auth, email, password);
            
            // Update user profile with role
            const userData = {
                uid: cred.user.uid,
                email: email,
                role: role,
                createdAt: new Date().toISOString(),
                createdBy: this.user?.email || 'admin'
            };
            
            await window.set(window.ref(window.db, `Users/${cred.user.uid}`), userData);
            
            this.showNotification(`User ${email} created as ${role}`);
            logger.debug('[Auth] User created:', email, role);
            
            return { success: true, user: cred.user };
        } catch (/** @type {any} */ error) {
            console.error('[Auth] Create user error:', error);
            this.showNotification("Failed to create user: " + error.message, "error");
            return { success: false, message: error.message };
        } finally {
            this.isLoading = false;
        }
    },
    
    showCreateUserModal: false,
    showUserManagement: false,
    newUserForm: { email: '', password: '', role: 'user' },
    
    openCreateUserModal() {
        this.newUserForm = { email: '', password: '', role: 'user' };
        this.showCreateUserModal = true;
    },
    
    closeCreateUserModal() {
        this.showCreateUserModal = false;
        this.newUserForm = { email: '', password: '', role: 'user' };
    },
    
    async submitCreateUser() {
        const result = await this.createUser(
            this.newUserForm.email,
            this.newUserForm.password,
            this.newUserForm.role
        );
        
        if (result.success) {
            this.closeCreateUserModal();
        }
    },
    
    allUsers: [],
    
    // Edit User
    showEditUserModal: false,
    editUserForm: { uid: '', email: '', role: 'user' },
    
    openEditUser(user) {
        this.editUserForm = { uid: user.uid, email: user.email, role: user.role || 'user' };
        this.showEditUserModal = true;
    },
    
    closeEditUserModal() {
        this.showEditUserModal = false;
        this.editUserForm = { uid: '', email: '', role: 'user' };
    },
    
    async saveEditUser() {
        if (!this.isAdmin || !this.editUserForm.uid) return;
        if (!this.editUserForm.email.trim()) return;
        this.isLoading = true;
        try {
            const userRef = window.ref(window.db, `Users/${this.editUserForm.uid}`);
            const snap = await window.get(userRef);
            const existing = snap.val() || {};
            await window.set(userRef, {
                ...existing,
                email: this.editUserForm.email.trim(),
                role: this.editUserForm.role,
                updatedAt: new Date().toISOString(),
            });
            const idx = this.allUsers.findIndex(u => u.uid === this.editUserForm.uid);
            if (idx !== -1) {
                this.allUsers[idx] = { ...this.allUsers[idx], email: this.editUserForm.email.trim(), role: this.editUserForm.role };
            }
            this.showNotification('User updated successfully');
            this.closeEditUserModal();
        } catch (/** @type {any} */ error) {
            console.error('[Auth] Edit user error:', error);
            this.showNotification('Failed to update user', 'error');
        } finally {
            this.isLoading = false;
        }
    },

    async sendPasswordReset(uid) {
        const user = this.allUsers.find(u => u.uid === uid);
        if (!user?.email) return;
        if (!confirm(`Send password reset email to ${user.email}?`)) return;
        try {
            await window.sendPasswordResetEmail(window.auth, user.email);
            this.showNotification(`Reset email sent to ${user.email}`);
        } catch (/** @type {any} */ error) {
            console.error('[Auth] Password reset error:', error);
            this.showNotification('Failed to send reset email', 'error');
        }
    },
    
    async loadAllUsers() {
        if (!window.db || !this.isAdmin) return;
        
        this.isLoading = true;
        try {
            const snapshot = await window.get(window.ref(window.db, 'Users'));
            if (snapshot.exists()) {
                const users = snapshot.val();
                this.allUsers = Object.entries(users).map(([uid, data]) => ({
                    uid,
                    ...data
                })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            }
        } catch (/** @type {any} */ error) {
            console.error('[Auth] Load users error:', error);
        } finally {
            this.isLoading = false;
        }
    },
    
    async deleteUser(uid) {
        if (!this.isAdmin || !uid) return;
        if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
        
        this.isLoading = true;
        try {
            await window.remove(window.ref(window.db, `Users/${uid}`));
            this.showNotification('User deleted successfully');
            this.allUsers = this.allUsers.filter(u => u.uid !== uid);
            logger.debug('[Auth] User deleted:', uid);
        } catch (/** @type {any} */ error) {
            console.error('[Auth] Delete user error:', error);
            this.showNotification('Failed to delete user', 'error');
        } finally {
            this.isLoading = false;
        }
    }
});