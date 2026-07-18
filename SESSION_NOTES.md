# SESSION NOTES — 2026-07-13

## Task Progress

| Task | Status | Detail |
|------|--------|--------|
| **OneSignal Push Notification** | ✅ Deployed | Web push via OneSignal (gratis, gak perlu Blaze plan). Proxy API di Vercel serverless |
| **Vercel Deploy** | ✅ Done | Serverless function `api/push.js` — proxy push dgn `ONESIGNAL_API_KEY` env var |
| **Firebase hosting** | ✅ Done | Frontend tetap via `mtc-asset.web.app` |
| **Edit & Delete RequestPart** | ✅ Fixed | Gagal karena `onDelete`/`onEdit` conflict. Switch to button-based handlers |
| **Multi-item Request** | ✅ Done | Items digabung jadi 1 request (gak dibreakdown) |

### Architecture
```
mtc-asset.web.app (Firebase)
  ├─ OneSignal SDK → register device → allow push
  ├─ Firebase listener detects change → sendPushViaProxy()
  └─ Vercel API (api/push) → OneSignal REST API → push delivered
```

### Files Created/Modified
| File | Changes |
|------|---------|
| [onesignal.js](src/js/modules/onesignal.js) | [NEW] OneSignal init + subscribe + sendViaProxy |
| [api/push.js](api/push.js) | [NEW] Vercel serverless — OneSignal REST proxy |
| [vercel.json](vercel.json) | [NEW] Vercel build config |
| [.npmrc](.npmrc) | [NEW] legacy-peer-deps=true |
| [OneSignalSDKWorker.js](public/OneSignalSDKWorker.js) | [NEW] Web push service worker |
| [bootstrap.js](src/js/bootstrap.js) | [MOD] Init OneSignal after login |
| [requisition.js](src/js/modules/requisition.js) | [MOD] Push for new request, approved, arrived, closed |
| [data.js](src/js/modules/data.js) | [MOD] Push for new WO |
| [firebase.json](firebase.json) | [MOD] Added functions source config |

## Deploy
- **Frontend:** https://mtc-asset.web.app
- **Push API:** https://mtc-asset.vercel.app/api/push
- **Env var:** `ONESIGNAL_API_KEY` set di Vercel dashboard
- **Build:** `npm run build` → 0 errors

## Next Session
- [ ] Test push notification: Allow → buat Request Part → cek notif di browser
- [ ] Kalau masih error "SDK already initialized" → reload & test lagi
- [ ] Konfirmasi push muncul walau browser ditutup

