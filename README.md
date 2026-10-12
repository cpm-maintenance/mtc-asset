# 🔧 MTC-ASSET

**Industrial Maintenance Management System** — PWA for tracking equipment, spare parts, work orders, PM schedules, and performance KPIs.

> Built with Alpine.js + Firebase RTDB + Vite + Tailwind CSS

---

## ✨ Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Real-time stats, charts (status, cost, downtime, reliability) |
| **Equipment** | Full CRUD with QR code scanning, photo uploads, status tracking |
| **Spare Parts** | Stock tracking, min/max alerts, linked to equipment |
| **Work Orders** | Approval flow (approve/reject/start/complete), PDF export |
| **All Logs** | Activity history, CSV/XLSX import/export |
| **PM Schedule** | Calendar & Gantt views, auto-log from schedule |
| **Performance** | KPI data entry with PA (Availability) calculations |
| **KPI Analytics** | Charts: PA vs Actual, top events, Pareto RCA |
| **Request Part** | Multi-item requisition form, approval chain, auto-stock update |
| **AI Analysis** | Multi-provider chat (OpenAI, Claude, OpenRouter), WO analysis |

### Role-Based Access

| Role | Access |
|------|--------|
| **Admin** | Full access to all modules |
| **Supervisor** | PM Schedule, Performance, Work Orders, All Logs CRUD |
| **User** | Dashboard, Equipment, Spare Parts, Request Part (view) |

---

## 🥞 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Alpine.js 3.x, Tailwind CSS 3.x |
| **Backend / DB** | Firebase Realtime Database, Firebase Auth |
| **Build** | Vite 8.x, PWA (Service Worker via vite-plugin-pwa) |
| **Charts** | Chart.js 4.x |
| **Export** | jsPDF + jspdf-autotable, SheetJS (XLSX) |
| **QR** | html5-qrcode, qrcode |
| **AI** | OpenAI / Claude / OpenRouter API |
| **Error Tracking** | Sentry |
| **Testing** | Vitest (152 unit/integration/component) + Firebase rules test + Playwright E2E |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env — add Firebase config + API keys

# Start dev server
npm run dev
# → http://localhost:3000

# Build for production
npm run build

