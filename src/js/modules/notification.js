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

import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ============================================================
// CONFIG
// ============================================================
const VAPID_KEY = 'BKEQWc2qqz_wtMqZ2tYcPmlwoW1jNPO7jKmsiCX-UD-iyqJqBRFtsDF0VywoWzocniVDhTYxHRMjvWo1dDW5FYE';

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
    console.log('[Notif] Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    console.log('[Notif] Permission already granted');
    return true;
  }

  if (Notification.permission === 'denied') {
    console.log('[Notif] Permission denied');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('[Notif] Permission granted');
      // Show a welcome notification to confirm it works
      sendBrowserNotification('✅ Notifikasi Aktif', 'MTC.NEXUS akan memberi tahu Anda jika ada alert penting.');
      return true;
    }
    console.log('[Notif] Permission denied by user');
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

    // Check if SW is available
    if (!navigator.serviceWorker?.ready) {
      // Fallback: regular notification
      // eslint-disable-next-line no-new
      new Notification(title, {
        body,
        icon: '/logo.png',
        ...options,
      });
      return true;
    }

    // Use ServiceWorker for better control
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
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

    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (token) {
      console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');
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

    console.log('[FCM] Token saved to Firebase');
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
    console.log('[FCM] Token removed');
  } catch (e) {
    console.warn('[FCM] Remove token error:', e.message);
  }
}

/**
 * Listen for incoming FCM messages (foreground only).
 * This catches messages sent FROM A SERVER (Cloud Functions).
 */
export function setupForegroundListener() {
  try {
    const messaging = getMessaging();
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);

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
function pushInAppNotif(type, message, icon, color = 'border-cyan-500 bg-cyan-500/20 text-cyan-400') {
  const app = window.app;
  if (!app || !Array.isArray(app.notifications)) return;
  const id = Date.now() + Math.random();
  // Prevent duplicate type+message
  if (app.notifications.some(n => n.type === type && n.message === message)) return;
  app.notifications.push({
    id,
    type,
    message,
    icon: icon || 'fa-bell',
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
  checkLowStockParts();
  checkPendingWorkOrders();
  checkPMOverdue();
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
    pushInAppNotif('Low Stock', `${zeroStock.length} part stok 0: ${names}${zeroStock.length > 3 ? ` +${zeroStock.length-3}` : ''}`, 'fa-box', 'border-red-500 bg-red-500/20 text-red-400');
  }

  const lowStock = parts.filter(p => {
    const stok = Number(p.Stok) || 0;
    const min = Number(p.MinStock) || 0;
    return min > 0 && stok <= min && stok > 0;
  });

  if (lowStock.length > 0 && shouldNotify('low_stock_warn')) {
    const names = lowStock.slice(0, 3).map(p => p.NamaPart || p.PartID).join(', ');
    sendBrowserNotification(
      '⚠️ Low Stock Alert',
      `${lowStock.length} part mendekati minimum: ${names}${lowStock.length > 3 ? ` +${lowStock.length - 3} lainnya` : ''}`,
      { tag: 'low-stock-warn', data: { type: 'low_stock' } }
    );
    pushInAppNotif('Low Stock', `${lowStock.length} part di bawah minimum: ${names}${lowStock.length > 3 ? ` +${lowStock.length-3}` : ''}`, 'fa-boxes', 'border-yellow-500 bg-yellow-500/20 text-yellow-400');
  }
}

function checkPendingWorkOrders() {
  if (!window.app?.logs) return;

  const logs = window.app.logs;
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
    pushInAppNotif('Work Order', `${urgentWO.length} WO urgent: ${list}${urgentWO.length > 3 ? ` +${urgentWO.length-3}` : ''}`, 'fa-clipboard-exclamation', 'border-orange-500 bg-orange-500/20 text-orange-400');
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
    pushInAppNotif('PM Overdue', `${overdue.length} task lewat jadwal: ${names}${overdue.length > 3 ? ` +${overdue.length-3}` : ''}`, 'fa-calendar-times', 'border-red-500 bg-red-500/20 text-red-400');
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
    pushInAppNotif('PM Due Soon', `${upcoming.length} task jatuh tempo H-3: ${names}${upcoming.length > 3 ? ` +${upcoming.length-3}` : ''}`, 'fa-calendar-day', 'border-amber-500 bg-amber-500/20 text-amber-400');
  }
}
