# `src/screens/LoginScreen.tsx` - In-Depth Technical Explanation

This file bridges the unauthenticated UI to the cloud-based HTTP API backend, converting simple text fields into global authenticated states.

---

### 1. Unified State Mutators (Lines 32-49)
```tsx
    const { setUser, setAuthenticated } = useAppStore();

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const response = await authService.login({ email, password });
            setUser(response.user);
            setAuthenticated(true);
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Invalid email or password';
            Alert.alert('Login Failed', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
```
*   **Flow & Architecture**: 
    1. It pings the `authService.login()`. That service (which we documented earlier) travels to the backend, verifies the SQL database hash, and physically writes the JWT token to the native `Keychain` storage on the phone.
    2. Once `authService` guarantees the token is secure, the code updates Zustand's in-memory state: `setUser()` and `setAuthenticated(true)`. 
    3. Because the `App.tsx` root router listens to `isAuthenticated`, the moment `setAuthenticated(true)` fires, React Navigation structurally destroys the Login Screen from RAM and instantly mounts the internal tab structure.
    4. **Safety Pipeline**: The `catch (error: any)` block is designed to safely pluck Axios HTTP errors (`error.response.data.message` like "User not found") before crashing to a generic error string.

---

### 2. Geometry Anti-Collision (Lines 52-55)
```tsx
    <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
```
*   **Flow & Architecture**: Virtual Keyboards are massive UI disruptors. When the user taps the 'Email' box, a keyboard slides up from the bottom, instantly covering half the screen and hiding the "Login" button underneath it.
    - `KeyboardAvoidingView` natively dynamically recalculates the exact pixel height of the keyboard.
    - On iOS, it uses `padding` (literally injecting a 300px invisible margin at the bottom) to smoothly animate the entire form upwards so the active TextInput sits perfectly above the keyboard. 
    - On Android, `height` physically shrinks the absolute container, triggering Android's native internal scrolling mechanism.

---

### 3. Password UX/Security Masking (Lines 83-93)
```tsx
    <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
    />
    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
        <Icon name={showPassword ? 'visibility' : 'visibility-off'} />
    </TouchableOpacity>
```
*   **Syntax Breakdown**: `secureTextEntry` commands the OS rendering engine to obfuscate the text rendering (`*****`) and entirely disables clipboard memory (the user cannot 'Copy' the password they just typed).
*   **Flow & Architecture**: State-driven UI toggle. The Eye icon inverses the boolean `showPassword` state. Instantly, the `secureTextEntry` flag flips, forcing the `TextInput` to re-render in plain-text, enabling users to verify typos without rebuilding their typed string.