# Deploy to Firebase
npm run deploy
```

### Default Accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@planner.com` | *(set in Firebase)* | Admin |
| `supervisor@planner.com` | *(set in Firebase)* | Supervisor |
| *(any other)* | *(created by admin)* | User |

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run vitest (watch) |
| `npm run test:run` | Run vitest once |
| `npm run test:rules` | Firebase rules test (emulator) |
| `npm run test:coverage` | Vitest + coverage |
| `npm run test:e2e` | Playwright E2E |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run backup` | Firebase data + git commit |
| `npm run backup:firebase` | Firebase data only |
| `npm run deploy` | Deploy hosting to Firebase |
| `npm run deploy:all` | Deploy hosting + database rules |

---

## 🔌 Backend Tambahan

Selain Firebase, ada beberapa backend tambahan untuk push notification:

| Komponen | Platform | Fungsi |
|----------|----------|--------|
| `api/push.js` | Vercel serverless | Proxy OneSignal push — baca `ONESIGNAL_API_KEY` dari env Vercel |
| `api/fcm-push.js` | Vercel serverless | Proxy FCM push |
| `onesignal-server/` | Render (standalone) | Backend OneSignal mandiri (`index.js` + `package.json`) |

> API key push **tidak** dibundel ke frontend — selalu lewat proxy server (env), sesuai pola `.env`.

### 📧 Email Ringkasan Backup (P3-6)

Workflow `.github/workflows/backup.yml` (backup harian 02:00 WIB) mengirim **ringkasan status** backup ke email via **Gmail SMTP** setelah proses selesai. Step ini **dilewati otomatis** kalau secrets belum di-set, jadi tidak menggagalkan job.

Set secrets berikut di **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Isi |
|--------|-----|
| `MAIL_USERNAME` | Alamat Gmail pengirim, mis. `bot@gmail.com` |
| `MAIL_PASSWORD` | **App Password** Gmail (16 karakter) — bukan password login. Buat di https://myaccount.google.com/apppasswords (wajib 2FA aktif) |
| `MAIL_TO` | Alamat tujuan, boleh dipisah koma |

Isi email: status (success/failure), trigger, daftar node, ukuran file, Run ID, dan link detail run.



---

## 📁 Project Structure

```
mtc-asset/
├── index.html              # Main SPA shell (sidebar, nav, routing)
├── api/                    # Vercel serverless functions
│   ├── push.js             # OneSignal push proxy (env: ONESIGNAL_API_KEY)
│   └── fcm-push.js         # FCM push proxy
├── onesignal-server/       # Standalone OneSignal backend (Render)
│   ├── index.js
│   └── package.json
├── public/
│   ├── pages/              # Route components (loaded on-demand, 18 pages)
│   │   ├── Dashboard.html
│   │   ├── Equipment.html
│   │   ├── EquipmentDetail.html
│   │   ├── SpareParts.html
│   │   ├── WorkOrders.html
│   │   ├── AllLogs.html
│   │   ├── PMSchedule.html
│   │   ├── Performance.html
│   │   ├── KPI.html
│   │   ├── MTBFMTTR.html
│   │   ├── EnterpriseDashboard.html
│   │   ├── PlanningBoard.html
│   │   ├── MonthlyPlan.html
│   │   ├── TechnicianWorkload.html
│   │   ├── AuditTrail.html
│   │   ├── HistoryCard.html
│   │   ├── RequestPart.html
│   │   └── AI.html
│   └── components/         # Modals (Equipment, Parts, Log, QR, APISettings)
├── src/
│   ├── main.js             # Entry point (Alpine init, Sentry, FCM)
│   ├── css/style.css       # Tailwind + custom CSS
│   └── js/
│       ├── app.js          # Alpine app state & orchestrator
│       ├── bootstrap.js    # Init, watchers, lifecycle
│       ├── charts.js       # Chart.js rendering
│       ├── constants.ts    # Form defaults & constants
│       ├── db.js           # Firebase DB helpers
│       ├── error-handler.js
│       ├── firebase-config.js
│       ├── icons.js / lucide-icons.js
│       ├── utils.js        # Pure utility functions
│       ├── utils/component-loader.js
│       └── modules/
│           ├── auth.js            # Login, user management
│           ├── ui.js              # Toast, modal, dark mode
│           ├── data.js            # Firebase data loading
│           ├── equipment.js       # Equipment CRUD
│           ├── parts.js           # Spare parts CRUD
│           ├── logs.js            # Work Order CRUD
│           ├── performance.js     # Performance CRUD
│           ├── export.js          # PDF/XLSX/CSV export
│           ├── kpi-engine.js      # KPI calculations
│           ├── enterprise-kpi.js  # Enterprise analytics
│           ├── pm-schedule.js     # PM Schedule CRUD
│           ├── requisition.js     # Request Part CRUD
│           ├── audit.js           # Audit trail (append-only)
│           ├── ai.js              # AI integration
│           ├── notification.js    # FCM + browser notifs
│           ├── onesignal.js       # OneSignal push client
│           ├── wo-pdf-template.js # WO PDF template
│           └── indexeddb.js       # Offline cache
├── tests/                  # Vitest (unit/integration/component + rules)
├── e2e/                    # Playwright (smoke, WO/PDF)
├── scripts/                # backup.js, backup-firebase.js
├── dist/                   # Build output
├── database.rules.json     # Firebase security rules
├── vite.config.js
├── vitest.config.js
├── playwright.config.js
├── tailwind.config.js
└── firebase.json
```

---

## 🌐 Deployment

```bash
npm run build
npx firebase deploy --only hosting
```

Live: [https://mtc-asset.web.app](https://mtc-asset.web.app)

---

## 🧪 Testing

```bash
npm run test:run        # unit/integration/component (Vitest)
npm run test:rules      # Firebase security rules (emulator)
npm run test:e2e        # Playwright E2E (chromium)
npm run test:coverage   # Vitest + coverage
```

152 unit/integration/component tests + 28 rules tests + E2E smoke & WO/PDF flows. E2E flow yang butuh login self-skip tanpa `E2E_EMAIL`/`E2E_PASSWORD`.

---

## 📄 License

MIT — see `package.json`
