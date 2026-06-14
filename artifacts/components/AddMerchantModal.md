# `src/components/AddMerchantModal.tsx` - In-Depth Technical Explanation

This file empowers users to manually construct "Merchant Rules." It permits creating an automation trigger: "When an SMS says 'UBER', map it to the 'Uber Rides' display name and automatically tag it as 'Transportation'."

---

### 1. Database Sourcing on Mount (Lines 56-64)
```tsx
    const loadCategories = async () => {
        try {
            const userId = user?.id;
            const cats = await getCategories(userId);
            setCategories(cats);
        } catch (error) { ... }
    };

    useEffect(() => {
        if (visible) {
            loadCategories();
            // ... Set Initials
        }
    }, [visible, initialData]);
```
*   **Syntax & Flow**: 
    - `user?.id` uses Optional Chaining. If the `user` is globally null (unauthenticated), it silently evaluates to `undefined` instead of throwing a fatal undefined reference crash.
    - `useEffect`: Whenever the `visible` prop changes from `false` to `true` (when the modal pops open), React intercepts the flow and triggers `loadCategories()`. This forces the Modal to dynamically ask the hard drive (SQLite) for the user's current array of customizable categories so they can be rendered as selectable buttons.

---

### 2. Dual-Mode Input (Lines 32-52)
```tsx
export default function AddMerchantModal({ 
    visible, onClose, onSave, initialData 
}: AddMerchantModalProps) {
    // ...
            if (initialData) {
                setSmsName(initialData.smsName);
                setDisplayName(initialData.displayName);
                setSelectedCategory(initialData.categoryId);
            }
```
*   **Flow & Architecture**: This single component intelligently acts as both a "Create Rule" and an "Edit Rule" interface without duplicating code. If the parent passes an `initialData` object, it means the user clicked on a pre-existing rule. The `useEffect` intercepts this object and pre-fills the `useState` buckets with the old data, allowing the user to seamlessly resume editing. 

---

### 3. The Automation Engine Intercept (Lines 66-80)
```tsx
    const handleSave = async () => {
        if (!smsName.trim() || !displayName.trim()) return;
        if (!user) return;

        // Use the service to save/update
        await saveMerchantName(smsName.trim(), displayName.trim(), selectedCategory, user.id);

        onSave();
        onClose();
    };
```
*   **Flow & Architecture**: Unlike the `AddCategoryModal` which delegates its saving backwards, this Modal actually handles database logic natively by bypassing the parent and directly linking to the `SmartSmsProcessor` service via `saveMerchantName`. 
    - Inside `saveMerchantName`, there is an `UPSERT` loop logic. If the user types "UBER", the database detects a collision, skips making a new rule, and updates the old one. Once the hard drive is stabilized, the UI calls `onClose()` to fold itself away.

---

### 4. Smart Keyboard Avoidance UI (Lines 111-125)
```tsx
        <Modal visible={visible} animationType="slide" transparent={true}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContent}>
                    {/* ... */}
                </View>
            </KeyboardAvoidingView>
        </Modal>
```
*   **Syntax & Flow**: 
    - `Platform.OS === 'ios'`: Native React hook intercept. Since iOS and Android handle digital keyboards completely differently on the OS level, this toggles between `'padding'` algorithm on Apple and `'height'` resizing algorithm on Android.
    - Without `<KeyboardAvoidingView>`, when the user clicks the "SMS Name" text input, the operating system keyboard would slide up and physically cover the UI, preventing the user from being able to see what they are typing. This view dynamically shoves the Modal upwards in accordance with the keyboard's exact pixel height.
