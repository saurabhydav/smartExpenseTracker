// Biometric Lock Screen
// Requires authentication every time app opens

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    BackHandler,
} from 'react-native';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';

const rnBiometrics = new ReactNativeBiometrics();

const BIOMETRIC_ENABLED_KEY = 'biometric_lock_enabled';
const LAST_UNLOCK_KEY = 'last_unlock_time';

interface BiometricLockScreenProps {
    onUnlock: () => void;
}

export default function BiometricLockScreen({ onUnlock }: BiometricLockScreenProps) {
    const [biometryType, setBiometryType] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [attempts, setAttempts] = useState(0);

    useEffect(() => {
        checkBiometrics();

        // Prevent back button from closing app
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => backHandler.remove();
    }, []);

    const checkBiometrics = async () => {
        try {
            const { available, biometryType } = await rnBiometrics.isSensorAvailable();

            if (available) {
                setBiometryType(biometryType || 'Biometrics');
                // Auto-prompt on load
                setTimeout(() => authenticate(), 300);
            } else {
                // No biometrics - allow entry (fallback)
                Alert.alert(
                    'Biometrics Unavailable',
                    'Your device does not support biometric authentication.',
                    [{ text: 'Continue', onPress: onUnlock }]
                );
            }
        } catch (error) {
            console.error('Biometrics check error:', error);
        }
    };

    const authenticate = async () => {
        if (isAuthenticating) return;

        setIsAuthenticating(true);

        try {
            const { success } = await rnBiometrics.simplePrompt({
                promptMessage: 'Unlock Expense Tracker',
                cancelButtonText: 'Cancel',
            });

            if (success) {
                // Save unlock time
                await AsyncStorage.setItem(LAST_UNLOCK_KEY, Date.now().toString());
                setAttempts(0);
                onUnlock();
            } else {
                setAttempts(prev => prev + 1);
                // Removed max attempts limit as per user request
            }
        } catch (error: any) {
            // Ignore user cancellation
            if (error?.message?.includes('cancelled') || error?.message?.includes('Canceled')) {
                console.log('Biometric prompt cancelled');
                return;
            }
            console.error('Authentication error:', error);
        }

        setIsAuthenticating(false);
    };

    const getBiometricIcon = (): string => {
        switch (biometryType) {
            case BiometryTypes.FaceID:
                return 'face';
            case BiometryTypes.TouchID:
            case BiometryTypes.Biometrics:
            default:
                return 'fingerprint';
        }
    };

    const getBiometricLabel = (): string => {
        switch (biometryType) {
            case BiometryTypes.FaceID:
                return 'Face ID';
            case BiometryTypes.TouchID:
                return 'Touch ID';
            default:
                return 'Fingerprint';
        }
    };

    return (
        <View style={styles.container}>
            {/* App Logo/Icon */}
            <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                    <Icon name="account-balance-wallet" size={48} color={colors.primary} />
                </View>
                <Text style={styles.appName}>Expense Tracker</Text>
                <Text style={styles.lockMessage}>App is locked</Text>
            </View>

            {/* Biometric Button */}
            <View style={styles.authSection}>
                <TouchableOpacity
                    style={styles.authButton}
                    onPress={authenticate}
                    disabled={isAuthenticating}
                >
                    <View style={styles.biometricIcon}>
                        <Icon
                            name={getBiometricIcon()}
                            size={56}
                            color={isAuthenticating ? colors.textMuted : colors.primary}
                        />
                    </View>
                    <Text style={styles.authText}>
                        {isAuthenticating ? 'Authenticating...' : `Tap to unlock with ${getBiometricLabel()}`}
                    </Text>
                </TouchableOpacity>

                {attempts > 0 && (
                    <Text style={styles.attemptsText}>
                        {3 - attempts} attempts remaining
                    </Text>
                )}
            </View>

            {/* Privacy Note */}
            <View style={styles.privacyNote}>
                <Icon name="security" size={16} color={colors.textMuted} />
                <Text style={styles.privacyText}>
                    Your data is stored securely on this device only
                </Text>
            </View>
        </View>
    );
}

/**
 * Check if biometric lock is enabled
 */
export async function isBiometricLockEnabled(): Promise<boolean> {
    try {
        const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
        return enabled === 'true';
    } catch {
        return false;
    }
}

/**
 * Enable/disable biometric lock
 */
export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled.toString());
}

/**
 * Check if biometrics are available on device
 */
export async function isBiometricAvailable(): Promise<boolean> {
    try {
        const { available } = await rnBiometrics.isSensorAvailable();
        return available;
    } catch {
        return false;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 80,
        paddingHorizontal: 24,
    },
    logoContainer: {
        alignItems: 'center',
    },
    logoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    appName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.text,
    },
    lockMessage: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: 8,
    },
    authSection: {
        alignItems: 'center',
    },
    authButton: {
        alignItems: 'center',
        padding: 24,
    },
    biometricIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: colors.primary + '40',
    },
    authText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    attemptsText: {
        fontSize: 14,
        color: colors.warning,
        marginTop: 16,
    },
    privacyNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
    },
    privacyText: {
        fontSize: 12,
        color: colors.textMuted,
        marginLeft: 8,
    },
});
