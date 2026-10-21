# Chunk `main-*.js` keluar dari jalur login (S33p lanjutan)

**Tanggal**: 2026-10-21 · **Repo**: `D:\CODING\MTC-Asset` · **Kartu**: `t_bea98211`

## Kenapa

S33p sudah mengeluarkan SDK Realtime Database dari jalur login (TBT live 349 → 115 ms).
Sisa biaya terbesar di jalur itu adalah **`main-*.js`** — entry chunk yang berisi
`app.js` (2.604 baris) + 13 modul mixin + Alpine:

| bukti (live, sw v33) | angka |
|---|---|
| `bootup-time` `main-*.js` (devtools throttling) | **402 ms** (357 ms scripting) |
| `unused-javascript` `main-*.js` (simulate) | **47,2 KiB dari 54,2 KiB** |
| TBT tersisa | 115 ms |
| main-thread tersisa | 1408 ms |

Halaman login tidak memakai hampir semua isi chunk itu — yang dipakai hanya status
login, toast, tema, dan tiga metode auth. Karena itu parse+execute-nya murni biaya
di perangkat pengguna, bukan pekerjaan.

## Sasaran

1. `main-*.js` (app + 13 mixin) **tidak lagi diunduh** di halaman login.
2. `bootup-time` untuk chunk itu turun ke **0 ms di jalur login**; TBT live → ~0.
3. Login, dashboard, WO, PDF, dan seluruh 1.675 tes tetap jalan — tanpa perubahan
   perilaku yang bisa dilihat pengguna.

**Non-sasaran**: mengubah struktur `app()`, memecah 2.604 baris jadi beberapa chunk,
menyentuh RTDB (sudah selesai di S33p).

## Fakta lapangan (sudah diverifikasi, jangan diulang)

- `index.html` pra-shell: **0 referensi `$root`**. `public/pages/app-shell.html`
  (126 KB): **0 `$root`**, dan **tidak punya `x-data` sendiri** — semuanya bind ke
  `<body x-data="app()">`.
- Fragmen shell punya **12+ elemen top-level bersaudara** (`nav`, `main`, `footer`,
  7 modal, `div.showMoreMenu`, ...). **Jangan** membungkusnya satu root baru —
  `fixed`/`body > *` akan berubah. Tambahkan `x-data="app()"` ke tiap elemen
  top-level; `Alpine.data('app', ...)` mengembalikan **singleton**, jadi semua scope
  terikat ke objek yang sama.
- `login()` ada di `app.js`; `loginWithPIN`/`loginWithSSO`/`loginMode`/`setLoginMode`/
  `rememberedEmail`/`showLoginKey`/`loginForm` ada di **`modules/auth.js`**;
  `showNotification` ada di **`modules/ui.js`** (14 pemakaian) dan `applyTheme` juga
  di `modules/ui.js`.
- `login()` cuma butuh `window.auth` / `setPersistence` / `browserSessionPersistence` /
  `signInWithEmailAndPassword` / `signOut` (semuanya sudah eager di `firebase-core.js`)
  plus `this.showNotification()`.
- `bootstrap.js` melakukan dua hal berbeda: memasang listener auth (harus pra-login)
  dan pekerjaan pasca-auth (`checkUserRole`, `setupFirebaseListeners`, `loadAISettings`,
  `loadPMSchedule`, `setupRequisitionsListener`) + watcher (pasca-auth saja).

## Rancangan

### 1. Chunk "login" (eager)

Tetap di graf muat awal: `firebase-core.js`, `logger.js`, Alpine, `index.html`,
CSS, dan **satu modul state layar login**. Isinya diambil dari sumber yang ada
(tanpa duplikasi logika):

- `modules/auth.js` → **naik jadi eager** kalau impornya bersih (hanya
  `logger` + firebase auth + `showNotification` dari `ui.js`). Periksa dulu.
- `modules/ui.js` → pisahkan bagian yang dipakai login saja (state `notifications`,
  `showNotification()`, `applyTheme()`, `isOnline`) ke `modules/ui-core.js`;
  `ui.js` meng-`...`-spread `ui-core.js` supaya tetap satu sumber kebenaran.
