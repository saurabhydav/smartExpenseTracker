# Expense Tracker Architecture & High-Level Flows

This document details the complete end-to-end architecture of the mobile application. It breaks down the interaction between the React Native UI layer, the Global State Cache (Zustand), the complex local SQLite Persistence layer, Native Device modules (Biometrics, SMS, File System), and external cloud interactions (Node.js/Google Drive).

---

## 🏗️ 1. Complete System Architecture Diagram

```mermaid
graph TD
    %% Define Styles
    classDef ui fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff
    classDef state fill:#8b5cf6,stroke:#5b21b6,stroke-width:2px,color:#fff
    classDef core fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff
    classDef data fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff
    classDef native fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff
    classDef cloud fill:#6b7280,stroke:#374151,stroke-width:2px,color:#fff

    %% Components
    subgraph "React Native UI Layer"
        UI_Core[Dashboard / Transactions / Budgets]:::ui
        UI_Dash[Insights & Charts]:::ui
        UI_Settings[Settings & BioLock]:::ui
    end

    subgraph "Global State Management"
        Store[useAppStore (Zustand In-Memory Cache)]:::state
    end

    subgraph "Core Business Logic (Services)"
        Srv_SMS[SmartSmsProcessor]:::core
        Srv_Parser[ExpenseParser Regex Engine]:::core
        Srv_Auth[AuthService & API (Axios)]:::core
        Srv_Ana[Analytics & Subscriptions]:::core
        Srv_Rep[Report & BackupService]:::core
    end

    subgraph "Local Persistence"
        DB[(SQLite Embedded Engine)]:::data
    end

    subgraph "Native OS Integrations"
        Nat_SMS[HeadlessJS / OS SMS Receiver]:::native
        Nat_Bio[Biometrics & OS Keychain]:::native
        Nat_PDF[Native File Generator / Share Sheet]:::native
    end

    subgraph "Cloud / External"
        Ext_Node[Remote Node.js Backend]:::cloud
        Ext_GDrive[Google Drive API]:::cloud
    end

    %% Routing
    UI_Core <--> Store
    UI_Dash <--> Store
    UI_Settings <--> Store

    %% State to DB
    Store <--> DB
    
    %% Services
    Srv_Ana --> DB
    Srv_Ana -.-> UI_Dash
    
    %% Auth Flow
    UI_Settings --> Srv_Auth
    Srv_Auth <--> Nat_Bio
    Srv_Auth <--> Ext_Node

    %% SMS Pipeline
    Nat_SMS --> Srv_SMS
    Srv_SMS --> Srv_Parser
    Srv_SMS --> DB
    Srv_SMS -.->|DeviceEvent Emit| Store

    %% Backup & Reports
    Srv_Rep --> DB
    Srv_Rep --> Nat_PDF
    Srv_Rep <--> Ext_GDrive
    UI_Settings --> Srv_Rep
```

---

## 🌊 2. Detailed Technical Flow Breakdowns

### Flow A: The Autonomous SMS Pipeline (Background Daemon)
The core feature of this application is its ability to track money without the user ever opening the app. This requires an intricate pipeline connecting native OS radio signals to Javascript logic.

1. **The Native OS Trigger**: The Android Operating System receives a raw SMS from a bank sender (e.g., `HDFC` or `AMEX`).
2. **HeadlessJS Awakening**: Without launching the visual UI, Android boots up a tiny background Javascript thread (HeadlessJS) via `SmsHandler.ts`.
3. **Regex Interception**: The `SmartSmsProcessor` wakes up and immediately hands the text payload to the `ExpenseParser`. The Regex engine tears the text apart, locating currency symbols (`₹`, `$`), exact transaction amounts, timestamps, and the raw merchant name (e.g., `"UBER-MUMBAI-INC"`).
4. **Algorithmic Cleanup & ML Mapping**: The processor cross-references the raw string against the local `merchant_mapping` SQLite table. If it finds a rule, it immediately converts the ugly string into `"Uber"` and assigns it the category `"Transport"`.
5. **Database Upsert**: It constructs a definitive object and fires an isolated SQLite `INSERT` into the `transactions` table.
6. **Radio Broadcast**: It triggers a global React Native `DeviceEventEmitter`. If the user happens to be looking at the dashboard, the event listener intercepts the broadcast, tells Zustand (`useAppStore.ts`) to dump its RAM, queries the newly patched SQLite table, and perfectly animates the fresh pie charts into existence without any user interaction.

