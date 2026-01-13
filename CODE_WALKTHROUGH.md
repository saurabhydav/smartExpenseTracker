# Expense Tracker - The "No-Nonsense" Code Guide

**Target Audience:** A developer who knows how to code but has never touched React Native or Spring Boot.

---

## 🏗️ PART 1: The Tech Stack (In Plain English)

### 📱 Frontend: React Native
Think of this as **"JavaScript building Native Apps"**.
*   **Components (`.tsx` files)**: These are like Lego blocks. A button, a list item, or an entire screen (Page) is a "Component". It's a function that returns UI code (JSX).
*   **State (`useState`)**: Data that changes over time. If `counter` is 0 and you click a button to make it 1, that `counter` is "State". When State changes, the UI automatically redraws.
*   **Hooks (`useEffect`)**: Special functions that hook into the lifecycle. "Do this when the screen loads" or "Do this when variable X changes".
*   **Zustand (`useAppStore`)**: A global cloud of variable storage. Instead of passing data from Parent -> Child -> Grandchild, any component can just grab data from the Store directly.

### 🖥️ Backend: Spring Boot (Java)
Think of this as **"The Enterprise Manager"**.
*   **Controller**: The Receptionist. Waits for web requests (HTTP GET/POST), checks your ID (Auth), and passes you to the right department.
*   **Service**: The Worker. This is where the actual logic happens (hashing passwords, calculating totals).
*   **Repository**: The Archivist. The ONLY one allowed to talk to the Database (MySQL). It translates Java objects into SQL queries automatically (JPA).
*   **Entity**: A Blueprint. A Java class that matches a Database Table exactly.

---

## 🚀 PART 2: Frontend Walkthrough (Mobile)

### 📂 Key Folders
*   **`src/screens`**: Full-page views (Dashboard, Settings).
*   **`src/components`**: Reusable widgets (The "New Merchant" popup, Transaction List Item).
*   **`src/services`**: The logic brains (SMS parsing, Database helpers). Non-UI code.
*   **`src/database`**: Direct SQL code for the local phone database.

### 📜 Critical Files & Flows

#### 1. `App.tsx` (The Entry Point)
*   **What it does**: This is the first file that runs. It decides: "Are you logged in?"
    *   **Yes**: Show the `MainTabs` (Dashboard, etc.).
    *   **No**: Show the `AuthStack` (Login/Signup).
*   **Key Code**:
    ```typescript
    // If state.isAuthenticated is true, show App, else Login
    {isAuthenticated ? <AppStack /> : <AuthStack />}
    ```

#### 2. `src/services/SmartSmsProcessor.ts` (The Brain)
*   **What it does**: This captures SMS, parses them, and saves them.
*   **The Flow**:
    1.  **Receive**: `processSmartSms()` is called with an SMS body.
    2.  **Filter**: Checks `isTransactional()` (ignores OTPs/Spam).
    3.  **Parse**: Calls `ExpenseParser.ts` to extract Amount, Merchant, Type (Debit/Credit).
    4.  **Resolve Account**: "Is this HDFC ending in 1234?" -> Finds or creates an ID in `accounts` table.
    5.  **Save**: Inserts into SQLite `transactions` table.
    6.  **Broadcast**: `DeviceEventEmitter.emit('TRANSACTION_UPDATED')`. This yells "HEY! I SAVED SOMETHING!" to the rest of the app for instant updates.

#### 3. `src/screens/DashboardScreen.tsx` (The Face)
*   **What it does**: Shows your money summary.
*   **Instant Update Logic**:
    ```typescript
    useEffect(() => {
        // When 'TRANSACTION_UPDATED' is yelled, run refreshAll()
        const sub = DeviceEventEmitter.addListener('TRANSACTION_UPDATED', refreshAll);
        return () => sub.remove();
    }, []);
    ```
    *This is why the app updates instantly without reloading.*

#### 4. `src/database/database.ts` (The Memory)
*   **What it does**: Wraps SQLite queries in Promises so we can use `await`.
*   **Key Function**: `initDatabase()`
    *   Creates tables (`CREATE TABLE IF NOT EXISTS...`)
    *   Runs migrations (adding new columns without deleting user data).
    *   Seeds default categories (Food, Travel) for new users.

---

## ⚙️ PART 3: Backend Walkthrough (Server)

### 📂 Architecture Layers
**Request** -> `AuthController` -> `AuthService` -> `UserRepository` -> **MySQL DB**

### 📜 Critical Files

#### 1. `AuthController.java` (The Receptionist)
*   **Endpoints**:
    *   `POST /api/auth/login`: Takes email/pass. Returns JWT Token.
    *   `POST /api/auth/signup`: Registers new user.
*   Let's look at Login:
    ```java
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        // 1. Authenticate (Check user/pass)
        authManager.authenticate(...);
        // 2. Generate Token
        String token = jwtUtil.generateToken(...);
        // 3. Return Token
        return ResponseEntity.ok(new AuthResponse(token));
    }
    ```

#### 2. `AuthService.java` (The Worker)
*   Handles the business logic.
*   **Signup Logic**:
    1.  Check if email already exists (`repository.existsByEmail`).
    2.  Hash the password (Never save plain text!). `passwordEncoder.encode(pass)`.
    3.  Save the new User object.

