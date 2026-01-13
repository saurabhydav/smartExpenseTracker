// Authentication service for signup, login, and token management

import api, { saveTokens, clearTokens, getTokens } from './api';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics();

export interface UserInfo {
    id: number;
    name: string;
    email: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
    user: UserInfo;
}

export interface SignupRequest {
    name: string;
    email: string;
    password: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

class AuthService {
    // Check if user is authenticated
    async isAuthenticated(): Promise<boolean> {
        const tokens = await getTokens();
        return !!tokens?.accessToken;
    }

    // Register new user
    async signup(request: SignupRequest): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>('/api/auth/signup', request);
        await saveTokens(response.data.accessToken, response.data.refreshToken);
        return response.data;
    }

    // Login with email and password
    async login(request: LoginRequest): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>('/api/auth/login', request);
        await saveTokens(response.data.accessToken, response.data.refreshToken);
        return response.data;
    }

    // Logout - clear tokens
    async logout(): Promise<void> {
        try {
            await api.post('/api/auth/logout');
        } catch (error) {
            // Ignore logout API errors
            console.log('Logout API error (ignored):', error);
        }
        await clearTokens();
    }

    // Check biometric availability
    async checkBiometricAvailability(): Promise<{
        available: boolean;
        biometryType: string | undefined;
    }> {
        const { available, biometryType } = await rnBiometrics.isSensorAvailable();
        return { available, biometryType };
    }

    // Create biometric key for future authentication
    async setupBiometric(): Promise<boolean> {
        try {
            const { publicKey } = await rnBiometrics.createKeys();
            // Store public key on server for verification if needed
            // For local-first, we just use biometric to unlock keychain
            return !!publicKey;
        } catch (error) {
            console.error('Failed to setup biometric:', error);
            console.log('Setup error details:', JSON.stringify(error));
            return false;
        }
    }

    // Authenticate with biometrics
    async authenticateWithBiometric(): Promise<boolean> {
        try {
            const { success } = await rnBiometrics.simplePrompt({
                promptMessage: 'Authenticate to access Expense Tracker',
                cancelButtonText: 'Cancel',
            });

            if (success) {
                // Check if we have stored tokens
                const tokens = await getTokens();
                return !!tokens?.accessToken;
            }

            return false;
        } catch (error) {
            console.error('Biometric authentication failed:', error);
            console.log('Error details:', JSON.stringify(error));
            return false;
        }
    }

    // Get biometry type name for display
    getBiometryTypeName(type: string | undefined): string {
        switch (type) {
            case BiometryTypes.FaceID:
                return 'Face ID';
            case BiometryTypes.TouchID:
                return 'Touch ID';
            case BiometryTypes.Biometrics:
                return 'Fingerprint';
            default:
                return 'Biometric';
        }
    }
}

export const authService = new AuthService();
export default authService;
