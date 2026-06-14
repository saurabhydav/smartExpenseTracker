# `src/screens/MerchantContactsScreen.tsx` - In-Depth Technical Explanation

This file is arguably the most complex UI screen algorithmically. It behaves identically to a Phone Contacts book, but it creates strict Machine Learning overrides mapping "Raw SMS Garbage" to "Clean UI Presentations" and forces a massive relational SQLite join to show stats.

---

### 1. Complex Multilayer SQL Joining (Lines 69-82)
```tsx
    const [result] = await db.executeSql(`
        SELECT 
            m.id, m.sms_name, m.display_name, m.category_id,
            COUNT(t.id) as transaction_count,
            COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) as total_spent
        FROM merchant_mapping m
        LEFT JOIN transactions t ON UPPER(t.merchant) = UPPER(m.display_name) AND t.user_id = ?
        WHERE m.user_id = ?
        GROUP BY m.id
        ORDER BY transaction_count DESC
    `, [user.id, user.id]);
```
*   **Flow & Architecture**: This query is highly advanced. Merely having "Uber" saved in the rulebook isn't enough; the user wants to see *how much they have spent at Uber total*.
    1. It initiates from `merchant_mapping` (the rulebook).
    2. `LEFT JOIN transactions` reaches across the database to the ledger. 
    3. `UPPER(t.merchant) = UPPER(m.display_name)` forces case-insensitive matching across 5000 transactions instantly at the C++ level.
    4. `SUM(CASE WHEN...)` calculates that if Uber was a refund (credit), it ignores it, purely calculating out-of-pocket deficit accurately. 
    5. The engine groups it all up, and the output is instantly bound to the UI mapping engine.

---

### 2. Dual List Architecture (Lines 232-267)
```tsx
    <FlatList
        data={unnamedMerchants.length > 0 
           ? [{ type: 'unnamed' }, ...filteredMerchants.map(m => ({ ...m, type: 'saved' }))] 
           : filteredMerchants.map(m => ({ ...m, type: 'saved' }))}
        renderItem={({ item }) => {
            if (item.type === 'unnamed') {
                return <View>...</View>;
            }
            return renderMerchant({ item });
        }}
    />
```
*   **Syntax Breakdown**: The Spread Operator `...` combined with map `({ ...m, type: 'saved' })` mutates the array invisibly, injecting a dummy identifier directly into the data matrix so the UI engine knows what component to build.
*   **Flow & Architecture**: Instead of having two separate `<FlatList>` components or hardcoded sections, the code mathematically injects an artificial array element `[{ type: 'unnamed' }]` at the exact top index of the data array.
    - When `renderItem` fires for Index 0, it reads `type: 'unnamed'` and hijacks the pipeline to map the warning yellow "Needs Rules" box.
    - When it hits Index 1 and beyond, it seamlessly falls back to building the standard rule cards. This guarantees 60fps scrolling performance while allowing multiple disparate visual states in one cohesive scroll column.

---

### 3. State Elevation via Modals (Lines 107-129)
```tsx
    const handleEditMerchant = (merchant: MerchantContact) => {
        setEditingMerchant({ ... });
        setModalVisible(true);
    };

    // JSX
    <AddMerchantModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={loadMerchants} // Trigger cascading refresh
        initialData={editingMerchant}
    />
```
*   **Flow & Architecture**: React favors single-responsibility. Instead of bloating this 400-line file with complex form text boxes and category dropdowns, it merely lifts the selected ID into RAM (`setEditingMerchant`) and triggers a Boolean flag (`setModalVisible(true)`). 
    - The dedicated `AddMerchantModal` component materializes, accepts the injected data, runs all its complex form logic in isolation, and when the user hits "Save", it finishes its hard drive patch. 
    - Finally, the modal calls `onSave={loadMerchants}`, commanding this parent screen to refire its massive SQL aggregate function so the UI updates silently without reloading the page.