#### 3. `UserRepository.java` (The Archivist)
*   It looks empty! Why?
    ```java
    public interface UserRepository extends JpaRepository<User, Long> {
        Optional<User> findByEmail(String email);
    }
    ```
    *   **Magic**: Spring Boot *automatically* generates the SQL code for `findByEmail` just by reading the function name. You don't need to write `SELECT * FROM users...`.

#### 4. `JwtAuthenticationFilter.java` (The Bouncer)
*   Every request to the server goes through here.
*   It checks the Header: `Authorization: Bearer <TOKEN>`.
*   If the token is fake or expired -> **401 Unauthorized** (Access Denied).

---

## 📊 PART 4: Database Schemas

### Mobile Database (SQLite - Offline Privacy)
Keeps detailed financial data LOCALLY.
*   **`transactions`**: The main ledger.
    *   `id`, `amount`, `merchant` (Who), `category_id` (What), `user_id` (Whose).
*   **`merchant_mapping`**: Parameter rules.
    *   `sms_name`: "UPI-PAYTM-UBER"
    *   `display_name`: "Uber"
    *   *System*: When an SMS matches `sms_name`, it auto-swaps it to `display_name`.
*   **`accounts`**: Bank accounts.
    *   `bank_name` ("HDFCBK"), `last_4` ("1234").
    *   *Unique Constraint*: Unique per User+Bank+Last4. (Avoids duplicates).

### Backend Database (MySQL - User Management)
Keeps ONLY account access data.
*   **`users`**:
    *   `id`, `email`, `password_hash`, `name`, `created_at`.
    *   *Purpose*: Just to log you in. It knows NOTHING about your spending.

---

## 🧠 Summary of How It All Works Together
1.  **You Open App**: Mobile checks generic storage for a JWT Token.
    *   *Found?* Mobile validates it with Backend. Success -> **Dashboard**.
    *   *Not Found?* **Login Screen**.
2.  **SMS Arrives**:
    *   Mobile's background listener wakes up (even if app is closed).
    *   Regex Parser reads: "Debit Rs 100 to Starbucks".
    *   SQLite saves it.
    *   UI Listener fires -> Dashboard total drops by 100.
    *   **Note**: This happens 100% on the phone. Backend never sees "Starbucks".

This architecture is called **"Local-First"**. It maximizes speed and privacy, using the cloud only for identity.

---

## 🕵️ PART 5: Step-by-Step Code Execution Trace

Here is exactly what happens in the code when **"You receive an SMS from HDFC Bank"**.

### T=0: Android System receives SMS
*   **File**: `android/.../SmsReceiver.java` (Native Android Code)
*   **Action**: Android OS wakes up our app and runs a "Headless Task".
*   **Code**: `reactNativeHost.getReactInstanceManager().getCurrentReactContext().getJSModule(...)`

### T=1: JavaScript Processing Starts
*   **File**: `src/services/SmsHandler.ts`
*   **Function**: `SmsHandler()`
*   **Trace**:
    ```typescript
    // 1. Receive the event
    const handleSms = async (event) => {
        // 2. Pass it to the Smart Processor
        await processSmartSms(event.text, event.sender, userId);
    }
    ```

### T=2: Filter & Parse (The Brain)
*   **File**: `src/services/SmartSmsProcessor.ts`
*   **Function**: `processSmartSms`
*   **Trace**:
    ```typescript
    // 1. Check if it's a real bank (ignore OTPs)
    if (!validateTransactionSms(sms)) return;

    // 2. Extract Data (Amount: 500, Type: Debit)
    const parsed = parseExpenseWithRegex(sms, isKnownSender);
    // -> Calls src/services/ExpenseParser.ts
    //    Retuns: { amount: 500.00, merchant: "Starbucks", type: "debit" }
    ```

### T=3: Database "Upsert" (The Memory)
*   **File**: `src/services/SmartSmsProcessor.ts`
*   **Function**: `resolveAccountId` & `insertTransaction`
*   **Trace**:
    ```typescript
    // 1. Find Bank Account ID (HDFC - 1234)
    //    If not exists, creates it instantly (INSERT INTO accounts...)
    const accountId = await resolveAccountId("1234", "HDFCBK");

    // 2. Save Transaction
    //    Checks for duplicates first (SELECT id FROM transactions WHERE...)
    const id = await insertTransaction({
        amount: 500,
        merchant: "Starbucks",
        accountId: accountId,
        user_id: 42
    });
    ```

### T=4: Instant UI Refresh (The Magic)
*   **File**: `src/services/SmartSmsProcessor.ts`
*   **Code**:
    ```typescript
    console.log("Transaction Saved!");
    // Yell to the whole app: "UPDATE NOW!"
    DeviceEventEmitter.emit('TRANSACTION_UPDATED');
    ```

### T=5: The Dashboard Reaction
*   **File**: `src/screens/DashboardScreen.tsx`
*   **Trace**:
    ```typescript
    // 1. Listener hears the shout
    DeviceEventEmitter.addListener('TRANSACTION_UPDATED', () => {
        // 2. Re-fetch all data from SQLite
        refreshAll(); 
    });
    
    // 3. Screen re-renders with new Total Balance
    ```
