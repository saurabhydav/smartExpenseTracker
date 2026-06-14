# `src/screens/BudgetScreen.tsx` - In-Depth Technical Explanation

This file bridges relational data structuring with mathematical limits, providing the visual interface for the "Envelope Budgeting" system.

---

### 1. Unified Relational State Synthesis (Lines 52-63)
```tsx
    const categoryData = safeCategories.map(category => {
        const spending = safeCategorySpending.find(cs => cs.categoryId === category.id);
        return {
            ...category,
            spent: spending?.total || 0,
            remaining: category.budgetLimit ? category.budgetLimit - (spending?.total || 0) : null,
            percentage: category.budgetLimit
                ? calculatePercentage(spending?.total || 0, category.budgetLimit)
                : 0,
        };
    }).sort((a, b) => b.spent - a.spent);
```
*   **Flow & Architecture**: The SQLite database structurally separates Categories (Names, Colors) and Transactions (Amounts, Timestamps). To build a budget screen, we need both.
    - Instead of doing an expensive SQL `JOIN` every time the UI re-renders, it leverages the pre-fetched Zustand arrays `safeCategories` and `safeCategorySpending`. 
    - It merges them geometrically in Javascript RAM (`map + find`).
    - During the merge, it calculates live limits (`budgetLimit - spent`) and transforms them into percentages for the progress bars. 
    - Finally, it `.sort()`s the array descending by `spent`, ensuring the categories bleeding the most cash naturally float to the very top of the user's screen automatically.

---

### 2. Live Dynamic Styling Engine (Lines 116-120 & 204-213)
```tsx
    const getProgressColor = (percentage: number): string => {
        if (percentage >= 100) return colors.debit; // Red
        if (percentage >= 80) return colors.warning; // Orange
        return colors.credit; // Green
    };

    // JSX Usage
    <View style={[styles.progressFill, {
        width: `${Math.min(category.percentage, 100)}%`,
        backgroundColor: getProgressColor(category.percentage),
    }]} />
```
*   **Syntax Breakdown**: Inline UI logic directly binds numerical thresholds to Color Hex codes. `Math.min(..., 100)` is a safety clamp. If a user spends 200% of their Food budget, forcing `width: 200%` would physically push the UI bar entirely outside the boundaries of the phone screen, breaking the layout. `Math.min` forces it to max out at visually 100%, but relies on the Red color to convey the overflow.
*   **Flow & Architecture**: These styles are not CSS classes. They are live reactive Javascript functions reacting per-frame to database modifications. As soon as the user logs an expense that trips the 81% metric, React instantly re-calculates `getProgressColor`, forcing the bar to seamlessly transition from Green to Orange in real-time.

---

### 3. Graceful Error Handling during Deletion (Lines 274-297)
```tsx
    onPress: async () => {
        if (editingCategory && user) {
            try {
                await deleteCategory(editingCategory.id, user.id);
                setEditingCategory(null);
                setTimeout(() => loadCategories(), 100);
            } catch (error) { ... }
        }
    }
```
*   **Flow & Architecture**: Deleting a category is destructive because hundreds of transactions might be linked specifically to that integer ID. 
    1. It delegates the `deleteCategory` task straight to SQLite. 
    2. It drops the modal UI instantly (`setEditingCategory(null)`) for snappiness.
    3. The absolute magic sits in `setTimeout(..., 100)`. Because the SQLite deletion might trigger a C++ cascade (setting all affected transactions to `category_id = NULL` via SQL `SET NULL`), firing the `loadCategories` trigger instantly might fetch the old data before the disk finishes spinning. The 100-millisecond delay guarantees the disk finishes its atomic transaction before the UI requests a paint refresh, preventing race conditions.