---

### Flow B: Self-Healing Authentication
The app connects to a secure Node.js backend. User sessions last for varying periods, meaning the client architecture must seamlessly negotiate cryptographic tokens behind the scenes.

1. **Initial Login (`AuthService`)**: The user signs in. The Node backend returns a short-lived `accessToken` (15 mins) and a long-lived `refreshToken` (30 days). The service writes both of these securely into the hardware OS Keychain.
2. **API Injection (`api.ts`)**: Every time the app needs the internet (e.g., syncing), Axios middleware pauses the outbound HTTP request. It dips into the native keychain, attaches the `Bearer accessToken` header, and releases the packet.
3. **The 401 Refresh Trap**: If the user uses the app two hours later, their `accessToken` is dead. The server rejects the packet with a `401 Unauthorized` error.
4. **Invisible Resurrection**: The `api.ts` interceptor catches the crash *before* it hits the UI. It pauses the app timeline. It stealthily requests a fresh Key from the server using the 30-day `refreshToken`. It saves the new key, injects it into the *original dead request*, and fires it a second time. To the user, a button press took 150ms longer, but they were never kicked out to the lock screen.

---

### Flow C: Heavy Computation Analytics (The Offload Strategy)
The app must render complex geometrical shapes, variance statistics, and burn rates over thousands of transactions. Mobile phones have poor single-core CPU threading.

1. **The C++ Delegation**: If the user opens `InsightsScreen.ts`, it does *not* ask SQLite to send 4,000 transaction rows to Javascript to count them. That would cause heavy battery drain and UI freezing.
2. **High-Velocity Aggregation**: Instead, `AnalyticsService.ts` executes massive `GROUP BY` and `SUM` queries at the SQLite layer. The underlying C++ engine loops the 4,000 rows in microseconds, returning a tiny finalized matrix (e.g., `[{category: 'Food', count: 42, total: 1095}]`) across the Native Bridge.
3. **Client-Side Mathematics**: Javascript then receives this lightweight payload. It runs rapid mathematical deviations (Burn Rate Deltas, Trailing 30-day Variances) and produces English-Language NLP text (e.g., *"Your spending on Food is up 12% this month"*).
4. **SVG Compilation**: Finally, the pure statistical dataset is fed into `react-native-chart-kit`, which geometrically draws cubic Bézier curves (SVGs) smoothly on the screen.

---

### Flow D: Multi-Layer Security & Fallbacks
Security is designed as a series of impassable brick walls combined with graceful technical fallbacks if hardware fails.

1. **Entry Gate (Hardware Lock)**: When `App.tsx` mounts, it invokes `BiometricLockScreen`. This uses native hardware hooks to demand Fingerprint/FaceID. It overrides the physical Android "Back" button, ensuring the user cannot swipe away the overlay.
2. **Offline Mode First**: Because the `useAppStore` acts as a local cache mirroring an encrypted local SQLite database, the app functions flawlessly in airplane mode.
3. **Graceful Native Module Degradation**: When exporting a Report (`ReportService.ts`), the code builds a raw HTML string and attempts to locate the Native Java/Objective-C `PdfGenerator` bridge. If the user's phone cannot generate PDFs, the code does not crash. It catches the module failure dynamically, shreds the HTML payload, drops down to standard plain text, and invokes the OS Share Sheet (`WhatsApp/AirDrop`) with a text summary instead.
4. **Encrypted Cloud Dumping**: When backing up, `BackupService` intercepts the literal `.sqlite` binary file. It encrypts the raw binary using AES mechanisms before dispatching it to an isolated Google Drive partition (`appDataFolder`) that is utterly invisible to the user and other malicious apps installed on their phone.