- **Baru**: `modules/login.js` — state yang benar-benar dibaca markup login
  (`loginForm`, `loginMode`, `setLoginMode`, `rememberedEmail`, `showLoginKey`,
  `isLoggedIn`, `isLoading`, `notifications`) + `login()` + `logout()` +
  `showNotification()` + `applyTheme()`. Di-spread juga ke `app()` supaya perilaku
  pasca-login identik dan tidak ada dua implementasi.
- Dua handler `@keydown.window` di `<body>` memakai `showLogModal`/`openLogModal`
  (state shell) → **pindahkan ke fragmen shell** (elemen `main`), bukan ke login.

### 2. Chunk "app" (malas)

`app.js` + 13 modul + `bootstrap.js` menjadi chunk yang hanya dimuat setelah auth:

- `main.js` berhenti mengimpor `app.js` secara statis.
- `window.__loadApp()`: `await import('./js/app.js')` → `app()` → set
  `window.app = window.appState = instance` → `Alpine.data('app', () => instance)`.
  Idempoten seperti `window.__loadDataLayer()`.
- Listener auth pindah ke `main.js` (ringan): saat `user` ada →
  `await window.__loadAppShell()` → `await window.__loadDataLayer()` →
  `await window.__loadApp()` → `Alpine.initTree(host)` → panggil pekerjaan
  pasca-auth milik `bootstrap.js` (`app().onUser(user)`), lalu `isLoggedIn = true`.
  **Urutan `initTree` sebelum `isLoggedIn = true` wajib dipertahankan** (pelajaran S33m:
  kalau gate dibuka duluan, `x-page` belum punya target).
- `bootstrap.js`: `init()` tetap memasang watcher (dipanggil dari `app()`), dan
  bagian `onAuthStateChanged` dipecah jadi `onUser(user)`.

### 3. `index.html`

- `<body x-data="app()">` → `<body x-data="login()">`; `Alpine.data('login', ...)`
  didaftarkan di `main.js`.
- Handler `@keydown.window` 'n'/'l' pindah ke fragmen shell.

### 4. `public/pages/app-shell.html`

- `x-data="app()"` ditambahkan ke **setiap** elemen top-level.

## Penerimaan

| metrik | target |
|---|---|
| `main-*.js` di `modulepreload` `index.html` | **0 hit** |
| muatan login (JS+CSS gzip) | turun ≥ 40 KiB dari 120,3 KiB |
| `bootup-time` `main-*.js` di jalur login | **0 ms** |
| TBT live median (3 run `npm run lh:real`) | **≤ 60 ms** (dari 115 ms) |
| CLS live (`node scripts/cls-probe.mjs <url> 3 0.02`) | tetap **0,000** |
| `npm run typecheck && npm run lint && npm run test:run` | 0 error / 0 error / semua hijau |
| `npm run test:coverage` | tidak di bawah ratchet (jangan turunkan threshold) |
| `npm run build && npm run verify:precache` | OK |
| E2E | **5 passed** |
| perilaku | login PIN/email, dashboard, WO, PDF — sama seperti sekarang |

## Kendala & risiko

- `sw.js` → `CACHE_NAME` naik ke **v34** (`src/**`, `index.html`, `public/**` berubah).
- Jangan menurunkan threshold `vitest.config.js`; coverage hanya naik.
- `unused-javascript` hanya ada di mode `simulate`; `lh:real` (devtools) mengembalikan
  0 item — catat apa adanya.
- Jangan menaruh berkas sementara di root repo (eslint melintingnya).
- Tes yang membaca `main.js`/`bootstrap.js`/`index.html` sebagai sumber harus ikut
  diperbarui, **jangan** dihapus: `tests/login-critical-path.test.js`,
  `tests/data-layer-lazy.test.js`, `tests/bootstrap-module.test.js`, plus tes yang
  membaca markup login.
- Kalau `Alpine.data('login')` dan `Alpine.data('app')` sama-sama mengembalikan
  singleton, scope ganda tetap satu proxy — jangan membuat objek baru per elemen.
- Bila `initTree` dipanggil untuk fragmen yang sudah punya `x-data`, Alpine tetap
  memprosesnya; jangan memanggil dua kali (`host.dataset.loaded` sudah menjaga ini).
## Hasil probe scope (S33r) — MENENTUKAN, jangan diulang

`node scripts/alpine-scope-probe.mjs` (4 varian, halaman terpisah, `<body x-data="login()">`
+ `<div id="host">` + `<span x-text="probeValue">`, `app()` mendefinisikan `probeValue`):

