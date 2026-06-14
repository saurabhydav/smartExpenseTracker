# `src/screens/BiometricLockScreen.tsx` - In-Depth Technical Explanation

This file is a high-security gatekeeper. It forces the user to prove physical ownership of the device via hardware-level cryptography (FaceID/TouchID) before allowed into the React tree.

---

### 1. Hardware Sensor Polling (Lines 41-60)
```tsx
    const checkBiometrics = async () => {
        try {
            const { available, biometryType } = await rnBiometrics.isSensorAvailable();

            if (available) {
                setBiometryType(biometryType || 'Biometrics');
                setTimeout(() => authenticate(), 300); // Auto-prompt
            } else {
                Alert.alert('Biometrics Unavailable', '...', [{ text: 'Continue', onPress: onUnlock }]);
            }
        } catch (error) { ... }
    };
```
*   **Syntax Breakdown**: `isSensorAvailable()` bridges down to Objective-C (iOS) or Java (Android). It asks the OS Kernel specifically if the Secure Enclave hardware is functioning perfectly and enabled.
*   **Flow & Architecture**: As soon as the screen mounts, it interrogates the hardware. If the phone physically has a broken fingerprint reader, or the user never set up a passcode, it explicitly catches this `(!available)`. Instead of soft-locking the user forever, it falls back to a standard prompt, allowing `onUnlock` to fire so the app remains usable on cheaper phones or emulators.

---

### 2. The Cryptographic OS Prompt (Lines 62-92)
```tsx
    const authenticate = async () => {
        const { success } = await rnBiometrics.simplePrompt({
            promptMessage: 'Unlock Expense Tracker',
            cancelButtonText: 'Cancel',
        });

        if (success) {
            await AsyncStorage.setItem(LAST_UNLOCK_KEY, Date.now().toString());
            onUnlock();
        }
    };
```
*   **Flow & Architecture**: When `simplePrompt` fires, React Native literally loses control of the phone. The Operating System freezes the application and draws its native secure overlay on top of everything. The Javascript thread is completely paused and cannot read the user's fingerprint—it just waits. 
    - The OS handles the math. It returns a simple boolean `success`. 
    - If true, the code writes a timestamp stamp `Date.now()` into disk memory. This is highly important: If the user swaps tabs to check iMessage for 5 seconds and returns, the `App.tsx` reads that timestamp and realizes it's too fresh, bypassing the lock screen so the user isn't annoyed perfectly verifying their face every 5 seconds.

---

### 3. Absolute OS Navigation Bridging (Lines 33-39)
```tsx
    useEffect(() => {
        // Prevent back button from closing app
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => backHandler.remove();
    }, []);
```
*   **Syntax Breakdown**: Returning `true` from a Android Hardware back press listener explicitly tells the OS: "I handled this button press, do not do your default behavior."
*   **Flow & Architecture**: Android phones have physical back buttons. If a user was staring at this lock screen and pressed "Back", the default behavior would be to minimize the app. By returning `true`, this component becomes an impassable brick wall. The user cannot swipe back into the dashboard, and they cannot back out of the prompt. They must authenticate.
