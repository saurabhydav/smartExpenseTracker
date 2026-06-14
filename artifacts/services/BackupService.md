# `src/services/BackupService.ts` - In-Depth Technical Explanation

This file holds placeholders and architecture implementations for uploading the raw SQL database string natively into a user's hidden Google Drive structure, completely ensuring that their data remains their own and never touches a third-party server.

---

### 1. File Path Resolution (Lines 11-18)
```typescript
const getDatabasePath = (): string => {
    if (Platform.OS === 'android') {
        return '/data/data/com.expensetracker/databases/expense_tracker.db';
    }
    // iOS path would be different
    return '';
};
```
*   **Flow & Architecture**: The `react-native-sqlite-storage` library abstracts away physical device architecture. However, to execute a backup, we have to copy the literal `.db` file off the phone's physical hard drive. Android stores application data in sandboxed silos (`/data/data/<package_name>/...`). This function points a direct laser at the protected sector where the OS locks the data.

---

### 2. Multi-Part OAuth Strategy (Lines 111-168)
```typescript
export async function createBackup(): Promise<{ success: boolean; error?: string }> {
    try {
        const dbPath = getDatabasePath();

        // 1. Read SQLite File using react-native-fs
        // 2. Encrypt the Binary stream
        
        // 3. Upload to Google Drive appDataFolder
        /*
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        const tokens = await GoogleSignin.getTokens();
        
        const metadata = {
          name: `expense_backup_${Date.now()}.db.enc`,
          parents: ['appDataFolder'],
        };
        // Use multipart upload ...
        */
```
*   **Syntax Breakdown**: The `appDataFolder` scope in Google OAuth refers to a hidden, protected folder inside a user's Google Drive. Even the user themselves cannot see these files if they log into Google Drive on their computer. It prevents users from accidentally deleting or corrupting their own backup file. 
*   **Flow & Architecture**: (Currently stubbed)
    1. It reads the `.db` SQLite file entirely into memory as a `base64` string.
    2. Natively encrypts the string into an `.enc` extension.
    3. Fires a standard HTTP Request directly to Google's REST API. It uses a `multipart/related` boundary stream, fusing the JSON metadata (what the file is named) perfectly with the binary base64 encryption simultaneously.

---

### 3. Automated Cron Background Tasks (Lines 271-292)
```typescript
function scheduleAutoBackup(): void {
    // TODO: Implement with react-native-background-fetch or similar
    // This would:
    // 1. Register a background task
    // 2. Configure to run at 2 AM daily
    // 3. Check if device is charging and on WiFi
    // 4. Run createBackup()
}
```
*   **Flow & Architecture**: Mobile Operating Systems aggressively kill apps that try to upload mega-bytes of data in the background to preserve battery life. A robust mobile architecture (via `react-native-background-fetch`) registers a strict OS-level hook. It essentially asks Android: *"Please wake me up at 2:00 AM, but ONLY if the user is physically plugged into a wall charger, and ONLY if they are connected to Wi-Fi."* This ensures uploading 5MB database files doesn't drain their battery or chew through their cellular data limits while they sleep.
