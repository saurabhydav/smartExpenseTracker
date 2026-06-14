# `src/screens/SignupScreen.tsx` - In-Depth Technical Explanation

This file is responsible for complex multi-field data cleansing and cloud provisioning.

---

### 1. Manual Validation Gauntlet (Lines 35-53)
```tsx
    const validateForm = (): boolean => {
        if (!name.trim()) { ... return false; }
        if (!email.trim() || !email.includes('@')) { ... return false; }
        if (password.length < 8) { ... return false; }
        if (password !== confirmPassword) { ... return false; }
        return true;
    };
```
*   **Flow & Architecture**: "Client-Side Sanitization". Before wasting an HTTP roundtrip to the server (which costs battery, time, and server resources), the phone forces strict rules in memory. 
    1. `.trim()` deletes stray invisible trailing space characters that keyboards commonly inject.
    2. The `@` check is basic, preventing fatal server crashes during mail dispatches.
    3. The absolute string strict equality check `password !== confirmPassword` ensures no silent typos permanently lock the user out of the account they are trying to create.

---

### 2. Network Payload Dispatch (Lines 55-69)
```tsx
    const handleSignup = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            const response = await authService.signup({ name, email, password });
            setUser(response.user);
            setAuthenticated(true);
        } catch (error) { ... }
    };
```
*   **Flow & Architecture**: Like the Login phase, hitting `signup()` delegates heavy cryptography to the `authService`. The backend creates the PostgreSQL user, salts the password, generates a JWT Token map, and sends it back. We then inject the fresh User payload identically to Login, causing the Global Router to swap from the Auth Stack to the Main Stack instantly.

---

### 3. Scrolling Overflow Safety (Lines 76-79)
```tsx
    <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
    >
```
*   **Flow & Architecture**: A signup form with 4 TextInputs, an Icon, headers, and buttons is inherently taller than a Login form. While the `KeyboardAvoidingView` handles the virtual keyboard on tall phones (iPhone Pro Max), on physically small screens (like an iPhone SE), pushing the UI upwards forces the top of the form ("Name") physically off-screen to the top. By wrapping it in a `<ScrollView>`, the user can manually drag the entire view up and down to reach hidden fields, ensuring 100% device compatibility regardless of hardware screen dimensions.
