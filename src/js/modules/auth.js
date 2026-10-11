/**
 * Auth module for MTC.NEXUS
 */

// Role user bersumber tunggal dari RTDB `Users/{uid}/role` (dikelola admin).
// Tidak ada lagi pemetaan role hardcoded by email — lihat ensureUserProfile (P0-2).

export const authModule = {
    loginForm: { email: '', password: '' },

    async ensureUserProfile(user) {
        if (!user?.uid) return;

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
                console.log('User profile synced:', merged.role || 'user');
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
            console.log('User profile created (role menunggu penetapan admin)');

            return userData;
        } catch (error) {
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
            await window.setPersistence(window.auth, window.browserSessionPersistence);
            const cred = await window.signInWithEmailAndPassword(window.auth, form.email, form.password);
            
            const userData = await this.ensureUserProfile(cred.user);
            this.userRole = userData?.role || 'user';
            
            this.showNotification("Welcome back!");
        } catch (error) {
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
            } catch (error) {
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
        } catch (e) {
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
            console.log('[Auth] User created:', email, role);
            
            return { success: true, user: cred.user };
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
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
            console.log('[Auth] User deleted:', uid);
        } catch (error) {
            console.error('[Auth] Delete user error:', error);
            this.showNotification('Failed to delete user', 'error');
        } finally {
            this.isLoading = false;
        }
    }
};