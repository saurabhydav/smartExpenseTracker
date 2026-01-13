# Expense Tracker - Deep Dive Code Explanation

This document explains the **exact working** of the code, file by file.

---

## 📱 PART 1: FRONTEND (React Native)

### 1. `src/services/SmartSmsProcessor.ts`
**Role:** The "Brain". Orchestrates everything when an SMS arrives.

**Code Breakdown:**
```typescript
// Imports: We need Database access, Parser logic, and Event Emitter for UI updates
import { getDatabase, insertTransaction } from '../database/database';
import { parseExpenseWithRegex, validateTransactionSms } from './ExpenseParser';
import { DeviceEventEmitter } from 'react-native';

// Main Function: Called by SmsHandler when a text arrives
export async function processSmartSms(sms: string, sender: string, userId: number, timestamp?: number, suppressNotification = false) {
    
    // 1. Validation: Is this a bank SMS? (Ignore "Your OTP is 1234")
    if (!validateTransactionSms(sms)) {
        console.log('Ignored non-transaction SMS');
        return { success: false };
    }

    // 2. Parsing: Turn text "Debit Rs 500 Starbucks" into { amount: 500, merchant: "Starbucks" }
    //    We pass 'isKnownSender' to relax rules for known banks like HDFC.
    const isKnownSender = Object.keys(BANK_SENDER_IDS).some(id => sender.includes(id));
    const parsed = parseExpenseWithRegex(sms, isKnownSender);

    if (!parsed) return { success: false }; // Failed to parse? Stop.

    // 3. Merchant Rules: Check if we have a saved name for "UPI-STARBUCKS-123"
    //    If yes, 'displayName' becomes "Starbucks". If no, it stays raw.
    let displayName = parsed.merchant;
    const mapping = await getMerchantMapping(parsed.merchant, userId);
    if (mapping) {
        displayName = mapping.displayName;
    }

    // 4. Account Resolution: "XXX-1234". Do we know this account?
    //    If not, we CREATE it right here (Auto-discovery).
    const accountId = await resolveAccountId(parsed.accountLast4, sender, userId);

    // 5. Save to Database: The final persistent storage step.
    const transactionId = await insertTransaction({
        amount: parsed.amount,
        type: parsed.type, // 'debit' or 'credit'
        merchant: displayName,
        accountId,
        user_id: userId,
        date: new Date(timestamp || Date.now()).toISOString(),
        raw_sms: sms
    });

    // 6. INSTANT NOTIFICATION:
    //    "Hey Dashboard! I changed the data! Refresh yourself!"
    //    (Skipped if 'suppressNotification' is true, e.g., during Bulk Scan)
    if (!suppressNotification) {
        DeviceEventEmitter.emit('TRANSACTION_UPDATED');
    }

    return { success: true, transactionId };
}
```

### 2. `src/services/ExpenseParser.ts`
**Role:** The "Translator". Converts human text to machine data.

**Key Logic:**
```typescript
// Regex Patterns: These are the rules to find data.
// \b(INR|Rs\.?|CAD)\s*[\d,]+\.?\d* -> Finds "Rs. 500", "INR 1,200.50"
const AMOUNT_REGEX = /\b(?:INR|Rs\.?|CAD|USD|EUR|GBP)\s*([\d,]+\.?\d*)\b/i;

export function parseExpenseWithRegex(sms: string, isKnownBank: boolean) {
    // 1. Clean the SMS (Remove newlines, extra spaces)
    const cleanSms = sms.replace(/\s+/g, ' ').trim();

    // 2. Extract Amount
    const amountMatch = cleanSms.match(AMOUNT_REGEX);
    if (!amountMatch) return null; // No money? Not an expense.
    const amount = parseFloat(amountMatch[1].replace(/,/g, '')); // "1,000" -> 1000

    // 3. Determine Type (Debit vs Credit)
    //    If it says "credited", it's INCOME.
    //    If it says "debited" or "spent", it's EXPENSE.
    const type = getTransactionType(cleanSms); 

    // 4. Extract Merchant (The hardest part)
    //    We look for text after "at", "to", "vpza", "paytm" etc.
    const merchant = extractMerchant(cleanSms);

    return { amount, type, merchant };
}
```

### 3. `src/database/database.ts`
**Role:** The "Vault". Handles all SQLite operations.

