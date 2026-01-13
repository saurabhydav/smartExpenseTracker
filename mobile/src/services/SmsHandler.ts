// React Native SMS handling - HeadlessJS task and permission management

import { AppRegistry, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { processSmartSms } from './SmartSmsProcessor';

const { SmsModule } = NativeModules;

/**
 * HeadlessJS task that runs when SMS is received in background
 * Uses Smart SMS Processor for validation and merchant learning
 */
async function SmsReceivedTask(data: { sender: string; body: string; timestamp: number }) {
    console.log('SMS received in background:', data.sender);

    try {
        // Use smart processor - validates, parses, and learns merchants
        const result = await processSmartSms(data.body, data.sender);

        if (result.success) {
            console.log('Transaction created:', result.transactionId);

            if (result.needsNaming && result.merchant) {
                // New merchant detected - will prompt user when app opens
                console.log('New merchant needs naming:', result.merchant.rawName);
                // The MerchantNamingModal will handle this when app is active
            }
        } else {
            console.log('SMS processing skipped:', result.error);
        }
    } catch (error) {
        console.error('Error processing SMS:', error);
    }
}

// Register the HeadlessJS task
AppRegistry.registerHeadlessTask('SmsReceivedTask', () => SmsReceivedTask);

/**
 * Request SMS permissions on Android
 */
export async function requestSmsPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
        console.log('SMS permissions only needed on Android');
        return false;
    }

    try {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
            PermissionsAndroid.PERMISSIONS.READ_SMS,
        ]);

        const allGranted =
            granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
            granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;

        console.log('SMS permissions granted:', allGranted);
        return allGranted;
    } catch (error) {
        console.error('Error requesting SMS permissions:', error);
        return false;
    }
}

/**
 * Check if SMS permissions are granted
 */
export async function checkSmsPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
        return false;
    }

    try {
        if (SmsModule?.checkAllSmsPermissions) {
            return await SmsModule.checkAllSmsPermissions();
        }

        // Fallback to RN permission check
        const receiveGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
        );
        const readGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_SMS
        );

        return receiveGranted && readGranted;
    } catch (error) {
        console.error('Error checking SMS permissions:', error);
        return false;
    }
}


/**
 * Get recent SMS messages from inbox
 */
export async function getRecentSms(limit: number = 100): Promise<any[]> {
    if (Platform.OS !== 'android') return [];
    try {
        if (SmsModule?.getAllSms) {
            return await SmsModule.getAllSms(limit);
        }
        return [];
    } catch (error) {
        console.error('Error fetching SMS inbox:', error);
        return [];
    }
}

export default {
    requestSmsPermissions,
    checkSmsPermissions,
    getRecentSms,
};
