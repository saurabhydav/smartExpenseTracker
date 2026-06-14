# `src/screens/InsightsScreen.tsx` - In-Depth Technical Explanation

This file is a massive read-heavy graphical dashboard. It leverages powerful mathematical Service layers to generate visual SVGs and interactive analytics without relying on cloud computation.

---

### 1. Concurrent Background Processing (Lines 53-74)
```tsx
    const loadData = async () => {
        setIsLoading(true);
        try {
            const rate = await calculateBurnRate(user.id, totalBudget > 0 ? totalBudget : undefined);
            setBurnRate(rate);

            const insightsList = await generateInsights(user.id, ...);
            setInsights(insightsList);

            const subs = await getActiveSubscriptions(user.id);
            setSubscriptions(subs);
            // ... chart data
        }
        setIsLoading(false);
    };
```
*   **Flow & Architecture**: When the Insights tab is opened, it executes up to four immense data queries (Burn Rate, NLP Insights, Subscription Scanning, SVG Chart Matrices) against the `services/` layer. 
    - The asynchronous flow forces the UI to maintain an `<ActivityIndicator/>` until all four complex Promises resolve. 
    - None of these functions query the web; they are intensive local SQLite sweeps utilizing regex, variance mapping (`detectSubscriptions`), and comparative delta logic (`calculateBurnRate`). The heavy lifting is deliberately isolated in `/services/` so the screen only acts as a thin visual consumer of the final math.

---

### 2. High-Performance SVG Rendering (Lines 198-223)
```tsx
    <LineChart
        data={{
            labels: chartLabels,
            datasets: [{ data: chartValues.length > 0 ? chartValues : [0] }],
        }}
        width={width - 48}
        height={180}
        chartConfig={{ ... }}
        bezier
        style={styles.chart}
    />
```
*   **Syntax Breakdown**: Pure declarative JSX feeding structured objects.
*   **Flow & Architecture**: Drawing dynamic graphs organically in Native mobile is horribly difficult because Java/Objective-C use completely different painting engines. `LineChart` wraps a Native SVG library. 
    - The `chartLabels` and `chartValues` arrays perfectly map Cartesian coordinates (X, Y).
    - `width={width - 48}` calculates the exact hardware pixel geometry of the device chassis via `Dimensions.get('window')`, subtracting exactly 48 pixels for left/right padding. This mathematically ensures the graphic fits flawlessly on everything from a massive iPad to a tiny Android.
    - `bezier` forces the math to use cubic Bézier curves instead of rigid sharp lines, creating smooth waves that look incredibly premium.

---

### 3. Graceful Cross-Module Action Handlers (Lines 76-89)
```tsx
    const handleDetectSubscriptions = async () => {
        setIsLoading(true);
        try {
            const detected = await detectSubscriptions(user?.id || 0);
            setSubscriptions(detected);
            
            const cost = await getMonthlySubscriptionCost(user?.id || 0);
            setMonthlyCost(cost);
            Alert.alert('Complete', `Found ${detected.length} recurring payments`);
        } catch { ... }
        setIsLoading(false);
    };
```
*   **Flow & Architecture**: Although `SmartSmsProcessor` ideally detects subscriptions in the background invisibly, `detectSubscriptions` operates as a brute-force manual sweep. When the user taps the button, it kicks the entire `SubscriptionService` engine into gear. 
    - Once the background logic identifies a new matrix (e.g., matching Netflix amounts exactly 30 days apart), it updates SQL directly.
    - This function then immediately manually updates the local React state hooks (`setSubscriptions`, `setMonthlyCost`), forcing the DOM to visually populate the detected components in less than 200ms without the user needing to reboot the app.
