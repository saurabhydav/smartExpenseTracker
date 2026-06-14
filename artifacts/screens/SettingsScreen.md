# `src/screens/SettingsScreen.tsx` - In-Depth Technical Explanation

This file is a configuration panel directly controlling deeply integrated OS parameters (hardware locks, text message routing) and cloud backup layers.

---

### 1. Asynchronous Lifecycle Synchronization (Lines 49-67)
```tsx
    const loadSettings = async () => {
        // Android strict OS permissions
        if (Platform.OS === 'android') {
            const granted = await checkSmsPermissions();
            setSmsPermissionGranted(granted);
            setSmsEnabled(granted);
        }

        // Hardware biometrics
        const bioAvailable = await isBiometricAvailable();
        const bioEnabled = await isBiometricLockEnabled();
        
        // Cloud Status
        const backup = await getLastBackupTime();
    };
```
*   **Flow & Architecture**: When the Settings screen mounts, it cannot assume anything. It must reach out to three entirely distinct domains to paint the toggles correctly:
    1. **Platform.OS**: Only Android allows reading SMS text messages system-wide natively. If the phone is iOS, this code is entirely skipped, and the SMS toggles are physically invisible.
    2. **rnBiometrics**: It queries the C++ Secure Enclave to see if FaceID exists, and queries AsyncStorage to see if the user deliberately enabled the flag.
    3. **AsyncStorage**: Extracts the timestamp string of the last successful Google Drive OAuth payload.

---

### 2. Multi-Step Cloud Backup Orchestration (Lines 114-148)
```tsx
    const handleManualBackup = async () => {
        // First sign in to Google Drive
        const signIn = await signInToGoogleDrive();
        if (!signIn.success) { return; }

        // Then create backup
        const result = await createBackup();

        if (result.success) {
            setLastBackup(new Date());
            Alert.alert('Success', 'Your data has been backed up securely.');
        } 
    };
```
*   **Flow & Architecture**: This forces a chain reaction. 
    1. It delegates absolute control to Google's standard OAuth window natively bridging to Safari/Chrome. 
    2. Once Google signs the response and returns an access token mapping to `./appDataFolder`, the code advances.
    3. `createBackup()` dumps the entire hard SQLite database into an AES encryption scrambler and dispatches the buffer to Google's REST API. 
    4. Upon success, it writes the confirmation timestamp to the device so the user feels secure.

---

### 3. Historical Data Backfill (Inbox Scan) (Lines 305-362)
```tsx
    const messages = await getRecentSms(400);

    let added = 0;
    const BATCH_SIZE = 20;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(msg =>
            processSmartSms(msg.body, msg.address, user?.id, msg.date, true)
        ));
        added += results.filter(r => r.success && r.transactionId).length;
    }
```
*   **Syntax Breakdown**: `Promise.all` executes an entire array of asynchronous functions utterly simultaneously across multiple Javascript micro-threads instead of waiting sequentially.
*   **Flow & Architecture**: If a user downloaded the app today but wants expenses tracked from a month ago, this executes a massive retroactive brute-force parsing operation.
    - Instead of hurling 400 dense text messages at the `processSmartSms` regex/SQLite engine at once (which would freeze and crash the Javascript thread), it enforces a strict `BATCH_SIZE = 20`. 
    - It processes 20 messages simultaneously, waits for the database to complete those inserts securely, adds up the successes (`r.success && r.transactionId`), and iteratively chunks through the next 20 perfectly without compromising RAM or Frame Rates.
