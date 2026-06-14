# `src/store/useAppStore.ts` - In-Depth Technical Explanation

This file establishes the **Global Brain (State)** of the app using `Zustand`, a minimalist state manager. It combines UI Navigation memory, backend Auth Sessions, and heavy Database Syncing into one central location.

---

### 1. State Shape and Typings (Lines 9-43)
```typescript
interface AppState extends AuthState, ExpenseState {
    setAuthenticated: (value: boolean) => void;
    loadTransactions: (limit?: number) => void;
    // ... Defines exactly what functions and arrays exist in memory
}
```
*   **Syntax Breakdown**: We use TypeScript `interface` to construct a schema strictly enforcing what the Global Store is allowed to hold. By extending `extends AuthState, ExpenseState`, it modularly combines login credentials and arrays of expenses into one master blueprint.

---

### 2. Core Store Initialization & Persistence (Lines 50-71)
```typescript
export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            isAuthenticated: false,
            // ... variables
            currencySymbol: '₹',
            
            // Selected month for filtering
            selectedMonth: getCurrentMonth(),
```
*   **Syntax Breakdown**: 
    - `create()()` is a standard Zustand function that summons the state container. 
    - `persist()` is a powerful Zustand middleware wrapper. It intercepts everything inside the store.
    - `(set, get)`: `set` merges new data into the store, while `get` reads the live current state of the store from inside another function.
*   **Flow & Architecture**: The moment the user opens the app, this engine springs to life in physical RAM. However, because it is wrapped in `persist()`, it behaves powerfully: whenever `set` is called, it actively writes a ghost-copy of the variables to local async storage on the phone's hard drive.

---

### 3. The Authentication Switch (Lines 76-98)
```typescript
            checkAuth: async () => {
                set({ isLoading: true });
                try {
                    const isAuth = await authService.isAuthenticated();
                    set({ isAuthenticated: isAuth, isLoading: false });
                    return isAuth;
                } catch { ... }
            },
```
*   **Logical Flow**: This is the gatekeeper payload. When the root `App.tsx` loads, it triggers this specific function. This function calls `authService.isAuthenticated()` (which checks the device Keychain/Encrypted OS Vault for a JWT token). If it finds the keyline, it flips `isAuthenticated` to TRUE globally. Every screen in the App is implicitly subscribed to this variable, causing the "Login Screen" to disappear and the "Dashboard" to fade into view seamlessly.

---

### 4. Data Sync Queries (Lines 100-144)
```typescript
            loadTransactions: async (limit = 50) => {
                const { user, selectedMonth } = get();
                if (!user) return; // Guard clause

                try {
                    const startDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`;
                    const endDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-31`;

                    const transactions = await getTransactions(user.id, limit, 0, startDate, endDate);
                    set({ transactions });
                } catch (error) { ... }
            },
```
*   **Syntax Breakdown**: `String(month).padStart(2, '0')` forces a single-digit integer `(3)` into a two-digit mathematical string `("03")`. This correctly formats the boundaries for strict SQL date engines (`2024-03-01`).
*   **Flow & Architecture**: 
    1. Whenever `loadTransactions` is triggered by a UI refresh, it relies instantly on `get()`. It reads the currently assigned `user` ID and the `selectedMonth` from its own memory banks.
    2. It strings together an exact SQL calendar boundary (`YYYY-MM-01` to `YYYY-MM-31`). Note: SQLite handles impossible dates gracefully (like Feb 31st), clamping it.
    3. It passes these gates into `getTransactions()` out of `database.ts`.
    4. Upon receiving the JSON array back from SQLite, it pushes the payload down into `set({ transactions })`. The UI instantly repaints the list.

---

### 5. Multi-Threaded UI Refresh Array (Lines 146-164)
```typescript
            refreshAll: async () => {
                const { loadTransactions, loadCategories, loadMonthlyStats, user } = get();
                if (!user) return;

                await Promise.all([
                    loadCategories(),
                    loadTransactions(),
                    loadMonthlyStats()
                ]);
            },

            setSelectedMonth: (year, month) => {
                set({ selectedMonth: { year, month } });
                const { loadTransactions, loadMonthlyStats } = get();
                loadTransactions();
                loadMonthlyStats();
            },
```
*   **Syntax Breakdown**: `Promise.all()` accepts an array of distinct asynchronous commands and executes them literally simultaneously.
*   **Flow & Architecture**:
    *   **`refreshAll`**: Used strictly on Dashboard pull-to-refresh headers. By wrapping all 3 heavy SQLite aggregations into `Promise.all`, the JavaScript engine runs them in parallel. This forces the device CPU to process the pie chart query, transaction query, and categorical query simultaneously, slashing load times significantly.
    *   **`setSelectedMonth`**: Governs "Time Travel" navigation. If a user clicks the "<- Prev Month" arrow, it forcefully modifies the `selectedMonth` state object in memory. Without skipping a beat, it extracts the new parameter and aggressively forces the transaction lists to re-fetch from SQL, pulling up the March data and overwriting the April data.

---

### 6. Persistance Filters (Lines 166-175)
```typescript
        {
            name: 'expense-tracker-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                user: state.user,
                currencySymbol: state.currencySymbol,
            }),
        }
```
*   **Syntax/Flow**: `partialize` acts an amnesia filter for the `persist` middleware. While the store processes gigantic lists of transactions in RAM, `partialize` restricts physical hard-drive backup to *solely* the user object and global currency string.
*   **Why?**: We do NOT want to physically save 10,000 transactions to `AsyncStorage` when they are already physically saved securely inside `SQLite`. Syncing them to AsyncStorage would radically duplicate memory, destroying performance and disk space. `partialize` perfectly limits the global state to remember "Who" the user is upon waking up, while delegating raw data memory retrieval to the SQL queries inside `App.tsx`'s startup routines.
