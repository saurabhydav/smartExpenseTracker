// Authentication service for signup, login, and token management

import api, { saveTokens, clearTokens, getTokens } from './api';

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
    // Login with Google ID token
    async googleLogin(idToken: string): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>('/api/auth/google', { idToken });
        await saveTokens(response.data.accessToken, response.data.refreshToken);
        return response.data;
    }
}

export const authService = new AuthService();
export default authService;
