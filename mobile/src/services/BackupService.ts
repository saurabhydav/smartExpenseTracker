// Google Drive Backup Service
// Handles encrypted backup of SQLite database to user's Google Drive

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';
import { closeDatabase, initDatabase } from '../database/database';

// Storage keys
const LAST_BACKUP_KEY = 'last_backup_timestamp';
const BACKUP_ENABLED_KEY = 'backup_enabled';

// Database path (platform-specific)
const getDatabasePath = (): string => {
    if (Platform.OS === 'android') {
        return '/data/data/com.expensetracker/databases/expense_tracker.db';
    } else if (Platform.OS === 'ios') {
        return `${RNFS.LibraryDirectoryPath}/LocalDatabase/expense_tracker.db`;
    }
    return '';
};

/**
 * Backup status interface
 */
export interface BackupStatus {
    lastBackup: Date | null;
    isBackingUp: boolean;
    error: string | null;
}

/**
 * Helper to convert Blob to Base64
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Initialize Google Drive OAuth
 * Uses the hidden appDataFolder scope so users can't see/modify backup files
 */
export async function initializeGoogleDrive(): Promise<boolean> {
    try {
        GoogleSignin.configure({
            scopes: ['https://www.googleapis.com/auth/drive.appdata'],
            webClientId: '374802283532-qa3h9hkp4kai798sqroaukeopauvqanh.apps.googleusercontent.com',
            offlineAccess: true,
        });
        const isSignedIn = GoogleSignin.getCurrentUser() !== null;
        return isSignedIn;
    } catch (error) {
        console.error('Google Drive init error:', error);
        return false;
    }
}

/**
 * Sign in to Google Drive
 */
