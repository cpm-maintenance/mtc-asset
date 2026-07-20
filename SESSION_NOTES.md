# SESSION NOTES — 2026-07-18

## Task Progress

| Task | Status | Detail |
|------|--------|--------|
| **AllowedHosts fix** | ✅ Done | Vite config `allowedHosts: true` for localtunnel test |
| **Service Worker OneSignal** | ✅ Fixed | `sw.js` + VitePWA `injectManifest` biar OneSignal SDK terdaftar |
| **FCM Push Proxy** | ✅ Created | `api/fcm-push.js` — Firebase Admin SDK push langsung ke semua device via FCM |
| **OneSignal → FCM migration** | ✅ Partial | Client redirect push ke endpoint FCM baru |
| **Deploy hosting** | ✅ Done | Firebase + Vercel (git push) |
| **SW + PWA config** | ✅ Updated | Cache SW digabung dgn OneSignalSDK import |

### Architecture (updated)
```
mtc-asset.web.app (Firebase hosting)
  ├─ FCM SDK → register device → token stored in _fcmTokens/{uid}
  ├─ Firebase listener detects change → sendPushViaProxy()
  └─ Vercel API (api/fcm-push) → Firebase Admin SDK → FCM push semua device
```

### ⚠️ Manual Steps (harus dikerjain besok)
1. **Generate Firebase service account key:**
   - Buka https://console.firebase.google.com/project/mtc-asset/settings/serviceaccounts/adminsdk
   - Klik **Generate new private key** → download JSON
   - Set `FIREBASE_SERVICE_ACCOUNT` di Vercel env vars
   - Redeploy Vercel

### Files Created/Modified
| File | Changes |
|------|---------|
| [api/fcm-push.js](api/fcm-push.js) | [NEW] Vercel serverless — FCM push via Firebase Admin SDK |
| [sw.js](sw.js) | [MOD] Combined cache SW + OneSignalSDK import + WB_MANIFEST |
| [vite.config.js](vite.config.js) | [MOD] injectManifest strategy + allowedHosts |
| [onesignal.js](src/js/modules/onesignal.js) | [MOD] Redirect push URL to `/api/fcm-push` |
| [package.json](package.json) | [MOD] Added `firebase-admin` dependency |

### Known Issues
- OneSignal push gak nyampe karena gak ada subscribed player ("All included players are not subscribed")
- FCM push test belum bisa jalan sebelum `FIREBASE_SERVICE_ACCOUNT` env var di-set di Vercel
- `[WM] No SW registration for postMessage` — harmless, OneSignal internal warning

## Deploy
- **Frontend:** https://mtc-asset.web.app
- **Push API (lama):** https://mtc-asset.vercel.app/api/push
- **Push API (baru):** https://mtc-asset.vercel.app/api/fcm-push
- **Env var:** `ONESIGNAL_API_KEY` set di Vercel dashboard
- **Env var (baru):** `FIREBASE_SERVICE_ACCOUNT` — **BELUM SET, SET DULU BESOK**
- **Build:** `npm run build` → 0 errors
- **Commit:** `5911414` — feat: FCM push proxy Vercel

## Next Session
- [ ] 🔴 **SET** `FIREBASE_SERVICE_ACCOUNT` di Vercel env vars (Firebase Console → Service Accounts)
- [ ] 🔴 **Deploy ulang Vercel** setelah env var di-set
- [ ] Test FCM push: Allow notif → bikin Request Part → notif harus muncul walau app ditutup
- [ ] Tes background push on mobile (PWA / Chrome)
- [ ] OneSignal bisa di-nonaktifkan kalo FCM udah jalan


