# `src/services/SubscriptionService.ts` - In-Depth Technical Explanation

This file contains the "Recurring Payment" heuristic detection engine. It scans the historical SQLite database, looks for overlapping price matrices, and attempts to predict future subscription charges.

---

### 1. Massive Historical Scanning (Lines 20-66)
```typescript
export async function detectSubscriptions(userId: number): Promise<DetectedSubscription[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [result] = await db.executeSql(`
    SELECT COALESCE(original_merchant, merchant) as merchant_key,
        merchant,
        GROUP_CONCAT(amount) as amounts,
        GROUP_CONCAT(date) as dates,
        COUNT(*) as count
    FROM transactions 
    WHERE type = 'debit' AND user_id = ? AND date >= ?
    GROUP BY COALESCE(original_merchant, merchant)
    HAVING COUNT(*) >= 2
  `, [userId, startDate]);
```
*   **Syntax Breakdown**: 
    - `GROUP_CONCAT()` is a powerful SQLite feature. Instead of returning 15 rows for "Netflix", it collapses them into a single row where the amounts column literally looks like `"199,199,199"`.
    - `HAVING COUNT(*) >= 2` executes purely inside C++ memory. It entirely filters out any one-off purchases. If you only bought "Pizza Hut" once in 6 months, it isn't even pulled into the Javascript layer, saving tremendous RAM.
*   **Flow & Architecture**: It pulls a massive 6-month subset. It groups by `original_merchant` (Netflix), string-concatenating all dates and amounts, creating a raw data frame that Javascript can easily loop through.

---

### 2. Time-Delta Heuristics (Lines 71-120)
```typescript
function detectPatternHeuristic(amounts: number[], dates: string[]) {
    // 1. Check if amounts are consistent (within 5% variance)
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountVariance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.05);
    if (!amountVariance) return null;

    // 2. Calculate intervals between dates
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
        const diffDays = Math.abs((new Date(dates[i]).getTime() - new Date(dates[i-1]).getTime()) / 86400000);
        intervals.push(diffDays);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // 3. Determine frequency
    if (avgInterval >= 25 && avgInterval <= 35) {
        frequency = 'monthly';
        confidence = 1 - Math.abs(avgInterval - 30) / 30; // 100% at exactly 30 days
    }
    // Require at least 60% confidence
    if (confidence < 0.6) return null;
}
```
*   **Syntax & Architecture**: 
    - **Step 1: Price Stability**: Subscriptions generally cost the same amount. If a user spends $40 at an Uber, then $2, then $80, it's not a subscription. The 5% variance check allows for minor tax fluctuations (e.g., $19.99 vs $20.01) but kills random spending intervals immediately.
    - **Step 2: Delta Matrix**: It converts the calendar dates into contiguous integers representing "Days Between Charges".
    - **Step 3: Confidence Gravity**: It checks if the average days between charges hovers around `30`. If the average is `30`, confidence is `1.0` (100%). If it's `25` days, the math naturally degrades the confidence score. If that score dips below 60%, the engine refuses to classify it as a subscription.

---

### 3. Graceful Database Upserts (Lines 146-161)
```typescript
export async function saveSubscriptions(subscriptions: DetectedSubscription[], userId: number) {
    const db = getDatabase();

    for (const sub of subscriptions) {
        await db.executeSql(`
      INSERT OR REPLACE INTO subscriptions (merchant, amount, frequency, next_date, is_active, user_id, original_merchant)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `, [sub.merchant, ...]);
    }
}
```
*   **Flow & Architecture**: This runs silently. `INSERT OR REPLACE` (SQLite Upsert) prevents duplicates. If the analyzer runs everyday at midnight and detects Netflix 30 times a month, it won't create 30 Netflix subscriptions. It collides with the `UNIQUE(merchant)` schema constraint and silently patches the row with the updated `next_date`.
