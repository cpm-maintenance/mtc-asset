/**
 * Auth module for MTC.NEXUS
 */

const ADMIN_EMAILS = ['admin@planner.com'];
const SUPERVISOR_EMAILS = ['supervisor@planner.com'];

export const authModule = {
    loginForm: { email: '', password: '' },
    loginform: { email: '', password: '' },

    async ensureUserProfile(user) {
        if (!user?.uid) return;
        
        try {
            const userRef = window.ref(window.db, `Users/${user.uid}`);
            const snapshot = await window.get(userRef);
            
            const isAdmin = user.email && ADMIN_EMAILS.some(admin => 
                user.email.toLowerCase() === admin.toLowerCase()
            );
            const isSupervisor = !isAdmin && user.email && SUPERVISOR_EMAILS.some(sup => 
                user.email.toLowerCase() === sup.toLowerCase()
            );
            
            const existingData = snapshot.exists() ? snapshot.val() : null;
            const existingCreatedAt = existingData?.createdAt;
            
            const userData = {
                uid: user.uid,
                email: user.email,
                role: isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'user'),
                lastLogin: new Date().toISOString(),
                createdAt: existingCreatedAt || new Date().toISOString()
            };
            
            await window.set(userRef, userData);
            console.log('User profile synced:', userData.role);
            
            return userData;
        } catch (error) {
            console.error('Failed to sync user profile:', error);
            return null;
        }
    },

    async login() {
        const form = this.loginform.email ? this.loginform : this.loginForm;
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