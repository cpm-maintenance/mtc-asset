# MTC-ASSET — Flowchart Aplikasi

Diagram alur utama: startup, autentikasi, kontrol peran (RBAC), dan navigasi modul.

## 1. Flowchart Utama (Startup → Login → Dashboard)

```mermaid
flowchart TD
    START([Browser Buka App]) --> INIT["Kickoff Bootstrap<br/>bootstrap.js init()"]
    INIT --> THEME["Apply Theme<br/>data-theme = localStorage<br/>(default dark)"]
    THEME --> AUTHOBS["Firebase onAuthStateChanged<br/>pantau sesi"]
    AUTHOBS --> CHECK{User sudah login?}
    CHECK -- No --> LOGIN["Tampil Login Screen<br/>System Access"]
    LOGIN --> LOGINFORM["Input Authentication ID +<br/>Secure Key (Firebase Auth)"]
    LOGINFORM --> VALID{Valid?}
    VALID -- No --> LOGINERR["Notification: Login failed"] --> LOGIN
    VALID -- Yes --> ROLE["checkUserRole(uid)<br/>set userRole"]
    CHECK -- Yes --> ROLE

    ROLE --> ROLE_BRANCH{Role apa?}
    ROLE_BRANCH -- admin --> ADMIN["AKSES PENUH<br/>semua menu + AI + Audit"]
    ROLE_BRANCH -- supervisor --> SUP["Supervisor<br/>tanpa Audit/AI/Foreign"]
    ROLE_BRANCH -- user --> USR["User<br/>menu dasar + WO + parts"]

    ADMIN --> LOAD["setupFirebaseListeners<br/>loadPMSchedule<br/>loadAISettings"]
    SUP --> LOAD
    USR --> LOAD
    LOAD --> DB["Baca data dari Firebase<br/>(Equipment, WO, Parts, Performance)"]
    DB --> DASH([Dashboard]<br/>card + chart + panic stat)
    DASH --> NAV["Navigasi sidebar / bottom-nav<br/>berdasarkan canAccess"]
```

## 2. Login & Logout

```mermaid
stateDiagram-v2
    [*] --> NotLoggedIn
    NotLoggedIn --> Validating: submit login
    Validating --> NotLoggedIn: gagal (error notification)
    Validating --> LoggedIn: sukses (setPersistence session)
    LoggedIn --> NotLoggedIn: logout (konfirmasi + signOut)
    LoggedIn --> LoggedIn: refresh token
```

## 3. Role-Based Access (RBAC)

```mermaid
graph LR
    ROLE[userRole] -->|admin| A[Semua modul]
    ROLE -->|supervisor| S[PM, Planning, Workload,<br/>Perf, MTBF/MTTR]
    ROLE -->|admin/supervisor| AS[WO Input, All Logs<br/>supervisor gated]
    ROLE -->|user| U[WO, Equip, Parts,<br/>Request, Logs, History]

    classDef ace fill:#ff8c1a,stroke:#ff8c1a,color:#05070a,font-weight:bold
    class A,ace ace
```

## 4. Modul Menu per Grup

```mermaid
flowchart LR
    MENU[Menu Items] --> MON[Monitoring: Dashboard]
    MENU --> MNT[Maintenance: WO, PM Schedule, Equipment]
    MENU --> PLN[Planning: Planning Board, Monthly Plan, Workload]
    MENU --> LOG[Logs: All Logs, History Card, Audit Trail]
    MENU --> INV[Inventory: Spare Parts, Request Part]
    MENU --> ANA[Analytics: Perf, MTBF/MTTR, Enterprise KPI, KPI, AI]

    subgraph ROLE_GATES[Role Gates]
        MON
        SUP["supervisor only:<br>PM Schedule, Planning,<br>Monthly Plan, Workload"]
        ADM["admin only:<br>Audit Trail, Enterprise KPI,<br>KPI Analytics, AI Analysis"]
    end

    classDef gate fill:#05070a,stroke:#ffb74d,color:#ff8c1a
    class MON,MNT,PLN,LOG,INV,ANA,SUP,ADM,MENU_GATES gate
```

> [!NOTE]
> Akses dikontrol fungsi `canAccess(item)` di [app.js](file:///d:/Coding/MTC-Asset/src/js/app.js): `allowedRole` `undefined`=all, `admin`=admin-only, `supervisor`=admin+supervisor.

## Rendering

- Salin blok ```mermaid``` ke editor yang mendukung (VS Code + Mermaid, mermaid.live, atau GitHub).
- Styling pakai `classDef` Mermaid.
