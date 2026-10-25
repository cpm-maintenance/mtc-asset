/**
 * notification.js — Push & In-App Notification Module
 * 
 * DUA STRATEGI:
 * 1. **Browser Notification API** (Web Notification) — Langsung dari client, tanpa server.
 *    Cocok untuk: local check notifikasi (low stock, WO, PM).
 * 2. **FCM Token Registration** — Untuk future server-side push.
 *    Token disimpan di Firebase, siap pakai kapanpun Cloud Functions diaktifkan.
 * 
 * Cara kerja Mode 1 (Browser Notification):
 *   - Dapat izin → token FCM (opsional) → ServiceWorker.showNotification()
 *   - checkAllNotifications() jalan periodik + di trigger event
 *   - Low stock, pending WO urgent, PM overdue → langsung notif browser
 * 
 * IMPORTANT: FCM PUSH MESSAGING MEMBUTUHKAN SERVER (Cloud Functions / Admin SDK).
 * Client-side hanya bisa REGISTER token dan LISTEN for messages.
 * Kirim notifikasi via FCM → butuh Firebase Cloud Functions deployment terpisah.
 */

import { logger } from '../logger.js';

// ============================================================
// CONFIG
// ============================================================
// VAPID public key untuk Web Push (isi di .env / Vercel env: VITE_FIREBASE_VAPID_KEY)
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
if (!VAPID_KEY) console.warn('[FCM] VITE_FIREBASE_VAPID_KEY belum diset — push notification dinonaktifkan');

// Anti-spam: already notified this session (key = notif type)
const _notifiedKeys = new Set();

/** Reset anti-spam blocker — called on bell click so fresh checks always show */
export function resetNotifBlocker() {
  _notifiedKeys.clear();
}

// ============================================================
// MODE 1: BROWSER NOTIFICATION API (Immediate, no server)
// ============================================================

/**
 * Request notification permission and show a test notification.
 * Call this AFTER login, triggered by user action.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    logger.debug('[Notif] Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    logger.debug('[Notif] Permission already granted');
    return true;
  }

  if (Notification.permission === 'denied') {
    logger.debug('[Notif] Permission denied');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      logger.debug('[Notif] Permission granted');
      // Show a welcome notification to confirm it works
      sendBrowserNotification('✅ Notifikasi Aktif', 'MTC.NEXUS akan memberi tahu Anda jika ada alert penting.');
      return true;
    }
    logger.debug('[Notif] Permission denied by user');
    return false;
  } catch (e) {
    console.warn('[Notif] Permission error:', e.message);
    return false;
  }
}

/**
 * Send browser notification via ServiceWorker.
 * This is the CORE method for client-side notifications.
 */
export async function sendBrowserNotification(title, body, options = {}) {
  try {
    // Must have permission
    if (Notification.permission !== 'granted') return false;

    // Fallback langsung tanpa ServiceWorker (dev server / worker belum aktif).
    const showDirect = () => {
      new Notification(title, { body, icon: '/logo.png', ...options });
      return true;
    };

    // Check if SW is available
    if (!navigator.serviceWorker?.ready) return showDirect();

    // Use ServiceWorker for better control — hanya bila worker-nya benar-benar aktif.
    // Di dev server tidak ada worker aktif, dan `showNotification` melempar
    // "No active worker for scope"; tanpa `await` lemparan itu lolos dari try/catch
    // sebagai unhandled rejection.
    const registration = await navigator.serviceWorker.ready;
    if (!registration?.active) return showDirect();

    await registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: options.tag || 'mtc-notification',
      data: options.data || {},
      actions: options.actions || [],
    });

    return true;
  } catch (e) {
    console.warn('[Notif] Browser notif error:', e.message);
    return false;
  }
}

/**
 * Check if notification was already sent this session (anti-spam)
 */
function shouldNotify(key) {
  if (_notifiedKeys.has(key)) return false;
  _notifiedKeys.add(key);
  return true;
}

// ============================================================
// MODE 2: FCM TOKEN REGISTRATION (Future server-side push)
// ============================================================

