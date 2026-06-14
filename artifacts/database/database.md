# `src/database/database.ts` - In-Depth Technical Explanation

This file is massive because it handles all disk physical interactions natively using `react-native-sqlite-storage`. It manages migrations, deduplication, and enormous mathematical aggregation queries.

---

### 1. The Migration & Healing Engine (Lines 22-111)
```typescript
export async function initDatabase(): Promise<void> {
    db = await SQLite.openDatabase({ name: DATABASE_NAME, location: 'default' });

    // ... Migration v5: Add original_merchant column and backfill data
    const [versionResult] = await db.executeSql('PRAGMA user_version');
    const userVersion = versionResult.rows.item(0).user_version;

    if (userVersion < 5) {
        try { await db.executeSql('ALTER TABLE transactions ADD COLUMN original_merchant TEXT'); } catch (e) { }
        
        // HEAL DATA: Backfill original_merchant
        await db.executeSql('UPDATE transactions SET original_merchant = merchant WHERE original_merchant IS NULL');
        await db.executeSql('PRAGMA user_version = 5');
    }
}
```
*   **Syntax Breakdown**: `PRAGMA user_version` is a secret meta-variable hidden inside the SQLite file header. It acts like a save-game version tracker.
*   **Flow & Architecture**: This logic prevents catastrophic crashes when users download app updates. 
    1. A user updates the app from v1.0 to v2.0. The new Javascript code suddenly expects an `original_merchant` column.
    2. The moment the app launches, `initDatabase()` asks the SQL engine what version it is. The engine says `v4`.
    3. The `if (userVersion < 5)` block is triggered. It physically alters the user's hard drive table live, adds the missing column, mathematically back-fills all 5,000 old transactions to prevent `NULL` crashes, and iterates the tracker to `5`.

---

### 2. Deep Deduplication System (Lines 268-314)
```typescript
// Inside insertTransaction()
    if (checkDuplicates) {
        // Strong Check: If rawSms exists, use it (Perfect deduplication for SMS)
        if (transaction.rawSms) {
            const [existing] = await database.executeSql(
                'SELECT id FROM transactions WHERE user_id = ? AND raw_sms = ?',
                [transaction.userId, transaction.rawSms]
            );
            if (existing.rows.length > 0) return existing.rows.item(0).id;
        }
        // ... Weak Check: For manual entries (Check Amount, Date, Type) ...
    }
```
*   **Flow & Architecture**: 
    - The biggest threat to a financial app is double-counting a paycheck. When the automated background SMS scanner runs, it might read the same message twice.
    - Before ANY data is saved, the function intercepts the payload. It queries the database to see if the exact literal SMS string (`raw_sms`) already exists anywhere.
    - If it manually detects a collision, it aborts the `INSERT` operation, silently returns the ID of the old transaction, and fools the calling code into thinking the save was successful.

---

### 3. Mathematical Aggregations (Lines 569-620)
```typescript
export async function getCategorySpending(userId: number, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const [result] = await database.executeSql(
        `SELECT category_id, SUM(amount) as total FROM transactions 
         WHERE user_id = ? AND type = 'debit' AND date BETWEEN ? AND ?
         GROUP BY category_id`,
        [userId, startDate, endDate]
    );
     // ... Return array ...
}
```
*   **Syntax Breakdown**: 
    - `SUM(amount) as total`: Instructs the powerful, low-level SQLite C-engine to perform the mathematics instead of pulling the data into JavaScript and looping over it (which is incredibly slow).
    - `GROUP BY category_id`: Tells SQLite to collapse identical rows together based on their category ID.
*   **Flow & Architecture**: When the Dashboard wants to render the "Spending Pie Chart", it doesn't download 5,000 rows. It triggers this function, bounds the dates to the immediate month, and receives a hyper-compressed, perfectly sorted array (e.g., `[{ categoryId: 1, total: 45000 }, { categoryId: 2, total: 12000 }]`). This enables the pie chart to render instantly regardless of how many receipts the user actually has.

---

### 4. Cascade Simulation (Lines 626-642)
```typescript
export async function deleteCategory(id: number, userId: number): Promise<void> {
    await database.transaction((tx) => {
        // 1. Unlink transactions
        tx.executeSql('UPDATE transactions SET category_id = NULL WHERE ...');
        // 2. Unlink merchant mappings
        tx.executeSql('UPDATE merchant_mapping SET category_id = NULL WHERE ...');
        // 3. Delete the category
        tx.executeSql('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
    });
}
```
*   **Syntax Breakdown**: `database.transaction((tx) => { ... })` creates a "SQL Transaction Block" (A physical lock on the database where either ALL commands succeed, or NONE do).
*   **Flow & Architecture**: Because SQLite `ON DELETE CASCADE` is often disabled by default in limited mobile environments, the app must manage "Orphaned Data" manually. If a user deletes the "Shopping" category, the app must sequentially find every single receipt tagged as "Shopping" and neuter them by setting their category ID to `NULL` (which effectively relocates them to "Uncategorized"). Only after sanitizing the dependencies does it actually destroy the category node itself, maintaining perfect referential integrity.