**Key Functions:**
```typescript
// Initializes the DB. Runs ONCE when app starts.
export async function initDatabase() {
    db = await SQLite.openDatabase({ name: 'expense_tracker.db' });
    
    // Create Tables if they don't exist
    await db.executeSql('CREATE TABLE IF NOT EXISTS transactions (...)');
    
    // Migrations: Fix old versions of the app
    // e.g. "Oh, user_id didn't exist in v1.0, let's add it now."
    try {
        await db.executeSql('ALTER TABLE transactions ADD COLUMN user_id INTEGER');
    } catch (e) { /* Column already exists, ignore */ }
}

// Inserts a new row.
export async function insertTransaction(t, checkDuplicates = true) {
    // DUPLICATE CHECK (Safeguard): 
    // "Did we already save Rs 500 at Starbucks exactly at this time?"
    // 
    // RULE:
    // 1. Manual Entry: checkDuplicates = false (We ALLOW you to add duplicates)
    // 2. Automatic SMS: checkDuplicates = true (We BLOCK duplicates to prevent errors)
    if (checkDuplicates) {
        const existing = await db.executeSql('SELECT id FROM transactions WHERE ...');
        if (existing.rows.length > 0) return existing.rows.item(0).id; // Blocked!
    }
    
    // Insert

    // Insert
    const res = await db.executeSql(
        'INSERT INTO transactions (amount, merchant...) VALUES (?, ?...)',
        [t.amount, t.merchant...]
    );
    return res.insertId;
}
```

### 4. `src/screens/MerchantContactsScreen.tsx` (Merchant Rules)
**Role:** The "Dictionary Manager". Teaches the app new words.

**Key Logic:**
```typescript
// 1. Fetch "Unnamed" Merchants (The ones we don't know yet)
//    Previously, this was limited to top 5. NOW IT SHOWS ALL.
const unnamed = await getUnnamedMerchants(user.id);

// 2. Render List
//    User taps an "Unnamed" item -> Opens Modal -> Saves Rule.
{unnamed.map(m => ( // No more .slice(0, 5)!
     <View key={m.rawName}>{renderUnnamed({ item: m })}</View>
))}
```

### 5. `App.tsx`
**Role:** The "Traffic Cop". Decides which screen to show.

**Code Breakdown:**
```typescript
// State Management: We use 'zustand' to keep track of "Is User Logged In?"
const useAppStore = create((set) => ({
    isAuthenticated: false,
    checkAuth: async () => {
        // 1. Check for Token in Secure Storage
        const token = await EncryptedStorage.getItem('jwt_token');
        if (token) set({ isAuthenticated: true });
    },
}));

export default function App() {
    // 2. Main Render Loop
    return (
        <NavigationContainer>
            {/* 3. Conditional Navigation: The most important line in the app */}
            {isAuthenticated ? (
                // If Logged In -> Show Tabs (Dashboard, Settings)
                <Tab.Navigator>
                     <Tab.Screen name="Dashboard" component={DashboardScreen} />
                </Tab.Navigator>
            ) : (
                // If Not Logged In -> Show Login/Signup Screens
                <Stack.Navigator>
                    <Stack.Screen name="Login" component={LoginScreen} />
                </Stack.Navigator>
            )}
        </NavigationContainer>
    );
}
```

### 6. `src/screens/DashboardScreen.tsx`
**Role:** The "Face". Displays the data.

**Code Breakdown:**
```typescript
export default function DashboardScreen() {
    // State: Holds the numbers we show on screen
    const [totalExpense, setTotalExpense] = useState(0);

    // Function: Fetches data from SQLite
    const refreshAll = async () => {
        const total = await db.executeSql('SELECT SUM(amount) ...');
        setTotalExpense(total);
    }

    // Lifecycle Hook: Runs when screen loads
    useEffect(() => {
        // 1. Initial Load
        refreshAll();

        // 2. LISTEN FOR UPDATES (The Magic)
        //    This waits for SmartSmsProcessor to say "TRANSACTION_UPDATED"
        const listener = DeviceEventEmitter.addListener('TRANSACTION_UPDATED', () => {
             console.log("New SMS! Refreshing UI...");
             refreshAll();
        });

        // 3. Cleanup: Stop listening when screen closes
        return () => listener.remove();
    }, []);

    return (
        <View>
            <Text>Total Spent: {totalExpense}</Text>
            {/* Charts, Lists, etc. */}
        </View>
    );
}

---

## 🗑️ FAQ: How to Delete All Data (Reset App)

Since this app uses a **Local-First SQLite Database**, your data is stored securely inside the app's private sandbox on your phone.

**You cannot delete the database file using a File Manager** (Android blocks access to this folder for security).

**To Wipe Everything:**
1.  Go to **Phone Settings**.
2.  Tap **Apps** (or App Management) -> **Expense Tracker**.
3.  Tap **Storage & Cache**.
4.  Tap **Clear Storage** (or Clear Data).

This will delete:
*   The `expense_tracker.db` file (All transactions).
*   Your Login Token (You will need to login again).
*   Any saved preferences.
```

