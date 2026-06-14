# `src/screens/TransactionDetailScreen.tsx` - In-Depth Technical Explanation

This file manages the deepest atomic view of a single transaction. It empowers the user to perform destructive disk operations (deleting history) and structural restructuring (teaching the SMS parser new rules).

---

### 1. Contextual Routing & Pre-Fetching (Lines 29-55)
```tsx
    const { id } = route.params; // Supplied by React Navigation

    useEffect(() => { loadTransaction(); }, [id, transactions]);

    const loadTransaction = () => {
        const found = transactions.find(t => t.id === id);
        if (found) {
            setTransaction(found);
            setSelectedCategory(found.categoryId);
        } else {
            Alert.alert('Error', 'Transaction not found');
            navigation.goBack();
        }
    };
```
*   **Syntax Breakdown**: `route.params` passes variables invisibly between screens without using Redux/Zustand. When the `TransactionsScreen` clicked this item, it passed the unique SQLite Integer ID through the bridge.
*   **Flow & Architecture**: Instead of querying SQLite again (which wastes battery), it just scans the massive array already resting idly in the Zustand global store (`transactions.find(...)`).
    - If the user deletes a transaction, the global `transactions` array will instantly update. The `useEffect` dependencies `[id, transactions]` senses this array mutation mid-flight, immediately attempts to `loadTransaction()`, fails because it is gone, and automatically auto-kicks the user out to the previous screen via `navigation.goBack()`.

---

### 2. Dual-Phased Database Patching (Lines 57-96)
```tsx
    const handleSave = async () => {
        setIsSaving(true);
        // 1. Update the transaction's single category
        await updateTransaction(transaction.id, user.id, { categoryId: selectedCategory });

        // 2. Machine Learning: Create a universal rule
        if (transaction.rawSms && autoCategorizeFuture) {
            const parsed = await parseExpense(transaction.rawSms);
            
            await saveMerchantName(parsed.merchant, transaction.merchant, selectedCategory, user.id);
        }
        
        refreshAll();
        navigation.goBack();
    };
```
*   **Flow & Architecture**: When a user changes the category from "Uncategorized" to "Food", two radically different disk workflows execute depending on the UI toggles.
    1. **Granular Edit**: It fires an explicit SQLite `UPDATE` focusing tightly on the exact row matching `transaction.id`.
    2. **Algorithmic Learning**: If the user checked "Auto-categorize Future", it reaches entirely across the application directly to the `SmartSmsProcessor`. It extracts the `rawSms` text hidden in the transaction metadata, re-parses it, traps the raw merchant text (e.g. "UBER-MUMBAI"), and creates a universal mapping rule so any future parsing engine will instantly default to the user's manual choice.

---

### 3. Graceful Destructive UX Dialogs (Lines 221-252)
```tsx
    <TouchableOpacity onPress={() => {
        Alert.alert(
            'Delete Transaction',
            'Are you sure you want to delete this transaction?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        await deleteTransaction(transaction.id, user.id);
                        refreshAll();
                        navigation.goBack();
                    }
                }
            ]
        );
    }}>
```
*   **Syntax Breakdown**: `Alert.alert` intercepts Native Operating System dialog APIs to render the native iOS glass-box/Android material popups perfectly. `style: 'destructive'` physically highlights the button Bright Red on Apple iOS devices natively.
*   **Flow & Architecture**: Because `deleteTransaction` is a permanent disk-level `DELETE FROM` SQL operation, we never want a stray tap to execute it. This wrapper intercepts the function call and halts the Javascript thread inside an OS-level Promise trap. Only when the OS explicitly returns that the User tapped the second button index does it actually ping the `database.ts` controller layer.
