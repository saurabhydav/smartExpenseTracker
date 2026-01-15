// Login Screen with email/password and biometric authentication

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { authService } from '../services';
import { useAppStore } from '../store';
import { colors } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface LoginScreenProps {
    navigation: any;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricType, setBiometricType] = useState<string | undefined>();

    const { setUser, setAuthenticated } = useAppStore();

    useEffect(() => {
        checkBiometricAvailability();
    }, []);

    const checkBiometricAvailability = async () => {
        const { available, biometryType } = await authService.checkBiometricAvailability();
        setBiometricAvailable(available);
        setBiometricType(biometryType);
    };

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setIsLoading(true);
        try {
            const response = await authService.login({ email, password });
            setUser(response.user);

            // Check if biometric is available and ask to enable lock
            const { available } = await authService.checkBiometricAvailability();
            if (available) {
                // Import this dynamically or assume we can save it to storage
                const { setBiometricLockEnabled } = require('./BiometricLockScreen');

                Alert.alert(
                    'Enable Biometric Lock?',
                    'Would you like to secure the app with biometrics for future access?',
                    [
                        {
                            text: 'No',
                            onPress: () => setAuthenticated(true),
                            style: 'cancel'
                        },
                        {
                            text: 'Yes, Secure App',
                            onPress: async () => {
                                await setBiometricLockEnabled(true);
                                setAuthenticated(true);
                            }
                        }
                    ]
                );
            } else {
                setAuthenticated(true);
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message || 'Invalid email or password';
            Alert.alert('Login Failed', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBiometricLogin = async () => {
        setIsLoading(true);
        try {
            const success = await authService.authenticateWithBiometric();
            if (success) {
                setAuthenticated(true);
            } else {
                Alert.alert('Authentication Failed', 'Biometric authentication failed');
            }
        } catch (error) {
            Alert.alert('Error', 'Biometric authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <Icon name="account-balance-wallet" size={60} color={colors.primary} />
                <Text style={styles.title}>Expense Tracker</Text>
                <Text style={styles.subtitle}>Track your expenses smartly</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <Icon name="email" size={20} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={colors.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Icon name="lock" size={20} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={colors.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Icon
                            name={showPassword ? 'visibility' : 'visibility-off'}
                            size={20}
                            color={colors.textMuted}
                        />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={colors.text} />
                    ) : (
                        <Text style={styles.loginButtonText}>Log In</Text>
                    )}
                </TouchableOpacity>

                {/* Biometric login button removed as per user request */}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account?</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                        <Text style={styles.signupLink}>Sign Up</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.text,
        marginTop: 16,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: 8,
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: 52,
        fontSize: 16,
        color: colors.text,
    },
    loginButton: {
        backgroundColor: colors.primary,
        height: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    loginButtonText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    biometricButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        marginTop: 16,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 12,
    },
    biometricText: {
        color: colors.primary,
        fontSize: 16,
        marginLeft: 8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
    },
    footerText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    signupLink: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
});