---

## 🖥️ PART 2: BACKEND (Spring Boot)

### 1. `AuthController.java`
**Role:** The API Endpoint. Defined URLs.

**Code Breakdown:**
```java
@RestController
@RequestMapping("/api/auth") // Base URL: http://localhost:8080/api/auth
public class AuthController {

    // Dependency Injection: Spring gives us the tools we need
    @Autowired private AuthenticationManager authManager;
    @Autowired private JwtTokenProvider tokenProvider;

    // Login Endpoint
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest) {
        
        // 1. The Real Check: Does email/password match DB?
        //    This throws an error if password is wrong.
        Authentication authentication = authManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                loginRequest.getEmail(),
                loginRequest.getPassword()
            )
        );

        // 2. Create Token: If 1 passed, generate "eyBhGci..." string
        String jwt = tokenProvider.generateToken(authentication);

        // 3. Reply: Send token back to phone
        return ResponseEntity.ok(new JwtAuthenticationResponse(jwt));
    }
}
```

### 2. `JwtAuthenticationFilter.java`
**Role:** The Security Guard. Checks every single request.

**Code Breakdown:**
```java
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, ...) {
        // 1. Get the "Authorization" header
        String token = getJwtFromRequest(request);

        // 2. Validate The Token
        //    - Is it expired? 
        //    - Is the signature valid? (Did WE sign it?)
        if (StringUtils.hasText(token) && tokenProvider.validateToken(token)) {
            
            // 3. Extract User ID from Token
            Long userId = tokenProvider.getUserIdFromJWT(token);

            // 4. Load User Details from DB
            UserDetails userDetails = customUserDetailsService.loadUserById(userId);

            // 5. Stamp Approval: "This request is authenticated as User X"
            //    SecurityContextHolder is where Spring keeps "Who is currently logged in?"
            UsernamePasswordAuthenticationToken authentication = ...;
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        // 6. Continue: Pass request to the Controller
        filterChain.doFilter(request, response);
    }
}
```

### 3. `SecurityConfig.java`
**Role:** The Rules.

**Code Breakdown:**
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        // Disable CSRF (Because we use Tokens, not Cookies)
        .csrf(csrf -> csrf.disable())
        
        // Definition of Public vs Private URLs
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/auth/**").permitAll() // Login/Signup is PUBLIC
            .anyRequest().authenticated()                // Everything else is PRIVATE
        );
    
    // Add our Filter (The Guard) before the default Spring filter
    http.addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);
    
    return http.build();
}
```

---

## 🔁 PART 3: The Working Flow (End-to-End)

**Scenario: User Logs In & Scans an SMS.**

1.  **Mobile (LoginScreen.tsx)**:
    *   User types email/pass -> Clicks "Login".
    *   Calls `api.post('/auth/login')`.
2.  **Backend (AuthController.java)**:
    *   Receives request.
    *   Checks DB (`users` table). Password Correct? Yes.
    *   Generates JWT. Returns it.
3.  **Mobile (App.tsx)**:
    *   Saves JWT in secure storage.
    *   Sets `isAuthenticated = true`.
    *   Switches UI to **Dashboard**.
4.  **Mobile (Background)**:
    *   SMS Arrives.
    *   `SmartSmsProcessor.ts` reads it.
    *   Saves to `expense_tracker.db` (SQLite).
    *   Fires event.
5.  **Mobile (DashboardScreen.tsx)**:
    *   Hears event.
    *   Read `expense_tracker.db`.
    *   Updates the Balance Text on screen.
