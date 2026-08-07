import { db, ref, set } from '../db.js';

let _enabled = true;

export function disableAudit() { _enabled = false; }
export function enableAudit() { _enabled = true; }

/**
 * Log an action to Firebase AuditTrail
 * @param {string} action  Short action label e.g. "Create Equipment", "Delete WO"
 * @param {object|string} details Extra info (item name, IDs, etc.)
 */
export async function logAudit(action, details = {}) {
  if (!_enabled) return;
  const app = window.app || window.appState;
  if (!app?.user?.uid) return;

  try {
    const entry = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      uid: app.user.uid,
      email: app.user.email || 'unknown',
      role: app.userRole || 'user',
      action,
      page: app.currentPage || '-',
      details: typeof details === 'string' ? details : JSON.stringify(details),
    };

    // Keep at 200 chars max for readability
    if (entry.details.length > 200) {
      entry.details = entry.details.substring(0, 200) + '…';
    }

    // Use timestamp as key — no push() needed
    const key = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await set(ref(db, `AuditTrail/${key}`), entry);
  } catch (e) {
    // Silent fail — audit should never break the app
    if (e.code !== 'PERMISSION_DENIED') {
      console.warn('[Audit] Write failed:', e.message);
    }
  }
}

/**
 * Initialize audit hooks on login/logout
 */
export function setupAuditHooks() {
  const app = window.app || window.appState;
  if (!app) return;

  // Patch login
  const origLogin = app.login;
  if (origLogin && !app.__auditPatched) {
    app.login = async function(...args) {
      const result = await origLogin.apply(this, args);
      if (app.isLoggedIn) logAudit('Login');
      return result;
    };
    app.__auditPatched = true;
  }

  // Patch logout
  const origLogout = app.logout || app.signOut;
  if (origLogout && !app.__auditLogoutPatched) {
    app.logout = async function(...args) {
      logAudit('Logout', { email: app.user?.email });
      return origLogout.apply(this, args);
    };
    app.__auditLogoutPatched = true;
  }

  // Add to module list if there's an injection
  if (!window.auditModule) {
    window.auditModule = {
      logAudit,
      setupAuditHooks,
    };
  }
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAuditHooks);
} else {
  setupAuditHooks();
}
