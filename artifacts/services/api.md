# `src/services/api.ts` - In-Depth Technical Explanation

This file is the HTTP Networking core. It defines the `axios` client, configures base routes to the Node.js backend on Render, and fundamentally controls all Request Authentication and Automatic Token Refresh loops.

---

### 1. Interceptors & Authentication Injection (Lines 51-67)
```typescript
// Request interceptor - add auth token
api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        // Skip auth for public endpoints
        if (config.url?.includes('/auth/')) return config;

        const tokens = await getTokens();
        if (tokens?.accessToken) {
            config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);
```
*   **Syntax Breakdown**: `api.interceptors.request.use`. This is middleware for outbound network requests.
*   **Flow & Architecture**: Whenever *any* component calls `api.post('/some/route')`, it pauses right before stepping off the user's phone. 
    1. It checks if the destination URL is `/auth/` (Login/Signup). If so, it passes through freely.
    2. If it's a secured route, it natively dips into the hardware `Keychain` to pull the `accessToken`. 
    3. It statically modifies the outbound network packet, attaching a `Bearer` token to the headers. This guarantees that developers never have to manually attach tokens to every single API call across the codebase.

---

### 2. The Auto-Healing Refresh Loop (Lines 69-102)
```typescript
// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // If 401 Unauthorized and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const tokens = await getTokens();
                if (tokens?.refreshToken) {
                    // Ask server for a new access token
                    const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
                        refreshToken: tokens.refreshToken,
                    });

                    // Save new tokens
                    const { accessToken, refreshToken } = response.data;
                    await saveTokens(accessToken, refreshToken);

                    // Re-fire the original dead request
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                await clearTokens(); // Hard logout
            }
        }
        return Promise.reject(error);
    }
);
```
*   **Flow & Architecture**: This is critical for mobile apps. Access Tokens naturally die every 15 minutes. 
    1. The user tries to load `/api/budget` but their token died 2 minutes ago.
    2. The Server rejects the packet and throws a `401 Unauthorized` error back to the phone.
    3. The Interceptor catches the `401`. Before the UI crashes or forcing the user to log in again, it pauses the timeline.
    4. It takes the long-lived 30-day `refreshToken`, asks the server for a fresh 15-minute token, and saves it into the OS Keychain.
    5. It then *resurrects* the original `/api/budget` request with the new key, and fires it again. To the user clicking the button, there was a 200ms delay, but they remained fully logged in. 
    6. `originalRequest._retry = true` acts as a kill-switch. If the *refresh* route also fails, this prevents the interceptor from entering an infinite loop of death.
