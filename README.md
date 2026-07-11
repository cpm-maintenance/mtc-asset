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
| **Testing** | Vitest (95+ unit tests) |

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
| `npm run backup` | Firebase data + git commit |
| `npm run backup:firebase` | Firebase data only |
| `npm run deploy` | Deploy hosting to Firebase |
| `npm run deploy:all` | Deploy hosting + database rules |

---

## 📁 Project Structure

```
mtc-asset/
├── index.html              # Main SPA shell (sidebar, nav, routing)
├── public/
│   └── pages/              # Route components (loaded on-demand)
│       ├── Dashboard.html
│       ├── Equipment.html
│       ├── EquipmentDetail.html
│       ├── SpareParts.html
│       ├── WorkOrders.html
│       ├── AllLogs.html
│       ├── PMSchedule.html
│       ├── Performance.html
│       ├── KPI.html
│       ├── RequestPart.html
│       └── AI.html
├── src/
│   ├── main.js             # Entry point (Alpine init, Sentry, FCM)
│   ├── css/style.css       # Tailwind + custom CSS
│   ├── js/
│   │   ├── app.js          # Alpine app state & orchestrator
│   │   ├── bootstrap.js    # Init, watchers, lifecycle
│   │   ├── charts.js       # Chart.js rendering
│   │   ├── constants.js    # Form defaults & constants
│   │   ├── error-handler.js
│   │   ├── utils.js        # Pure utility functions
│   │   └── modules/
│   │       ├── auth.js         # Login, user management
│   │       ├── ui.js           # Toast, modal, dark mode
│   │       ├── data.js         # Firebase data loading
│   │       ├── equipment.js    # Equipment CRUD
│   │       ├── parts.js        # Spare parts CRUD
│   │       ├── logs.js         # Work Order CRUD
│   │       ├── performance.js  # Performance CRUD
│   │       ├── export.js       # PDF/XLSX/CSV export
│   │       ├── kpi-engine.js   # KPI calculations
│   │       ├── pm-schedule.js  # PM Schedule CRUD
│   │       ├── requisition.js  # Request Part CRUD
│   │       ├── ai.js           # AI integration
│   │       ├── notification.js # FCM + browser notifs
│   │       └── indexeddb.js    # Offline cache
├── dist/                   # Build output
├── database.rules.json     # Firebase security rules
├── vite.config.js
├── tailwind.config.js
├── firebase.json
└── scripts/
    ├── backup.js
    └── backup.bat
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
npm run test:run
```

95+ unit tests covering utility functions, data processing, and module logic.

---

## 📄 License

MIT — see `package.json`
