# `src/screens/TransactionsScreen.tsx` - In-Depth Technical Explanation

This file contains the "History Ledger". It heavily utilizes React Native's highly-optimized mapping structures to rapidly render thousands of database rows.

---

### 1. Dual Multi-Layer Filtering (Lines 26-33)
```tsx
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit'>('all');

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.merchant.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        return matchesSearch && matchesType;
    });
```
*   **Syntax Breakdown**: `.filter()` returns a completely new clone of the array in Javascript Memory containing only items that evaluate to `true`.
*   **Flow & Architecture**: This combines two separate filter states cleanly without making multiple trips to the database. 
    1. It drops all casing (`toLowerCase()`) so that a user searching for `uber` will still correctly find `UBER Rides`.
    2. It guarantees both axes match. If the user clicked the "Income" tab (`filterType === 'credit'`), and searched for `Amazon`, `.filter` removes all Amazon purchases because `matchesType` evaluates to false, ensuring absolute strict logic. 
    - Because this logic executes inside the component, typing into the search bar feels entirely instant (0 latency) because it filters the live RAM rather than pinging the hard drive.

---

### 2. High-Performance Mobile Lists (Lines 108-121)
```tsx
    <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={...}
    />
```
*   **Flow & Architecture**: Why not just use a `.map()` inside a `<ScrollView>` like the Dashboard does? 
    - The Dashboard only pulls 5 transactions (`transactions.slice(0, 5)`). 
    - This history list might pull **5,000** transactions. If you used `<ScrollView>` to map 5000 views, the phone would run out of RAM instantly and thermally crash. 
    - `<FlatList>` is a piece of genius mobile UI architecture. It completely destroys components once they scroll off the top of the physical screen, and dynamically generates new ones just before they reach the bottom of the screen. No matter if the user has 10 transactions or 10,000, `<FlatList>` ensures the app only ever holds ~15 UI blocks in active RAM memory, guaranteeing a silky smooth 60 Frames Per Second scrolling experience.

---

### 3. Robust Error Boundaries (Lines 36-49)
```tsx
    const renderTransaction = ({ item }: { item: Transaction }) => {
        const category = safeCategories.find(c => c.id === item.categoryId);

        return (
            <View style={[styles.transactionIcon, { backgroundColor: (category?.color || colors.textMuted) + '20' }]}>
                <Icon name={category?.icon || 'receipt'} size={20} color={category?.color || colors.textMuted} />
            </View>
        );
    }
```
*   **Syntax Breakdown**: `||` is a Javascript Logical OR fallback. `+ '20'` actually appends a hex-opacity string. If a color is `#FF0000` (Red), `#FF000020` forces the iOS/Android rendering engine to paint the pixel at 12% opacity.
*   **Flow & Architecture**: In edge cases, a user might forcefully delete a category from the database while thousands of old transactions are still mapped to it. If this crashes, the ledger becomes inaccessible. This explicitly catches the missing link (`category: undefined`). It intercepts it dynamically, defaulting the icon to `receipt` and the color to a muddy gray (`colors.textMuted`), ensuring the UI survives database desyncs.
