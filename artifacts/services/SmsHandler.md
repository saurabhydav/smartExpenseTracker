# `src/services/SmsHandler.ts` - In-Depth Technical Explanation

This file bridges the gap between the Native Android Operating System and the Javascript React Application. It specifically negotiates permissions and runs code even when the user forces the app to close.

---

### 1. Headless Background Execution (Lines 8-36)
```typescript
async function SmsReceivedTask(data: { sender: string; body: string; timestamp: number }) {
    // ...
    const result = await processSmartSms(data.body, data.sender);
    // ...
}

// Register the HeadlessJS task
AppRegistry.registerHeadlessTask('SmsReceivedTask', () => SmsReceivedTask);
```
*   **Concepts & Architecture**: 
    - When a user swipes an app away, the Operating System physically kills the Javascript engine to save RAM.
    - If a user receives an SMS about a transaction while the app is dead, the Native Android intent (`BroadcastReceiver`) wakes up. It artificially boots up a tiny, invisible, UI-less Javascript thread in the background known as `HeadlessJS`.
    - This file registers the `SmsReceivedTask`. The invisible thread executes the `processSmartSms()` engine, intercepts the data, saves it securely into the SQLite database, and then quietly dies again. All of this happens instantly without the user ever turning their screen on.

---

### 2. Deep OS Permission Management (Lines 38-91)
```typescript
export async function requestSmsPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
    ]);
    const allGranted =
        granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    
    return allGranted;
}
```
*   **Syntax Breakdown**: 
    - `Platform.OS !== 'android'`: iOS unconditionally prohibits reading a user's SMS inbox under Apple's privacy guidelines. This explicit intercept guarantees the app will not break or throw illegal permission requests if compiled for iPhones.
    - `PermissionsAndroid.requestMultiple`: Prompts the OS drawer asking the user for dual permission. `RECEIVE_SMS` allows the app to intercept the exact moment a text message arrives. `READ_SMS` allows the app to retroactively scan the inbox. If the user clicks "Deny", this gracefully returns `false` without crashing the app.

---

### 3. Bridging Custom Native Modules (Lines 97-108)
```typescript
export async function getRecentSms(limit: number = 100): Promise<any[]> {
    if (Platform.OS !== 'android') return [];
    try {
        if (SmsModule?.getAllSms) {
            return await SmsModule.getAllSms(limit);
        }
        return [];
    } catch (error) { ... }
}
```
*   **Syntax & Flow**: `const { SmsModule } = NativeModules;` (seen on Line 6). 
    - React Native does not natively know how to read SMS inboxes out of the box. The codebase uses a custom Java/Kotlin Bridge (`SmsModule`) compiled directly into Android.
    - `SmsModule.getAllSms(100)` bypasses Javascript, dives into the Java layer, requests the Android OS inbox Content Provider, sucks out the last 100 raw SMS objects, converts them to JSON arrays, and pipes them back up the bridge into this Javascript loop for the `SettingsScreen` to process.