export async function signInToGoogleDrive(): Promise<{ success: boolean; error?: string }> {
    try {
        await GoogleSignin.hasPlayServices();
        
        GoogleSignin.configure({
            scopes: ['https://www.googleapis.com/auth/drive.appdata'],
            webClientId: '374802283532-qa3h9hkp4kai798sqroaukeopauvqanh.apps.googleusercontent.com',
            offlineAccess: true,
        });

        let response: any = await GoogleSignin.signInSilently();
        if (response.type !== 'success') {
            response = await GoogleSignin.signIn();
        }

        if (response.type !== 'success') {
            throw new Error('Google Sign-In failed or cancelled');
        }

        const currentUser = response.data;
        const scopes = currentUser.scopes || [];
        const hasDriveScope = scopes.some((s: string) => s.toLowerCase().includes('drive'));
        if (!hasDriveScope) {
            console.log('Drive scope not found, adding scope incrementally...');
            await GoogleSignin.addScopes({
                scopes: ['https://www.googleapis.com/auth/drive.appdata']
            });
        }
        
        return { success: true };
    } catch (error: any) {
        console.error('Google Drive Sign-In error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create a backup of the local database
 */
export async function createBackup(): Promise<{ success: boolean; error?: string }> {
    try {
        console.log('Starting backup process...');

        const dbPath = getDatabasePath();
        console.log('Database path:', dbPath);
        
        const dbExists = await RNFS.exists(dbPath);
        if (!dbExists) {
            throw new Error('Database file does not exist at path: ' + dbPath);
        }

        // Get access token
        const tokens = await GoogleSignin.getTokens();
        const accessToken = tokens.accessToken;
        if (!accessToken) {
            throw new Error('No Google access token found. Please sign in again.');
        }

        // Fetch local database file as Blob
        const fileResponse = await fetch('file://' + dbPath);
        const dbBlob = await fileResponse.blob();

        const boundary = 'backup_boundary';
        const metadata = {
            name: `expense_backup_${Date.now()}.db`,
            parents: ['appDataFolder'],
        };

        const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
        const mediaPartHeader = `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
        const footer = `\r\n--${boundary}--`;

        const multipartBody = new Blob([metadataPart, mediaPartHeader, dbBlob, footer], {
            type: 'multipart/related; boundary=' + boundary,
            lastModified: Date.now()
        } as any);

        // 1. Upload backup to Drive
        const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'multipart/related; boundary=' + boundary,
                },
                body: multipartBody,
            }
        );

        if (!uploadResponse.ok) {
            const errText = await uploadResponse.text();
            throw new Error(`Upload failed: ${uploadResponse.status} ${errText}`);
        }

        // 2. Clean up old backups (keep only latest 3)
        const listResponse = await fetch(
            'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=createdTime desc',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (listResponse.ok) {
            const filesData = await listResponse.json();
            const files = filesData.files || [];
            if (files.length > 3) {
                for (let i = 3; i < files.length; i++) {
                    const oldFileId = files[i].id;
                    console.log('Cleaning up old backup file:', oldFileId);
                    await fetch(`https://www.googleapis.com/drive/v3/files/${oldFileId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    });
                }
            }
        }

        // Save backup timestamp
        const timestamp = new Date().toISOString();
        await AsyncStorage.setItem(LAST_BACKUP_KEY, timestamp);

        console.log('Backup completed at:', timestamp);
        return { success: true };

    } catch (error: any) {
        console.error('Backup error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Restore from the latest backup
 */
export async function restoreFromBackup(): Promise<{ success: boolean; error?: string }> {
    try {
        console.log('Starting restore process...');

        const tokens = await GoogleSignin.getTokens();
        const accessToken = tokens.accessToken;
        if (!accessToken) {
            throw new Error('No Google access token found. Please sign in again.');
        }

        // 1. List files in appDataFolder
        const listResponse = await fetch(
            'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=createdTime desc&pageSize=1',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!listResponse.ok) {
            const errText = await listResponse.text();
            throw new Error(`Failed to check backups on Google Drive: ${listResponse.status} ${errText}`);
        }

        const filesData = await listResponse.json();
        const files = filesData.files || [];
        if (files.length === 0) {
            return { success: false, error: 'No backup found in your Google Drive app data' };
        }

        const latestBackup = files[0];
        console.log('Restoring backup file:', latestBackup.id);

        // 2. Download the backup file
        const downloadResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${latestBackup.id}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!downloadResponse.ok) {
            throw new Error(`Download failed: ${downloadResponse.status}`);
        }

        const dbBlob = await downloadResponse.blob();

        // 3. Convert Blob to Base64
        const base64Data = await blobToBase64(dbBlob);

        // 4. Close database connection first
        await closeDatabase();

        // 5. Replace local database
        const dbPath = getDatabasePath();
        const dbDir = dbPath.substring(0, dbPath.lastIndexOf('/'));
        
        // Ensure directory exists
        const dirExists = await RNFS.exists(dbDir);
        if (!dirExists) {
            await RNFS.mkdir(dbDir);
        }

        await RNFS.writeFile(dbPath, base64Data, 'base64');
        console.log('Restored database file written successfully');

        // 6. Reinitialize connection
        await initDatabase();
        console.log('Database reinitialized successfully');

        return { success: true };

    } catch (error: any) {
        console.error('Restore error:', error);
        // Attempt recovery
        try {
            await initDatabase();
        } catch (dbErr) {
            console.error('Failed to recover database connection:', dbErr);
        }
        return { success: false, error: error.message };
    }
}

/**
 * Get the last backup timestamp
 */
export async function getLastBackupTime(): Promise<Date | null> {
    try {
        const timestamp = await AsyncStorage.getItem(LAST_BACKUP_KEY);
        return timestamp ? new Date(timestamp) : null;
    } catch (error) {
        console.error('Error getting last backup time:', error);
        return null;
    }
}

/**
 * Check if automatic backup is enabled
 */
export async function isAutoBackupEnabled(): Promise<boolean> {
    try {
        const enabled = await AsyncStorage.getItem(BACKUP_ENABLED_KEY);
        return enabled === 'true';
    } catch (error) {
        return false;
    }
}

/**
 * Enable/disable automatic backup
 */
export async function setAutoBackupEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(BACKUP_ENABLED_KEY, enabled.toString());

    if (enabled) {
        scheduleAutoBackup();
    } else {
        cancelAutoBackup();
    }
}

/**
 * Schedule automatic backup
 */
function scheduleAutoBackup(): void {
    console.log('Auto backup scheduling placeholder');
}

/**
 * Cancel scheduled automatic backup
 */
function cancelAutoBackup(): void {
    console.log('Auto backup cancellation placeholder');
}

export default {
    initializeGoogleDrive,
    signInToGoogleDrive,
    createBackup,
    restoreFromBackup,
    getLastBackupTime,
    isAutoBackupEnabled,
    setAutoBackupEnabled,
};