/**
 * Register FCM token for future server-side push notifications.
 * Stores token in Firebase DB so Cloud Functions can send to it.
 */
export async function registerFCMToken() {
  try {
    if (!('Notification' in window)) return null;
    if (Notification.permission !== 'granted') return null;

    // S33e: firebase/messaging diimpor dinamis — SDK-nya tidak perlu ikut di
    // bundel awal halaman login (dulu ~68 KiB ikut terunduh walau tak dipakai).
    const { getMessaging, getToken } = await import('firebase/messaging');
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (token) {
      logger.debug('[FCM] Token obtained:', token.substring(0, 20) + '...');
      await saveFCMToken(token);
      return token;
    }

    return null;
  } catch (e) {
    // FCM may fail if Cloud Messaging API not enabled in Firebase
    console.warn('[FCM] Token error:', e.message, '- non-critical, browser notifs still work');
    return null;
  }
}

async function saveFCMToken(token) {
  if (!window.db || !window.app?.user?.uid) return;

  try {
    const uid = window.app.user.uid;
    await window.set(window.ref(window.db, `Users/${uid}/fcmToken`), {
      token,
      updatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent?.substring(0, 100) || '',
    });

    await window.set(window.ref(window.db, `_fcmTokens/${uid}`), {
      token,
      email: window.app.user.email,
      updatedAt: new Date().toISOString(),
    });

    logger.debug('[FCM] Token saved to Firebase');
  } catch (e) {
    console.warn('[FCM] Save token error:', e.message);
  }
}

/**
 * Remove FCM token on logout
 */
export async function removeFCMToken() {
  if (!window.db || !window.app?.user?.uid) return;
  try {
    const uid = window.app.user.uid;
    await window.remove(window.ref(window.db, `Users/${uid}/fcmToken`));
    await window.remove(window.ref(window.db, `_fcmTokens/${uid}`));
    logger.debug('[FCM] Token removed');
  } catch (e) {
    console.warn('[FCM] Remove token error:', e.message);
  }
}

/**
 * Listen for incoming FCM messages (foreground only).
 * This catches messages sent FROM A SERVER (Cloud Functions).
 */
export async function setupForegroundListener() {
  try {
    const { getMessaging, onMessage } = await import('firebase/messaging');
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      logger.debug('[FCM] Foreground message received:', payload);

      // Show as in-app notification
      const globalApp = window.app || window.appState;
      if (globalApp?.showNotification && payload.notification) {
        globalApp.showNotification(
          `${payload.notification.title}: ${payload.notification.body}`,
          'info'
        );
      }
    });
  } catch (e) {
    console.warn('[FCM] Foreground listener error:', e.message);
  }
}

// ============================================================
// NOTIFICATION CHECKERS (Browser Notifications)
// ============================================================

/**
 * Push a notification into the in-app notification panel (lonceng).
 * This makes alerts visible in the bell badge + notification modal.
 */
function pushInAppNotif(type, message, icon, color = 'border-tac-status-repair bg-tac-status-repair/20 text-tac-status-repair') {
  const app = window.app;
  if (!app || !Array.isArray(app.notifications)) return;
  const id = Date.now() + Math.random();
  // Prevent duplicate type+message
  if (app.notifications.some(n => n.type === type && n.message === message)) return;
  app.notifications.push({
    id,
    type,
    message,
    icon: icon || 'notifications',
    color,
    exiting: false,
  });
}

/**
 * Check all conditions and send browser notifications.
 * Called:
 * - 5 detik setelah login
 * - Setiap 5 menit selama app terbuka
 * - Manual via window.notificationAPI.checkAllNotifications()
 */
export function checkAllNotifications() {
  checkPendingWorkOrders();
  checkPMOverdue();
  checkWarrantyExpiry();
  checkLowStockParts();

  // C2: Auto-reorder spare low stock (fire-and-forget, admin/supervisor only)
  if (window.app?.autoReorderLowStock && window.app?.isAdminOrSupervisor) {
    window.app.autoReorderLowStock().catch(e => console.warn('[Notif] Auto-reorder:', e.message));
  }
}

