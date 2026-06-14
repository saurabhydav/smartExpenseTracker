# `src/screens/AddTransactionScreen.tsx` - In-Depth Technical Explanation

This file gives the user a manual release valve. If an SMS is lost, or they spend physical cash (which produces no text alert), this file acts as a standalone form generating a brand-new row in SQLite.

---

### 1. Floating Native UI Geometry (Lines 132-172)
```tsx
    <View style={[styles.inputGroup, Platform.OS === 'android' ? { elevation: 10, zIndex: 100 } : { zIndex: 100 }]}>
        <TouchableOpacity style={styles.categorySelector} onPress={() => setShowCategories(!showCategories)}>
            ...
        </TouchableOpacity>

        {showCategories && (
            <View style={[styles.categoryList, Platform.OS === 'android' && { elevation: 10 }]}>
                {safeCategories.map((category) => (
                    ...
                ))}
            </View>
        )}
    </View>
```
*   **Syntax Breakdown**: `zIndex` commands Apple/Web the exact Z-axis stacking order for 3D elements (e.g., Z=100 sits visually "above" Z=1). However, Android completely ignores `zIndex`. To fix Android stacking, you must explicitly use `elevation: 10`, which triggers the Google Material rendering engine to calculate drop shadows and physically lift the layer towards the user's focal point.
*   **Flow & Architecture**: The Category selection box is not a standard dropdown. It is absolute geometrically positioned `<View style={{ position: 'absolute', top: '100%' }}>` directly underneath the selector trigger. Without the aggressive `zIndex` and `elevation` hacks, expanding the box would mathematically push all the text boxes underneath it downwards, breaking the layout completely.

---

### 2. State Validation & Sanitation Pipeline (Lines 37-73)
```tsx
    const handleSave = async () => {
        const parsedAmount = parseFloat(amount);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount'); return;
        }
        if (!merchant.trim()) {
             Alert.alert('Error', 'Please enter a merchant name'); return;
        }

        await insertTransaction({
            amount: parsedAmount,
            type, // 'debit' | 'credit' State Hook
            merchant: merchant.trim(),
            categoryId: selectedCategory,
            date,
            rawSms: null,
            notes: notes.trim() || null,
        }, false); // Allow duplicates flag

        await refreshAll();
        navigation.goBack();
    };
```
*   **Syntax Breakdown**: 
    - `parseFloat(amount)` checks the raw string `"150.25"` and formally converts it into a mathematically actionable Float Type in RAM. If the user tried typing `"Hello"`, it outputs `NaN` (Not A Number).
    - `notes.trim() || null` intercepts the backend. If the user types nothing but spaces into the optional notes box (`"   "`), the Javascript engine drops it cleanly to SQL `NULL` instead of logging an empty garbage string.
*   **Flow & Architecture**: This sits between the UI buttons and the Hard Drive. It is aggressively defensive to prevent corrupting the internal database.
    - Notice it explicitly passes `false` to the `insertTransaction` controller. In automated SMS parses, this flag is set to `true`, preventing identical texts from cloning duplicate entries. Because this is a manual entry, the user theoretically might want to log that they bought four $1.00 coffees in a row deliberately. The flag overrides the deduplication logic cleanly.
