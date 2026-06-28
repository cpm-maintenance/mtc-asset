# 🛠️ Rekomendasi Tools Tambahan — MTC-Asset

> **Dibuat:** 22 Juni 2026
> **Berdasarkan analisis:** `app.js` (1340 baris), 12 modules, Firebase RTDB + Auth + Storage

---

## 🔴 Prioritas Tinggi — Dampak Langsung

### 1. Sentry — Error Tracking & Monitoring

| Item | Detail |
|------|--------|
| **Masalah** | Error hanya di `console.log` + modal error boundary. Tidak ada visibility jika user mengalami error di production. |
| **Solusi** | Integrasi **Sentry** untuk capture error otomatis (JS exceptions, promise rejections, Firebase errors) + performance tracing. |
| **Cara** | `npm install @sentry/browser` → init di `src/main.js` |
| **Effort** | 2-4 jam |
| **Prioritas** | 🔴 **Wajib** |

```js
// Contoh integrasi di main.js
import * as Sentry from "@sentry/browser";
Sentry.init({
  dsn: "https://...@o....ingest.sentry.io/...",
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});
```

---

### 2. GitHub Actions — CI/CD Pipeline

| Item | Detail |
|------|--------|
| **Masalah** | Build & deploy masih manual (`npm run build` + `firebase deploy`). Risiko human error, lupa deploy. |
| **Solusi** | Auto build + deploy ke Firebase Hosting tiap push ke `main`, plus cron backup Firebase tiap malam. |
| **Effort** | 4-6 jam |
| **Prioritas** | 🔴 **Wajib** |

**Workflow yang direkomendasikan:**
1. **Push ke `main`** → Build + Deploy ke Firebase Hosting
2. **Cron 00:00 WIB** → Backup Firebase RTDB ke file JSON, push ke repo
3. **Pull Request** → Auto lint + build check

```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase
on:
  push:
    branches: [main]
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
```

---

### 3. State Management Lebih Terstruktur

| Item | Detail |
|------|--------|
| **Masalah** | `app.js` sudah **1340 baris** — semua state jadi satu object Alpine raksasa. Sulit di-maintain, debug, dan test. |
| **Solusi** | Pisahkan state ke store terpisah. Opsi: **Zustand** (ringan, tanpa boilerplate) atau tetap Alpine tapi modular dengan store functions. |
| **Effort** | 8-16 jam (gradual, per modul) |
| **Prioritas** | 🟡 **Sangat disarankan** |

```js
// Contoh dengan Zustand
import { create } from 'zustand';

export const useEquipmentStore = create((set) => ({
  equipment: [],
  selectedEquip: null,
  setEquipment: (data) => set({ equipment: data }),
  addEquipment: (item) => set((s) => ({ equipment: [...s.equipment, item] })),
}));

export const usePartStore = create((set) => ({
  allParts: [],
  setParts: (data) => set({ allParts: data }),
}));
```

---

## 🟡 Prioritas Sedang — Peningkatan Signifikan

### 4. Push Notifications — OneSignal / FCM

| Item | Detail |
|------|--------|
| **Masalah** | Tidak ada notifikasi real-time jika ada WO baru, part low stock, atau PM overdue. User harus refresh manual. |
| **Solusi** | **Firebase Cloud Messaging** (built-in, gratis) atau **OneSignal** (lebih canggih). Notifikasi browser via PWA. |
| **Skenario** | • WO baru dengan priority Emergency/Urgent<br>• Stok part di bawah safety level<br>• Jadwal PM sudah dekat (H-3) |
| **Effort** | 8-12 jam |
| **Prioritas** | 🟡 **High** |

---

### 5. Tabel Perbandingan Semua Tools

| # | Tool | Fungsi | Effort | Prioritas | Dependency Baru |
|---|------|--------|--------|-----------|-----------------|
| 1 | **Sentry** | Error tracking production | 2-4 jam | 🔴 Wajib | `@sentry/browser` |
| 2 | **GitHub Actions** | Auto deploy + backup | 4-6 jam | 🔴 Wajib | - (workflow YAML) |
| 3 | **Zustand** | State management | 8-16 jam | 🟡 Sangat Disarankan | `zustand` |
| 4 | **Push Notification** | WO/stock alert | 8-12 jam | 🟡 High | `firebase/messaging` |
| 5 | **Lighthouse CI** | Performance audit | 2-4 jam | 🟡 Medium | `@lhci/cli` |
| 6 | **TypeScript** (gradual) | Type safety | 16-24 jam | 🟡 Medium | `typescript` |
| 7 | **i18next** | Multi-bahasa | 8-12 jam | 🟡 Medium | `i18next` |
| 8 | **ESLint + Prettier** | Code quality | 2-4 jam | 🟡 Medium | `eslint prettier` |
| 9 | **FullCalendar** | Kalender PM jadwal | 8-12 jam | 🟢 Low | `@fullcalendar/core` |
| 10 | **chartjs-plugin-annotation** | Target line di grafik | 1-2 jam | 🟢 Low | `chartjs-plugin-annotation` |
| 11 | **chartjs-plugin-datalabels** | Label angka di chart | 1-2 jam | 🟢 Low | `chartjs-plugin-datalabels` |
| 12 | **Leaflet.js** | Peta lokasi equipment | 8-12 jam | 🟢 Low | `leaflet` |
| 13 | **ExcelJS** | Export Excel advanced | 4-8 jam | 🟢 Low | `exceljs` |
| 14 | **pdf-lib** | PDF template kompleks | 4-8 jam | 🟢 Low | `pdf-lib` |
| 15 | **Alpine DevTools** | Debug reactivity | 0 jam (extension) | 🟡 Medium | - |