function checkLowStockParts() {
  if (!window.app?.allParts) return;

  const parts = window.app.allParts;
  const zeroStock = parts.filter(p => (Number(p.Stok) || 0) === 0);

  if (zeroStock.length > 0 && shouldNotify('low_stock_zero')) {
    const names = zeroStock.slice(0, 3).map(p => p.NamaPart || p.PartID).join(', ');
    sendBrowserNotification(
      '🚨 Stock Part Habis!',
      `${zeroStock.length} part dengan stok 0: ${names}${zeroStock.length > 3 ? ` +${zeroStock.length - 3} lainnya` : ''}`,
      { tag: 'low-stock-zero', data: { type: 'low_stock' } }
    );
    pushInAppNotif('Low Stock', `${zeroStock.length} part stok 0: ${names}${zeroStock.length > 3 ? ` +${zeroStock.length-3}` : ''}`, 'inventory_2', 'border-tac-status-emergency bg-tac-status-emergency/20 text-tac-status-emergency');
  }

  const lowStock = parts.filter(p => {
    const stok = Number(p.Stok) || 0;
    const min = Number(p.MinStock) || 0;
    return min > 0 && stok <= min;
  });

  if (lowStock.length > 0 && shouldNotify('low_stock_warn')) {
    const names = lowStock.slice(0, 3).map(p => p.NamaPart || p.PartID).join(', ');
    sendBrowserNotification(
      '⚠️ Low Stock Alert',
      `${lowStock.length} part mendekati minimum: ${names}${lowStock.length > 3 ? ` +${lowStock.length - 3} lainnya` : ''}`,
      { tag: 'low-stock-warn', data: { type: 'low_stock' } }
    );
    pushInAppNotif('Low Stock', `${lowStock.length} part di bawah minimum: ${names}${lowStock.length > 3 ? ` +${lowStock.length-3}` : ''}`, 'inventory', 'border-tac-status-repair bg-tac-status-repair/20 text-tac-status-repair');
  }
}

function checkPendingWorkOrders() {
  if (!window.app?.logs) return;

  const logs = window.app.logs;
  const today = new Date().toISOString().split('T')[0];
  const urgentWO = logs.filter(l =>
    (l.Status === 'Pending' || l.Status === 'Draft') &&
    (l.woPriority === 'Emergency' || l.woPriority === 'Urgent')
  );

  if (urgentWO.length > 0 && shouldNotify('wo_urgent')) {
    const list = urgentWO.slice(0, 3).map(l =>
      `#${l.woNumber || 'N/A'} (${l.woPriority})`
    ).join(', ');

    sendBrowserNotification(
      '🔴 Work Order Urgent!',
      `${urgentWO.length} WO urgent: ${list}${urgentWO.length > 3 ? ` +${urgentWO.length - 3} lainnya` : ''}`,
      { tag: 'wo-urgent', data: { type: 'pending_wo' } }
    );
    pushInAppNotif('Work Order', `${urgentWO.length} WO urgent: ${list}${urgentWO.length > 3 ? ` +${urgentWO.length-3}` : ''}`, 'assignment_late', 'border-tac-status-repair bg-tac-status-repair/20 text-tac-status-repair');
  }

  // Aging unapproved WO — pending > 3 hari (SLA), berapa lama menunggu
  const aging = logs.filter(l => {
    if (!(l.Status === 'Pending' || l.Status === 'Draft')) return false;
    if (!l.Tanggal) return false;
    const d = new Date(l.Tanggal);
    if (isNaN(d)) return false;
    const age = (new Date(today) - d) / 86400000;
    return age > 3;
  });

  if (aging.length > 0 && shouldNotify('wo_aging')) {
    const list = aging.slice(0, 3).map(l => {
      const age = Math.floor((new Date(today) - new Date(l.Tanggal)) / 86400000);
      return `#${l.woNumber || 'N/A'} (${age}d)`;
    }).join(', ');
    sendBrowserNotification(
      '⏳ Work Order Aging!',
      `${aging.length} WO menunggu > 3 hari: ${list}${aging.length > 3 ? ` +${aging.length-3} lainnya` : ''}`,
      { tag: 'wo-aging', data: { type: 'wo_aging' } }
    );
    pushInAppNotif('WO Aging', `${aging.length} WO pending > 3 hari: ${list}${aging.length > 3 ? ` +${aging.length-3}` : ''}`, 'hourglass_bottom', 'border-tac-status-repair bg-tac-status-repair/20 text-tac-status-repair');
  }
}

