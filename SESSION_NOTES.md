# SESSION NOTES — MTC-Asset

## Last Session: 28 Juni 2026

### ✅ Completed
1. **Fix WO list race condition** — `isLoading=false` pindah ke Firebase `onValue` callback
2. **Deploy to Firebase Hosting** — build + deploy otomatis
3. **GitHub Actions CI/CD** — verify all 3 workflows, add missing `VITE_IMGBB_API_KEY`
4. **Push Notifications (FCM + Browser API)**:
   - `firebase-messaging-sw.js` — Service Worker untuk background push
   - `notification.js` — Dual strategy: Browser Notification API + FCM token registration
   - 3 triggers: Low Stock Parts, Pending WO Urgent, PM Overdue
   - Notifikasi muncul 3 detik setelah login
5. **PM Schedule** (standalone data structure):
   - `PM_Schedule` node di Firebase — tiap equipment punya banyak task PM
   - `pm-schedule.js` — CRUD module + calendar/gantt computed helpers
   - `PMSchedule.html` — 3 tabs: **Tasks** (table), **Calendar** (grid), **Gantt** (timeline)
   - Auto-repeat task: complete → generate next berdasarkan frequency
   - Database rules deployed untuk `PM_Schedule`, `_fcmTokens`, `_notifications`
6. **VAPID Key** diupdate dari Firebase Console

### 📝 Yang Perlu Diset Nanti
- **`FIREBASE_TOKEN` di GitHub Secrets** — biar auto backup jalan
- **Sentry DSN** — `VITE_SENTRY_DSN` di `.env`

### 🚀 Next Session Ideas
- **Bulk Complete PM** — centang multiple PM tasks dan complete sekaligus
- **PM Log Integration** — saat "Log PM" auto-fill dari task PM
- **Export PM Schedule ke PDF**
- **State Management Refactor** — Zustand (dari REKOMENDASI_TOOLS.md Priority 🟡)
- **Chunk Splitting** — optimize Vite build warning (>800 kB)
