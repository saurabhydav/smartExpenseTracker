// API configuration and HTTP client setup

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import * as Keychain from 'react-native-keychain';

// API base URL - configure for your environment
// API base URL - configure for your environment
// const API_BASE_URL = __DEV__
//    ? 'http://10.0.2.2:8080' // Android Emulator loopback
//    : 'https://smartexpensetracker-bjlu.onrender.com';

// FORCE USE RENDER BACKEND (As per user troubleshooting)
const API_BASE_URL = 'https://smartexpensetracker-bjlu.onrender.com';

const TOKEN_SERVICE = 'ExpenseTrackerAuth';

// Create axios instance
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000, // Increased to 60s for Render free tier cold starts
    headers: {
        'Content-Type': 'application/json',
    },
});

// Token storage helpers
export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Keychain.setGenericPassword(
        'tokens',
        JSON.stringify({ accessToken, refreshToken }),
        { service: TOKEN_SERVICE }
    );
}

export async function getTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
        const credentials = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
        if (credentials) {
            return JSON.parse(credentials.password);
        }
    } catch (error) {
        console.error('Failed to get tokens:', error);
    }
    return null;
}

export async function clearTokens(): Promise<void> {
    await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
}

// Request interceptor - add auth token
api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        // Skip auth for public endpoints
        if (config.url?.includes('/auth/')) {
            return config;
        }

        const tokens = await getTokens();
        if (tokens?.accessToken) {
            config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // If 401 and not already retrying, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const tokens = await getTokens();
                if (tokens?.refreshToken) {
                    const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
                        refreshToken: tokens.refreshToken,
                    });

                    const { accessToken, refreshToken } = response.data;
                    await saveTokens(accessToken, refreshToken);

                    // Retry original request with new token
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed - clear tokens and redirect to login
                await clearTokens();
                // The app should handle this by checking auth state
            }
        }

        return Promise.reject(error);
    }
);

export default api;
