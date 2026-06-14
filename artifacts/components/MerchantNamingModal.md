# `src/components/MerchantNamingModal.tsx` - In-Depth Technical Explanation

This file handles the immediate intelligence fallback UI. When the automated background SMS parser encounters a random text message it doesn't recognize (e.g. `PAYTM-XYZ` instead of just `Uber`), it holds it in memory and explicitly launches this Modal when the user next opens the app, asking them: *What did you just buy?*

---

### 1. Intersecting State & Store Context (Lines 48-64)
```tsx
    const handleSave = async () => {
        if (!merchant) return;
        const displayName = name.trim() || merchant.suggestedName;

        // We assume we fetch from store explicitly
        const { user, refreshAll } = require('../store/useAppStore').useAppStore.getState();

        if (!user) return;
        // ... Save Merchant
```
*   **Syntax Breakdown**: `require('../store/useAppStore').useAppStore.getState();` is a synchronous backdoor into the Zustand global memory bank. Traditional hooks (`useAppStore()`) can only be called exactly at the top level of a React component render. 
*   **Flow & Architecture**: When a user clicks "Save", this logic intercepts the flow. It dynamically enters the global memory tree behind-the-scenes to extract the `user.id` and the master `refreshAll` rebuild function without forcing a re-render pipeline. It then forces the UI to respect the user's manual typo by falling back to `merchant.suggestedName` if the `name.trim()` input was completely blank.

---

### 2. Live Healing: Historical Backfills (Lines 68-76)
```tsx
        // Save merchant mapping (like saving a contact)
        await saveMerchantName(merchant.rawName, displayName, selectedCategory, user.id);

        if (merchant.transactionId === -1) {
            // Batch update all pending transactions with this raw name
            const { updateAllTransactionsForMerchant } = require('../services/SmartSmsProcessor');
            await updateAllTransactionsForMerchant(merchant.rawName, displayName, selectedCategory);
        } else {
            // Update single transaction
            await updateTransactionMerchant(merchant.transactionId, displayName, selectedCategory);
        }
```
*   **Flow & Architecture**: This is the most brilliant functional piece of the intelligence loop. 
    1. It first establishes the universal mapping logic in physical memory (`saveMerchantName`). From this second forward, all new SMS texts will be named correctly.
    2. Then it looks backward in time. If `transactionId === -1`, the system interprets that it found hundreds of these unmapped payloads across the user's history and has grouped them into a massive historical mass.
    3. It triggers `updateAllTransactionsForMerchant`, injecting a cascading SQLite `UPDATE` query that sequentially scours all 5,000 old transactions, finds instances where the old broken raw name exists, and dynamically re-points them to the new unified ID.

---

### 3. Emitting Instant System Wide Re-Renders (Lines 77-85)
```tsx
        // INSTANT REFRESH: Update UI state
        await refreshAll();
        DeviceEventEmitter.emit('TRANSACTION_UPDATED');

        // Reset and close
        setName('');
        setSelectedCategory(null);
        onComplete();
```
*   **Syntax Breakdown**: `DeviceEventEmitter.emit()` is a React Native core pipeline that acts as a localized radio broadcast.
*   **Flow & Architecture**: Since this modal usually sits on top of the "Dashboard" and the "Transactions List" simultaneously, when the user clicks save, the physical hard drive updates, but the UI is frozen in the past. 
    - Calling `refreshAll()` manually forces Zustand to hit SQLite for a new master list. 
    - Broadcasting `TRANSACTION_UPDATED` acts as an invisible signal blast across the entire app structure. Any listener component (like the chart or the historical list) connected to that frequency immediately executes its own recalculations, forcing a cascading UI repaint.

---

### 4. Nested Native Scroll Isolation (Lines 154-177)
```tsx
        {showCategories && (
            <ScrollView style={styles.categoryList} nestedScrollEnabled>
                {safeCategories.map((category) => (
                    <TouchableOpacity
                        // ...
                        onPress={() => {
                            setSelectedCategory(category.id);
                            setShowCategories(false);
                        }}
                    >
```
*   **Syntax Breakdown**: 
    - `showCategories && ( ... )`: Early Boolean returns true or false. Because React conditionally mounts it, the 100+ categories don't mathematically exist in the phone's RAM until the user presses the button, saving extreme system resources.
    - `nestedScrollEnabled`: Android blocks components from scrolling if their parent components also scroll. This bypasses the OS lock, ensuring this inner scroll-view doesn't jam if the upper modal tries shifting slightly.
