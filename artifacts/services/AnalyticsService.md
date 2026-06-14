# `src/services/AnalyticsService.ts` - In-Depth Technical Explanation

This file is purely mathematical. It contains highly sophisticated algorithms for predictive finance, parsing SQLite aggregates into "burn rates," trends, and predictive budget warnings.

---

### 1. Rolling 30-Day Predictive Analysis (Lines 33-126)
```typescript
export async function calculateBurnRate(userId: number, budgetLimit?: number): Promise<BurnRateData> {
    // 1. Get spending for the last 30 days (Rolling Window)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString().split('T')[0];

    const [result] = await db.executeSql(`
        SELECT date, SUM(amount) as total
        FROM transactions
        WHERE user_id = ? AND type = 'debit' AND date >= ?
        GROUP BY date ORDER BY date
    `, [userId, dateLimit]);
```
*   **Flow & Architecture**: It calculates a *Rolling Window Average*. 
    - If it only calculated average based on the *current month*, checking your phone on "April 2nd" would yield wildly inaccurate warnings because it only has 2 days of data.
    - Instead, it explicitly drops back 30 full days into the past. It groups spending by Day mathematically. It divides the literal total of 30 days by `30` to achieve the `dailyAverage`, completely smoothing out the statistical noise of expensive weekends vs cheap weekdays.

---

### 2. Hybrid Monthly Projection (Lines 72-95)
```typescript
    // 2. Get accurate spending for THIS current month so far
    const currentStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    // ... Fetch spentThisMonth
    
    // 3. Monthly Projection = Spent So Far + (Daily Average * Remaining Days)
    const monthlyProjection = spentThisMonth + (dailyAverage * daysRemaining);

    let daysUntilBudgetExhausted: number | null = null;
    if (budgetLimit && dailyAverage > 0) {
        const remaining = budgetLimit - spentThisMonth;
        daysUntilBudgetExhausted = remaining > 0 ? Math.floor(remaining / dailyAverage) : 0;
    }
```
*   **Syntax Breakdown**: `Math.floor(x)` rounds down. You cannot have "1.5 days remaining". If a person earns a budget of $1000, has spent $900, and burns $50/day, `Math.floor(100 / 50) = 2` days left.
*   **Flow & Architecture**: 
    - This algorithm merges *Literal History* with *Predictive Output*.
    - It takes the physical amount the user has actually spent in the present month, and mathematically marries it to the historical `dailyAverage` multiplied by however many days are left in the literal month calendar. This produces an extremely accurate `monthlyProjection` predicting exactly where the user will land on the 31st.

---

### 3. Dynamic Halving Trend Engine (Lines 97-115)
```typescript
    if (dailySpending.length >= 2) {
        const midpoint = Math.floor(dailySpending.length / 2);
        const firstHalf = dailySpending.slice(0, midpoint);
        const secondHalf = dailySpending.slice(midpoint);

        // Calculate averages for halves
        const firstHalfAvg = firstHalf.length ? ... : 0;
        const secondHalfAvg = secondHalf.length ? ... : 0;

        if (firstHalfAvg > 0) {
            trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
            if (trendPercentage > 10) trend = 'increasing';
            else if (trendPercentage < -10) trend = 'decreasing';
        }
    }
```
*   **Flow & Architecture**: How does the app know if you are improving or failing? 
    1. It takes the 30-day window and slices it directly down the middle using `.slice(0, midpoint)`.
    2. It calculates the average spend of the first 15 days, versus the average spend of the most recent 15 days.
    3. It performs a Percentage Delta formulation: `(New - Old) / Old * 100`.
    4. It establishes a threshold: Using `10%`, it mathematically determines whether your spending is 'increasing', 'decreasing' or just standard organic 'stable' variance.

---

### 4. Categorical NLP Generation (Lines 177-251)
```typescript
export async function generateInsights(userId: number, totalBudget?: number): Promise<SpendingInsight[]> {
    const insights: SpendingInsight[] = [];
    const burnRate = await calculateBurnRate(userId, totalBudget);
    
    // Budget warning
    if (burnRate.daysUntilBudgetExhausted !== null) {
        if (burnRate.daysUntilBudgetExhausted <= 5) {
            insights.push({
                type: 'warning',
                title: 'Budget Alert',
                description: `At current rate, budget exhausts in ${burnRate.daysUntilBudgetExhausted} days`,
                icon: 'warning',
            });
        }
    // ... Returns Array
```
*   **Flow & Architecture**: The UI cards in `InsightsScreen.tsx` don't possess raw math. This function translates raw statistical integers (`daysUntilBudgetExhausted=3`) into human-readable notification bodies and icon logic. It arrays them based on priority, outputting a completely digested array of `SpendingInsight` components ready perfectly for rendering.