| varian | cara | hasil |
|---|---|---|
| control | `setAttribute('x-data','app()')` → `innerHTML` → `initTree(host)` | **gagal** — `probeValue is not defined` (anak mencari scope `login()`) |
| a | atribut → `initTree(host)` kosong → `innerHTML` → `initTree(host)` | **gagal** |
| b | atribut → `initTree(document.body)` → `innerHTML` → `initTree(host)` | **gagal** |
| **c** | tanpa atribut di host; fragmen membawa **root `<div x-data="app()">`** sendiri | **LULUS** (`probeValue` = `SCOPE-OK`, tanpa error) |

Kesimpulan: `x-data` pada elemen host **tidak pernah** menjadi scope lewat `initTree`,
dalam urutan apa pun. Satu-satunya bentuk yang bekerja: **wrapper `<div x-data="app()">`
di dalam fragmen** (varian c).

Konsekuensi untuk rancangan:
- `#app-shell` di `index.html` **tidak** perlu (dan tidak boleh) diberi `x-data`;
  `main.js` cukup `innerHTML` + `Alpine.initTree(host)`.
- Handler `@keydown.window` shortcut n/l **pindah ke dalam wrapper**, bukan tetap di
  `#app-shell` — direktif di host akan terikat ke scope `login()`.
- Risiko CSS wrapper: **nol temuan statis** — `grep -c 'body *>'` di `style.css` dan
  `tactical.css` = 0, dan satu-satunya `:nth-child`/`:last-child` ter-scope ke
  `.skeleton-*` dan `#page-dash a.rounded-2xl`. Wrapper statis juga tidak membuat
  containing block untuk `position: fixed` (tidak ada transform/filter/contain).

## Hasil S33u — SELESAI, dan penyebab kegagalan S33t ternyata bukan scope

Percobaan ke-3 lulus seluruh gerbang. Yang memecahkan blokir bukan perubahan scope,
tapi **tiga `</div>` yatim di `public/pages/app-shell.html:1830-1832`** (sisa markup
import overlay, tepat sebelum crop modal).

Mekanismenya: fragmen itu seimbang di dalam dirinya sendiri (533 buka / 533 tutup
setelah yatim dihapus), tapi **tidak** seimbang setelah dibungkus wrapper — parser
HTML memakai `</div>` yatim pertama untuk menutup `<div x-data="app()">`, sehingga
`<template x-if="showCropModalOpen">` (satu-satunya node terikat yang jatuh di luar)
dievaluasi di scope `<body x-data="login()">` → `ReferenceError` tak tertangkap di
tengah `Alpine.initTree()` → sisa fragmen tidak ter-init → `app.logs = 0`.

Bukti (Chromium, `page.evaluate` atas fragmen + wrapper):

| fragmen | anak wrapper | node terikat di luar wrapper | `closest('[x-data]')` crop modal |
|---|---|---|---|
| lama (3 `</div>` yatim) | 19 | **1** | `login()` |
| setelah yatim dihapus | 20 | **0** | `app()` |

**Pelajaran metodologis**: membandingkan fragmen **tanpa** wrapper memberi DOM yang
identik di kedua versi (20 anak, crop modal tetap anak `#app-shell`) — baik di jsdom
maupun Chromium. Perbedaannya hanya muncul pada struktur yang benar-benar dikirim
(wrapper + fragmen). Uji parse harus memakai bentuk final, bukan fragmen telanjang.

**Temuan kedua**: Alpine 3.15 memanggil `init()` untuk **setiap** scope `x-data`
(`reactiveData["init"] && evaluate(el, reactiveData["init"])` di direktif `data`).
Begitu fragmen membawa wrapper sendiri, `bootstrap.init()` berjalan dua kali untuk
singleton yang sama → watcher, listener online/offline, dan penjadwalan chart
terdaftar ganda. Ditutup dengan guard `_booted`.

Hasil terukur (live, sw v35, commit `e01a7a7`): `modulepreload` tanpa chunk app,
muatan login **120,3 → 60,0 KiB gzip**, `app-*.js` 57,7 KiB jadi chunk malas,
**TBT 115 → 25 ms**, main-thread 1408 → 1289 ms, CLS probe 0,000, E2E 5 passed.