---

## 🟢 Prioritas Rendah — Nice to Have

### 6. Lighthouse CI — Performance & SEO Audit

| Item | Detail |
|------|--------|
| **Masalah** | Tidak ada pengukuran performa: bundle size, FCP, accessibility, PWA score. |
| **Solusi** | Integrasi Lighthouse CI di GitHub Actions — auto-score tiap PR. |
| **Effort** | 2-4 jam |

---

### 7. TypeScript — Type Safety (Gradual)

| Item | Detail |
|------|--------|
| **Masalah** | Semua JS tanpa tipe. Banyak bug karena typo nama field (contoh: `loginForm` vs `loginform` — dua-duanya ada di `app.js`). |
| **Solusi** | Migrasi gradual: `constants.js` dulu → modules → `app.js`. Jangan rewrite total. |
| **Effort** | 16-24 jam (bertahap per sesi) |

---

### 8. FullCalendar — Visual Scheduling

| Item | Detail |
|------|--------|
| **Masalah** | Jadwal PM (Preventive Maintenance) tidak punya tampilan kalender. Hanya list linear. |
| **Solusi** | Integrasi **FullCalendar.io** untuk lihat PM schedule, WO deadlines, dan availability equipment dalam view kalender (monthly/weekly). |
| **Effort** | 8-12 jam |

```js
// Contoh integrasi
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';

const calendar = new Calendar(calendarEl, {
  plugins: [dayGridPlugin],
  events: [
    { title: 'PM Crusher #01', start: '2026-06-25', backgroundColor: '#0ff' },
    { title: 'WO-045 Emergency', start: '2026-06-22', backgroundColor: '#ef4444' },
  ],
});
calendar.render();
```

---

### 9. Visual Chart Enhancements

| Plugin | Fungsi | Cara |
|--------|--------|------|
| **chartjs-plugin-datalabels** | Tampilkan persentase langsung di pie chart | `npm install chartjs-plugin-datalabels` |
| **chartjs-plugin-annotation** | Tambah target line (contoh: PA target 90%) | `npm install chartjs-plugin-annotation` |
| **Effort** | 1-2 jam masing-masing | |

---

### 10. Leaflet.js — Equipment Location Map

| Item | Detail |
|------|--------|
| **Masalah** | Field `lokasi` di equipment cuma teks. Tidak ada visualisasi geografis. |
| **Solusi** | **Leaflet.js** (OpenStreetMap, gratis) — tampilkan equipment di peta interaktif dengan marker. Cocok untuk asset tambang/pabrik luas. |
| **Effort** | 8-12 jam |

---

## ⚡ Quick Win (Implementasi < 1 Jam)

Kalau mau mulai dari yang paling gampang dan langsung kerasa dampaknya:

| # | Langkah | Waktu | Dampak |
|---|---------|-------|--------|
| 1 | Install `chartjs-plugin-datalabels` → register di `app.js` → lihat persentase di chart | 15 menit | 📈 Grafik lebih informatif |
| 2 | Buat `.github/workflows/deploy.yml` untuk auto-deploy | 30 menit | ⏱️ Hemat manual build & deploy |
| 3 | Install **Alpine DevTools** extension di Chrome | 2 menit | 🐛 Debugging lebih mudah |
| 4 | Setup ESLint + Prettier | 30 menit | 🧹 Kode konsisten |

```bash
# Quick win commands
npm install chartjs-plugin-datalabels
npm install --save-dev eslint prettier eslint-config-prettier
npx eslint --init
```

---

## 📊 Roadmap Implementasi

### Fase 1 — Foundation (Minggu ini)
- [ ] **Sentry** — error tracking production
- [ ] **GitHub Actions** — auto deploy + backup
- [ ] **chartjs-plugin-datalabels** — quick visual win
- [ ] **ESLint + Prettier** — code quality

### Fase 2 — Enhancement (2-3 minggu)
- [ ] **State management** — refactor `app.js` ke store terpisah
- [ ] **Push notifications** — alert WO urgent & low stock
- [ ] **Lighthouse CI** — performance gates

### Fase 3 — Power Features (Bulan depan)
- [ ] **TypeScript** — migrasi gradual
- [ ] **FullCalendar** — visual PM scheduling
- [ ] **Leaflet.js map** — asset geolocation
- [ ] **PDF advanced** — pdf-lib untuk laporan kompleks

---

## 🔗 Referensi

- [Sentry JavaScript SDK](https://docs.sentry.io/platforms/javascript/)
- [Firebase Hosting GitHub Action](https://github.com/FirebaseExtended/action-hosting-deploy)
- [Zustand](https://github.com/pmndrs/zustand)
- [FullCalendar](https://fullcalendar.io/docs)
- [Leaflet.js](https://leafletjs.com/)
- [Chart.js Plugins](https://www.chartjs.org/docs/latest/developers/plugins.html)
- [Alpine DevTools](https://github.com/alpinejs/alpine-devtools)

---

*Dokumen ini akan diupdate seiring perkembangan project.*
