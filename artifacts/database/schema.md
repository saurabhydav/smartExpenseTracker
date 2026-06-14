# `src/database/schema.ts` - In-Depth Technical Explanation

This file is the architectural blueprint of the application's entire data model. Before any transactions can be saved or charts can be drawn, SQLite needs to know exactly what tables to build and what rules to enforce on the data.

---

### 1. TypeScript Interfaces (Lines 4-47)
```typescript
export interface Transaction {
  id: number;
  amount: number;
  type: 'debit' | 'credit';
  merchant: string;
  categoryId: number | null;
  userId: number;
  // ...
}
```
*   **Syntax Breakdown**: 
    - `interface`: A TypeScript construct that builds a strict data shape that only exists while the developer writes code (it disappears when compiled to JavaScript).
    - `type: 'debit' | 'credit'`: A literal union type. It mathematically blocks a developer from ever typing `tx.type = 'DEBT'` by throwing a red error in VSCode. 
*   **Flow & Architecture**: These interfaces act as translation layers. SQLite doesn't understand Javascript, it only returns raw typeless `any` data strings. When `database.ts` pulls a row out of the hard drive, it wraps it in this `Transaction` interface so that the rest of the application (like `DashboardScreen.tsx`) instantly gets auto-complete and type-safety.

---

### 2. SQL Table Creation (Lines 49-97)
```typescript
export const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#6366f1',
  budget_limit REAL,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(name, user_id)
)`
  // ... Other Tables
]
```
*   **Syntax Breakdown**:
    - `IF NOT EXISTS`: Crucial crash prevention. If the app opens for the second time, SQLite will try to execute this string. If the table is already there, it silently ignores the command instead of throwing a fatal error.
    - `PRIMARY KEY AUTOINCREMENT`: The database engine handles ID generation completely. When Javascript says `INSERT INTO categories (name) VALUES ('Food')`, it doesn't need to specify `id: 1`. SQLite automatically calculates the next available integer at the physical disk level.
    - `UNIQUE(name, user_id)`: Multi-column constraint. It physically prevents a user (e.g., `user_id: 5`) from creating two categories named "Food". However, user `6` can still create "Food" because the *combination* of the two columns isn't duplicated.
    - `REFERENCES categories(id)`: A Foreign Key constraint (on the transactions table). It guarantees that a transaction cannot point to a deleted category ID, preventing "orphan" data.

---

### 3. High Performance Indexing (Lines 99-104)
```typescript
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)`,
```
*   **Syntax Breakdown**: `CREATE INDEX [name] ON [table]([column])`.
*   **Flow & Architecture**: By default, if the app asks SQLite for "all transactions from March", the engine has to physically read every single row in the database from top to bottom (a Full Table Scan). As the user accumulates 5,000 receipts, the app would freeze for seconds. An `INDEX` builds a hidden binary tree on the hard drive sorted specifically by date. When the app asks for "March", the engine skips the first 4,000 non-March rows in milliseconds.

---

### 4. Default System Seeds (Lines 129-158)
```typescript
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Food & Dining', icon: 'restaurant', color: '#ef4444', budgetLimit: null },
  // ...
];

export const DEFAULT_MERCHANT_MAPPINGS = [
  { smsName: 'ZOMATO', displayName: 'Zomato', categoryId: 1 },
];
```
*   **Syntax Breakdown**: `Omit<Category, 'id' | 'createdAt' | 'userId'>[]` leverages TypeScript Utility Types. It forces the array to obey the exact shape of a `Category`, but temporarily strips out the `id`, `createdAt`, and `userId` requirements because those will be generated artificially by the database at insertion time.
*   **Flow & Architecture**: When a user registers a brand new account, their database is perfectly empty. The `database.ts` initialization engine uses these two arrays as "Bootstrap Data". It loops over them and injects them into SQLite under the user's ID, so the moment they open the app, they have a fully functioning beautiful UI with pre-configured colors and SMS mapping rules without having to do hours of manual setup.
