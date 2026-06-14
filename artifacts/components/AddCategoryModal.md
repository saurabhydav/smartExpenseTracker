# `src/components/AddCategoryModal.tsx` - In-Depth Technical Explanation

This file defines an interactive pop-up (Modal) allowing users to construct their own custom categories (e.g., "Dog Toys") by choosing a name, a vector icon, a hex color, and an optional monthly budget limit.

---

### 1. State Management & Form Memory (Lines 31-48)
```tsx
export default function AddCategoryModal({ visible, onClose, onSave }: AddCategoryModalProps) {
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [budget, setBudget] = useState('');

    const handleSave = () => {
        if (!name.trim()) return; // Protection
        onSave(name, selectedIcon, selectedColor, budget ? parseFloat(budget) : null);
        resetForm();
    };
```
*   **Syntax Breakdown**: `[name, setName] = useState('')` uses React Hooks to create localized memory. `parseFloat(budget)` converts a raw text string `"400.50"` into a strict JavaScript number that SQLite can mathematically calculate later.
*   **Flow & Architecture**: The Modal does *not* talk to the database directly. It purely acts as a dumb UI component. It delegates the actual saving logic upwards by invoking the `onSave` prop (passed down from the parent `BudgetScreen.tsx`). Once `handleSave` resolves, it calls `resetForm()` so that the next time the user opens the modal, it's a fresh blank slate rather than showing their previous inputs.

---

### 2. The Transparent Overlay Architecture (Lines 51-54)
```tsx
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
```
*   **Syntax Breakdown**: 
    - `transparent=true`: Forces the Modal window to have an invisible background, instead of standard solid white.
    - `onRequestClose={onClose}`: Represents hardware back-button presses on Android. If ignored, users cannot back out of the modal.
*   **Flow & Architecture**: It achieves the "bottom sheet" floating effect geometrically. The parent `<Modal>` takes up the entire screen. The first child `<View style={styles.modalOverlay}>` uses `justifyContent: 'flex-end'` and a semi-transparent black background, forcing the inner "white box" (`modalContent`) rigidly to the very bottom of the user's phone.

---

### 3. Horizontal Scroll Mapping (Lines 64-82)
```tsx
        <Text style={styles.label}>Select Icon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerContainer}>
            {ICONS.map(icon => (
                <TouchableOpacity
                    key={icon}
                    onPress={() => setSelectedIcon(icon)}
                    style={[
                        styles.iconItem,
                        selectedIcon === icon && { backgroundColor: selectedColor }
                    ]}
                >
                    <Icon name={icon} size={24} color={selectedIcon === icon ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
            ))}
        </ScrollView>
```
*   **Syntax Breakdown**: `horizontal=true` rotates the traditional vertical scroll into a left-to-right carrousel. `showsHorizontalScrollIndicator={false}` hides the ugly native scroll bar line giving it a premium app feel.
*   **Flow & Architecture**: This dynamically maps over an array of 15 strings (`['shopping-cart', 'restaurant'...]`). 
    - *Conditional Styling*: Notice the `selectedIcon === icon` checks. If the user taps the 3rd icon, `selectedIcon` equals `'directions-car'`. As React repaints the 15 icons, ONLY the iteration where `icon === 'directions-car'` evaluates to `true`, triggering a swap to a white icon over a colored background, creating the localized "Active" toggle effect.

---

### 4. Mathematical Budget Boundaries (Lines 116-123)
```tsx
        <TouchableOpacity
            style={[styles.saveButton, !name.trim() && styles.disabledButton]}
            onPress={handleSave}
            disabled={!name.trim()}
        >
            <Text style={styles.saveText}>Create Category</Text>
        </TouchableOpacity>
```
*   **Syntax Breakdown**: `!name.trim()`. The `trim()` function deletes all trailing/leading spaces. `!name.trim()` returns `true` if the name is completely empty or just filled with whitespace (e.g., `"   "`).
*   **Flow & Architecture**: This visually and mathematically disables the submit button. It dynamically injects `styles.disabledButton` (which applies `opacity: 0.5`) making it look greyed out, and physically prevents the `onPress` trigger until the user has typed at least one valid character.
