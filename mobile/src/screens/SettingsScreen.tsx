// Settings Screen with biometric lock, manual backup, and SMS permissions

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Switch,
    Alert,
    Platform,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { useAppStore } from '../store';
import { checkSmsPermissions, requestSmsPermissions, getRecentSms } from '../services';
import {
    isBiometricLockEnabled,
    setBiometricLockEnabled,
    isBiometricAvailable
} from './BiometricLockScreen';
import {
    createBackup,
    getLastBackupTime,
    signInToGoogleDrive
} from '../services/BackupService';
import { colors, formatDate } from '../utils';
import { processSmartSms } from '../services/SmartSmsProcessor'; // Import for testing
import Icon from 'react-native-vector-icons/MaterialIcons';

interface SettingsScreenProps {
    navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
    const [smsEnabled, setSmsEnabled] = useState(false);
    const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);
    const [biometricLockOn, setBiometricLockOn] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [lastBackup, setLastBackup] = useState<Date | null>(null);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const { user, logout, refreshAll } = useAppStore();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        // Check SMS permissions
        if (Platform.OS === 'android') {
            const granted = await checkSmsPermissions();
            setSmsPermissionGranted(granted);
            setSmsEnabled(granted);
        }

        // Check biometric settings
        const bioAvailable = await isBiometricAvailable();
        setBiometricAvailable(bioAvailable);

        const bioEnabled = await isBiometricLockEnabled();
        setBiometricLockOn(bioEnabled);

        // Get last backup time
        const backup = await getLastBackupTime();
        setLastBackup(backup);
    };

    const handleSmsToggle = async (value: boolean) => {
        if (value) {
            const granted = await requestSmsPermissions();
            if (granted) {
                setSmsEnabled(true);
                setSmsPermissionGranted(true);
            } else {
                Alert.alert(
                    'Permission Required',
                    'SMS permission is needed to automatically detect bank transactions.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    ]
                );
            }
        } else {
            Alert.alert(
                'Disable SMS Detection?',
                'You will need to manually add transactions.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Disable', onPress: () => setSmsEnabled(false) },
                ]
            );
        }
    };

    const handleBiometricToggle = async (value: boolean) => {
        if (value && !biometricAvailable) {
            Alert.alert('Unavailable', 'Biometric authentication is not available on this device.');
            return;
        }

        await setBiometricLockEnabled(value);
        setBiometricLockOn(value);

        if (value) {
            Alert.alert(
                'App Lock Enabled',
                'The app will require fingerprint/Face ID when opened.',
            );
        }
    };

    const handleManualBackup = async () => {
        Alert.alert(
            'Backup to Google Drive',
            'Your expenses will be encrypted and uploaded to your Google Drive. Only you can access this data.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Backup Now',
                    onPress: async () => {
                        setIsBackingUp(true);

                        // First sign in to Google Drive
                        const signIn = await signInToGoogleDrive();
                        if (!signIn.success) {
                            Alert.alert('Sign In Required', signIn.error || 'Please sign in to Google Drive first.');
                            setIsBackingUp(false);
                            return;
                        }

                        // Then create backup
                        const result = await createBackup();
                        setIsBackingUp(false);

                        if (result.success) {
                            const now = new Date();
                            setLastBackup(now);
                            Alert.alert('Success', 'Your data has been backed up securely.');
                        } else {
                            Alert.alert('Backup Failed', result.error || 'Could not complete backup.');
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure? Your local data will be preserved.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    }
                },
            ]
        );
    };

    const SettingItem = ({
        icon,
        title,
        subtitle,
        onPress,
        rightElement,
        danger,
    }: {
        icon: string;
        title: string;
        subtitle?: string;
        onPress?: () => void;
        rightElement?: React.ReactNode;
        danger?: boolean;
    }) => (
        <TouchableOpacity
            style={styles.settingItem}
            onPress={onPress}
            disabled={!onPress && !rightElement}
        >
            <View style={[styles.settingIcon, danger && { backgroundColor: colors.debit + '20' }]}>
                <Icon name={icon} size={22} color={danger ? colors.debit : colors.primary} />
            </View>
            <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, danger && { color: colors.debit }]}>{title}</Text>
                {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
            </View>
            {rightElement || (onPress && <Icon name="chevron-right" size={24} color={colors.textMuted} />)}
        </TouchableOpacity>
    );

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Settings</Text>
            </View>

            {/* Profile Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Profile</Text>
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{user?.name || 'User'}</Text>
                        <Text style={styles.profileEmail}>{user?.email || ''}</Text>
                    </View>
                </View>
            </View>

            {/* Preferences Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferences</Text>
                <View style={styles.card}>
                    <SettingItem
                        icon="paid"
                        title="Currency"
                        subtitle={`Current: ${useAppStore(s => s.currencySymbol)}`}
                        onPress={() => {
                            Alert.alert(
                                'Select Currency',
                                'Choose your preferred currency symbol',
                                [
                                    { text: '₹ (INR)', onPress: () => useAppStore.getState().setCurrencySymbol('₹') },
                                    { text: '$ (USD)', onPress: () => useAppStore.getState().setCurrencySymbol('$') },
                                    { text: '€ (EUR)', onPress: () => useAppStore.getState().setCurrencySymbol('€') },
                                    { text: '£ (GBP)', onPress: () => useAppStore.getState().setCurrencySymbol('£') },
                                    { text: '¥ (JPY)', onPress: () => useAppStore.getState().setCurrencySymbol('¥') },
                                    { text: 'Cancel', style: 'cancel' }
                                ]
                            );
                        }}
                    />
                </View>
            </View>

            {/* Security Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Security</Text>
                <View style={styles.card}>
                    <SettingItem
                        icon="fingerprint"
                        title="App Lock"
                        subtitle={biometricAvailable
                            ? 'Require biometrics to open app'
                            : 'Biometrics not available'}
                        rightElement={
                            <Switch
                                value={biometricLockOn}
                                onValueChange={handleBiometricToggle}
                                trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                                thumbColor={colors.text}
                                disabled={!biometricAvailable}
                            />
                        }
                    />
                </View>
                <Text style={styles.sectionHint}>
                    When enabled, you'll need to authenticate every time you open the app
                </Text>
            </View>

            {/* Auto-Detection Section */}
            {Platform.OS === 'android' && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Auto-Detection</Text>
                    <View style={styles.card}>
                        <SettingItem
                            icon="sms"
                            title="SMS Transaction Detection"
                            subtitle={smsPermissionGranted
                                ? 'Automatically capture bank SMS'
                                : 'Permission required'}
                            rightElement={
                                <Switch
                                    value={smsEnabled}
                                    onValueChange={handleSmsToggle}
                                    trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                                    thumbColor={colors.text}
                                />
                            }
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="storefront"
                            title="Merchant Rules"
                            subtitle="Manage saved merchant names"
                            onPress={() => navigation.navigate('MerchantContacts')}
                        />
                        <View style={styles.divider} />
                        <SettingItem
                            icon="history"
                            title="Scan Past Transactions"
                            subtitle="Import expenses from existing SMS"
                            onPress={async () => {
                                Alert.alert(
                                    'Scan Inbox',
                                    'This will scan your last 400 SMS messages for missed transactions. Continue?',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Scan Now',
                                            onPress: async () => {
                                                if (!user) {
                                                    Alert.alert('Error', 'Please login to scan messages.');
                                                    return;
                                                }
                                                console.log(`Starting Inbox Scan for User ID: ${user.id}`);

                                                const granted = await requestSmsPermissions();
                                                if (!granted) {
                                                    Alert.alert('Error', 'SMS permission is required.');
                                                    return;
                                                }

                                                try {
                                                    const messages = await getRecentSms(400);
                                                    if (messages.length === 0) {
                                                        Alert.alert('No Messages', 'No SMS found in inbox.');
                                                        return;
                                                    }

                                                    let added = 0;
                                                    // Process in batches of 20 to speed up
                                                    const BATCH_SIZE = 20;
                                                    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
                                                        const batch = messages.slice(i, i + BATCH_SIZE);
                                                        const results = await Promise.all(batch.map(msg =>
                                                            processSmartSms(
                                                                msg.body,
                                                                msg.address,
                                                                user?.id,
                                                                msg.date,
                                                                true
                                                            )
                                                        ));

                                                        added += results.filter(r => r.success && r.transactionId).length;
                                                    }

                                                    await refreshAll();
                                                    Alert.alert('Scan Complete', `Found and added ${added} transactions from your history.`);
                                                } catch (e) {
                                                    console.error(e);
                                                    Alert.alert('Error', 'Failed to scan inbox.');
                                                }
                                            }
                                        }
                                    ]
                                );
                            }}
                        />
                    </View>
                </View>
            )}

            {/* Data & Backup Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Data & Backup</Text>
                <View style={styles.card}>
                    <SettingItem
                        icon="cloud-upload"
                        title="Backup to Google Drive"
                        subtitle={lastBackup ? `Last: ${formatDate(lastBackup.toISOString())}` : 'Never backed up'}
                        rightElement={
                            isBackingUp ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <TouchableOpacity
                                    style={styles.backupButton}
                                    onPress={handleManualBackup}
                                >
                                    <Text style={styles.backupButtonText}>Backup</Text>
                                </TouchableOpacity>
                            )
                        }
                    />
                    <View style={styles.divider} />
                    <SettingItem
                        icon="cloud-download"
                        title="Restore from Backup"
                        subtitle="Download data from Google Drive"
                        onPress={() => Alert.alert('Restore', 'This will replace your local data. Are you sure?')}
                    />
                </View>
                <Text style={styles.sectionHint}>
                    Your expense data is stored locally on this device. Backup manually when you want to save to Google Drive.
                </Text>
            </View>

            {/* About Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <View style={styles.card}>
                    <SettingItem
                        icon="info"
                        title="App Version"
                        subtitle="1.0.0"
                    />
                    <View style={styles.divider} />
                    <SettingItem
                        icon="privacy-tip"
                        title="Privacy Policy"
                        onPress={() => { }}
                    />
                </View>
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Icon name="logout" size={20} color={colors.debit} />
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
        </ScrollView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        padding: 24,
        paddingTop: 48,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    section: {
        marginBottom: 24,
        paddingHorizontal: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionHint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 8,
        lineHeight: 18,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    profileInfo: {
        marginLeft: 16,
        flex: 1,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    profileEmail: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingContent: {
        flex: 1,
        marginLeft: 14,
    },
    settingTitle: {
        fontSize: 16,
        color: colors.text,
    },
    settingSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginLeft: 70,
    },
    backupButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    backupButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 24,
        marginTop: 8,
        padding: 16,
        backgroundColor: colors.debit + '15',
        borderRadius: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.debit,
        marginLeft: 8,
    },
});
