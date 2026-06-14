# `src/services/AuthService.ts` - In-Depth Technical Explanation

This file is a thin abstraction layer over the backend API. It manages security token exchange formatting and acts as the gatekeeper for user entry.

---

### 1. Types & Interfaces (Lines 5-28)
```typescript
export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
    user: UserInfo;
}
```
*   **Syntax Breakdown**: These interfaces strictly define the JSON payloads expected from the Node.js backend. 
*   **Flow & Architecture**: Modern secure apps do not keep "passwords" on the phone. When a user logs in, the backend sends a temporary `accessToken` (lasts 15 minutes) and a long-lived `refreshToken` (lasts 30 days). This interface acts as the strict mold for that payload so the rest of the app knows what variables are available.

---

### 2. Login & Token Persistance (Lines 44-49)
```typescript
    async login(request: LoginRequest): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>('/api/auth/login', request);
        await saveTokens(response.data.accessToken, response.data.refreshToken);
        return response.data;
    }
```
*   **Syntax Breakdown**: `api.post<AuthResponse>` uses an Axios generic. It tells the HTTP client that whatever JSON comes back from the server will perfectly match the `AuthResponse` interface. 
*   **Flow & Architecture**: 
    1. It fires an encrypted HTTP payload to the server containing `{ email, password }`.
    2. It waits for the server to reply with the Tokens.
    3. Before telling the UI that login was successful, it halts and calls `saveTokens()`. This buries the `accessToken` into the phone's encrypted native OS Keychain (Secure Enclave on iOS, Keystore on Android). 
    4. Only after the keys are safely locked inside the hardware does it return the payload to the UI, allowing `useAppStore` to set `isAuthenticated` to true.

---

### 3. Graceful Logout Strategy (Lines 51-60)
```typescript
    async logout(): Promise<void> {
        try {
            await api.post('/api/auth/logout');
        } catch (error) {
            console.log('Logout API error (ignored):', error);
        }
        await clearTokens();
    }
```
*   **Syntax Breakdown**: `try...catch` block gracefully catches crashes without destroying the app flow.
*   **Flow & Architecture**: If a user is on an airplane with no internet and clicks "Log Out", the `api.post` will catastrophically fail because it can't reach the server. If this crashed the app, the user would be permanently stuck logged in. The `catch` block catches the network failure, ignores it, and forcefully calls `clearTokens()` anyway, physically deleting the keys from the device's hardware enclave so the local app locks them out securely, regardless of the server's state.
