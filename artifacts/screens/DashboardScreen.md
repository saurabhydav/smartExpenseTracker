# `src/screens/DashboardScreen.tsx` - In-Depth Technical Explanation

This file acts as the primary visual synthesizer. It is the "Landing Page" of the application. It pulls live states from `useAppStore` and aggregates them into visually digestible charts and lists.

---

### 1. Global Reactive Subscriptions (Lines 24-49)
```tsx
    const { transactions, categories, monthlyTotal, categorySpending, refreshAll } = useAppStore();

    useEffect(() => {
        refreshAll();
        const subscription = DeviceEventEmitter.addListener('TRANSACTION_UPDATED', () => {
            refreshAll();
        });
        return () => subscription.remove();
    }, []);
```
*   **Flow & Architecture**: React renders linearly Top-to-Bottom. The `useAppStore()` hook explicitly binds this Dashboard to the Zustand Global Memory.
    - If the user receives a text message in the background, `processSmartSms` parses it and silently fires `DeviceEventEmitter.emit('TRANSACTION_UPDATED')`. 
    - The `useEffect` hook in this component is actively listening to that specific radio frequency. Even if the user is doing nothing but staring at the screen, the event listener intercepts the broadcast, forces `refreshAll()` to pull the newly parsed SMS from the hard drive, and completely re-paints the entire dashboard automatically.

---

### 2. Time-Travel Aggregation (Lines 57-70)
```tsx
    const navigateMonth = (direction: number) => {
        let newMonth = selectedMonth.month + direction;
        let newYear = selectedMonth.year;

        if (newMonth > 12) {
            newMonth = 1; newYear++;
        } else if (newMonth < 1) {
            newMonth = 12; newYear--;
        }
        setSelectedMonth(newYear, newMonth);
    };
```
*   **Syntax Breakdown**: `direction` is passed as either `1` (forward) or `-1` (backward).
*   **Flow & Architecture**: This perfectly handles calendar wrap-around without requiring complex `Date` objects. If the user is on `Month 1` (January) and clicks back (`-1`), `newMonth` becomes `0`. The safety trigger activates `(newMonth < 1)`, forcing the month to wrap exactly to `12` (December) while simultaneously decrementing the `newYear` by one. Hitting `setSelectedMonth` mutates the global Zustand store, which triggers a localized SQLite query, entirely refreshing the pie charts to reflect historical data.

---

### 3. Deep Component Mapping & Geometry (Lines 131-166)
```tsx
        {topCategories.map((item, index) => (
            <View key={item.categoryId} style={styles.categoryRow}>
                <Text>{item.category?.name}</Text>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, {
                        width: `${calculatePercentage(item.total, monthlyTotal)}%`,
                        backgroundColor: item.category?.color,
                    }]} />
                </View>
            </View>
        ))}
```
*   **Syntax & Architecture**: 
    - `key={item.categoryId}` forces React's Differential Engine to track each row uniquely based on its DB ID. If a user deletes an expense, React doesn't waste CPU re-rendering all 5 rows; it finds the exact unique key and only deletes that single row from the screen.
    - **Dynamic CSS Geometry**: Traditional CSS widths are hardcoded (e.g., `width: 200px`). Here, the width is mathematically driven by the live database. If the user spent $500 on Food out of a total $1000 pie, `calculatePercentage` returns `50`. The inline style compiles exactly to `width: '50%'`. This visually stretches the `<View>` block smoothly halfway across the device screen, creating a dynamic bar chart without requiring heavy charting libraries.