function checkPMOverdue() {
  if (!window.app?.pmList) return;
  const today = new Date().toISOString().split('T')[0];
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const threeDaysStr = threeDaysLater.toISOString().split('T')[0];

  // Overdue from pmList (real PM tasks)
  const overdue = (window.app.pmList || []).filter(pm =>
    pm.status === 'pending' && pm.date < today
  );

  if (overdue.length > 0 && shouldNotify('pm_overdue')) {
    const names = overdue.slice(0, 3).map(pm => pm.taskName).join(', ');
    sendBrowserNotification(
      '⏰ PM Overdue!',
      `${overdue.length} PM task overdue: ${names}${overdue.length > 3 ? ` +${overdue.length - 3} lainnya` : ''}`,
      { tag: 'pm-overdue', data: { type: 'pm_overdue' } }
    );
    pushInAppNotif('PM Overdue', `${overdue.length} task lewat jadwal: ${names}${overdue.length > 3 ? ` +${overdue.length-3}` : ''}`, 'event_busy', 'border-tac-status-emergency bg-tac-status-emergency/20 text-tac-status-emergency');
  }

  // H-3 upcoming
  const upcoming = (window.app.pmList || []).filter(pm =>
    pm.status === 'pending' && pm.date >= today && pm.date <= threeDaysStr
  );

  if (upcoming.length > 0 && shouldNotify('pm_upcoming')) {
    const names = upcoming.slice(0, 3).map(pm => pm.taskName).join(', ');
    sendBrowserNotification(
      '📅 PM Mendekati Deadline',
      `${upcoming.length} PM task due in 3 days: ${names}${upcoming.length > 3 ? ` +${upcoming.length - 3} lainnya` : ''}`,
      { tag: 'pm-upcoming', data: { type: 'pm_overdue' } }
    );
    pushInAppNotif('PM Due Soon', `${upcoming.length} task jatuh tempo H-3: ${names}${upcoming.length > 3 ? ` +${upcoming.length-3}` : ''}`, 'event', 'border-tac-status-repair bg-tac-status-repair/20 text-tac-status-repair');
  }
}

// D2: Warranty & lifespan tracker — spare part melewati umur pakai
function checkWarrantyExpiry() {
  if (!window.app?.allParts) return;

  const today = new Date();
  const expired = (window.app.allParts || []).filter(p => {
    if (!p.lastReplaceDate || !p.avgLifetimeDays) return false;
    const install = new Date(p.lastReplaceDate);
    if (isNaN(install)) return false;
    const age = (today - install) / 86400000;
    return age >= Number(p.avgLifetimeDays);
  });

  if (expired.length > 0 && shouldNotify('warranty_expired')) {
    const names = expired.slice(0, 3).map(p => p.NamaPart || p.PartID).join(', ');
    sendBrowserNotification(
      '🕒 Part Melewati Umur Pakai!',
      `${expired.length} part melewati lifetime: ${names}${expired.length > 3 ? ` +${expired.length-3} lainnya` : ''}`,
      { tag: 'warranty-expired', data: { type: 'warranty_expired' } }
    );
    pushInAppNotif('Lifetime Check', `${expired.length} part lewat umur pakai: ${names}${expired.length > 3 ? ` +${expired.length-3}` : ''}`, 'hourglass_top', 'border-tac-secondary bg-tac-secondary/20 text-tac-secondary');
  }
}
