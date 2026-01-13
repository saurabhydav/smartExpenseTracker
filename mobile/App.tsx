// Main App Entry Point with Navigation and Biometric Lock

import React, { useEffect, useState } from 'react';
import { StatusBar, ActivityIndicator, View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAppStore } from './src/store';
import { initDatabase } from './src/database';
import { colors, setGlobalCurrency } from './src/utils';
import {
    LoginScreen,
    SignupScreen,
    DashboardScreen,
    TransactionsScreen,
    AddTransactionScreen,
    SettingsScreen,
    BudgetScreen,
    InsightsScreen,
    MerchantContactsScreen,
    BiometricLockScreen,
    TransactionDetailScreen,
} from './src/screens';
import { isBiometricLockEnabled } from './src/screens/BiometricLockScreen';

// Import SMS handler to register HeadlessJS task
import './src/services/SmsHandler';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Stack (Login/Signup)
function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
        </Stack.Navigator>
    );
}

// Main Tab Navigator
function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarIcon: ({ color, size }) => {
                    let iconName = 'home';

                    switch (route.name) {
                        case 'Dashboard':
                            iconName = 'dashboard';
                            break;
                        case 'Transactions':
                            iconName = 'receipt-long';
                            break;
                        case 'Insights':
                            iconName = 'insights';
                            break;
                        case 'Budget':
                            iconName = 'pie-chart';
                            break;
                        case 'Settings':
                            iconName = 'settings';
                            break;
                    }

                    return <Icon name={iconName} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Transactions" component={TransactionsScreen} />
            <Tab.Screen name="Insights" component={InsightsScreen} />
            <Tab.Screen name="Budget" component={BudgetScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

// App Stack with modals
function AppStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
                name="AddTransaction"
                component={AddTransactionScreen}
                options={{ presentation: 'modal' }}
            />
            <Stack.Screen
                name="MerchantContacts"
                component={MerchantContactsScreen}
            />
            <Stack.Screen
                name="TransactionDetail"
                component={TransactionDetailScreen}
                options={{ presentation: 'card' }}
            />
        </Stack.Navigator>
    );
}

import MerchantNamingModal from './src/components/MerchantNamingModal';
import { onNewMerchantDetected, getUnnamedMerchants, type UnknownMerchant } from './src/services/SmartSmsProcessor';

// ... imports

// Main App Component with Biometric Lock
export default function App() {
    const isAuthenticated = useAppStore(state => state.isAuthenticated);
    const isLoading = useAppStore(state => state.isLoading);
    const checkAuth = useAppStore(state => state.checkAuth);
    const loadCategories = useAppStore(state => state.loadCategories);
    const [dbReady, setDbReady] = useState(false);
    const [isLocked, setIsLocked] = useState(true); // Start locked
    const [biometricEnabled, setBiometricEnabled] = useState(false);

    // New merchant naming state
    const [newMerchant, setNewMerchant] = useState<UnknownMerchant | null>(null);

    // Sync currency to helpers
    const currencySymbol = useAppStore(state => state.currencySymbol);
    useEffect(() => {
        // We store '₹', '$' etc in store, but helpers needs 'INR', 'USD'.
        // Mapping:
        const map: { [key: string]: string } = { '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };
        setGlobalCurrency(map[currencySymbol] || 'INR');
    }, [currencySymbol]);

    useEffect(() => {
        async function initialize() {
            try {
                // Initialize database (local SQLite - expenses stay on device)
                await initDatabase();
                setDbReady(true);

                // Load categories from local database
                loadCategories();

                // Check if biometric lock is enabled
                const lockEnabled = await isBiometricLockEnabled();
                setBiometricEnabled(lockEnabled);

                // If lock not enabled, unlock immediately
                if (!lockEnabled) {
                    setIsLocked(false);
                }

                // Check authentication (tokens stored locally)
                await checkAuth();

                // Register callback for new merchant detection
                onNewMerchantDetected((merchant) => {
                    console.log('Received new merchant in App:', merchant.rawName);
                    setNewMerchant(merchant);
                });


            } catch (error) {
                console.error('Initialization failed:', error);
            }
        }

        initialize();
    }, []);

    // Reload categories when key authentication state changes (login/logout)
    useEffect(() => {
        if (isAuthenticated) {
            loadCategories();
        }
    }, [isAuthenticated]);

    // Lock app when it goes to background (check storage directly to ensure fresh state)
    useEffect(() => {
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (nextAppState === 'background') {
                // Check storage directly because user might have changed settings 
                // while app was open (and state here might be stale)
                const enabled = await isBiometricLockEnabled();
                setBiometricEnabled(enabled); // Sync local state

                if (enabled) {
                    setIsLocked(true);
                }
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, []);

    const handleUnlock = () => {
        setIsLocked(false);
    };


    // Show loading screen while initializing
    if (!dbReady || isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <StatusBar barStyle="light-content" backgroundColor={colors.background} />
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // Show biometric lock screen if locked and authenticated
    if (isLocked && isAuthenticated && biometricEnabled) {
        return (
            <>
                <StatusBar barStyle="light-content" backgroundColor={colors.background} />
                <BiometricLockScreen onUnlock={handleUnlock} />
            </>
        );
    }

    return (
        <NavigationContainer>
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />
            {isAuthenticated ? <AppStack /> : <AuthStack />}

            <MerchantNamingModal
                visible={!!newMerchant}
                merchant={newMerchant}
                onComplete={() => setNewMerchant(null)}
                onSkip={() => setNewMerchant(null)}
            />
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
