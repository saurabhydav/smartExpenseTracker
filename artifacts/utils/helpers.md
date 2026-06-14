# `src/utils/helpers.ts` - In-Depth Technical Explanation

This file is a centralized repository for static variables (like UI colors and icons) and pure functional helpers. Everything here is designed to be reusable across the entire application without depending on complex external states.

---

### 1. Global Currency Management (Lines 3-8)
```typescript
let globalCurrencyCode = 'INR';

export function setGlobalCurrency(code: string) {
    globalCurrencyCode = code;
}
```
*   **Syntax Breakdown**: `let globalCurrencyCode = 'INR'` creates a mutable global variable. Since it sits outside any React Hook or Component, it persists in the background Javascript instance natively. `export function setGlobalCurrency` is the setter.
*   **Flow & Architecture**: The app needs to format money fast across hundreds of lists. Fetching the currency preference out of `AsyncStorage` or `Zustand` for *every single item* on a FlatList causes UI stutter. Instead, the `App.tsx` file fetches the user's currency preference from the database exactly **once** at boot up, calls `setGlobalCurrency('USD')`, and permanently sets this module-level variable in physical RAM for instant access forever.

---

### 2. Format Currency Engine (Lines 10-18)
```typescript
export function formatCurrency(amount: number, currency: string = globalCurrencyCode): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}
```
*   **Syntax Breakdown**: 
    - `currency: string = globalCurrencyCode`: This is an ES6 Default Parameter. If a developer forgets to specify a currency when calling this function, it defaults to the global RAM variable defined above.
    - `Intl.NumberFormat`: This is a built-in blazing fast JavaScript Internationalization API. It avoids manual string manipulation.
*   **Flow & Architecture**: Instead of trying to write complex Regex to add commas (`1,00,000.00`), the app delegates to standard V8 logic. `minimumFractionDigits: 0` drops zero decimals (`100` instead of `100.00`), while `maximumFractionDigits: 2` clamps long floats (`100.56`).

---

### 3. Smart Relative Time Calculator (Lines 38-50)
```typescript
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateString); // Fallback to literal date
}
```
*   **Syntax Breakdown**: 
    - `date.getTime()` converts a human date into "Epoch Unix Time," representing the exact amount of milliseconds that have passed since Jan 1, 1970.
    - `1000 * 60 * 60 * 24`: This represents (1000ms * 60sec * 60min * 24hrs) which perfectly totals `86,400,000`, the number of milliseconds in a single day.
*   **Flow & Architecture**: 
    1. It extracts the raw time delta in milliseconds.
    2. It strictly divides the gap by a literal 'Day' value and forces `Math.floor()` to round *down*, avoiding partial days affecting UI checks.
    3. It streams the result through a waterfall of boundaries (`0`, `1`, `<7`, `<30`), converting the numeric result into friendly UI strings. If it falls beyond 30 days, it abandons "time travel" logic and falls back on displaying a hard-coded date (e.g., "Jan 12") using the `formatDate` helper.

---

### 4. Icon Mapping Dictionary (Lines 86-104)
```typescript
export const categoryIcons: Record<string, string> = {
    'Food & Dining': 'restaurant',
    'Shopping': 'shopping-cart',
    // ...
};

export function getCategoryIcon(categoryName: string): string {
    return categoryIcons[categoryName] || 'label';
}
```
*   **Syntax Breakdown**: `Record<string, string>` is TypeScript enforcing that the `categoryIcons` object requires its keys to be strings and its values to be strings.
*   **Flow & Architecture**: This is a direct Name-To-Glyph lookup table. When creating "Automated SMS Rules" or "Transaction UI Cards", the database only knows the string name "Food & Dining". The app feeds that string into `getCategoryIcon`, which instantly retrieves the literal material-ui vector graphic ID (`'restaurant'`). The `|| 'label'` syntax provides an infallible fallback; if the user's category name doesn't exist in the dictionary, it always defaults to the generic `'label'` tag icon.
