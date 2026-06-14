# `src/services/SmartSmsProcessor.ts` - In-Depth Technical Explanation

This file is the "Central Brain" orchestrator. While `ExpenseParser` breaks strings into pieces, `SmartSmsProcessor` validates the spam score, handles historical healing migrations, resolves physical multi-bank accounts, and executes the actual Database commands.

---

### 1. Spam Filtering & Sender Whitelists (Lines 78-138)
```typescript
export async function validateTransactionSms(sms: string, sender: string): Promise<SmsValidationResult> {
    let confidence = 0;

    // Rule 1: Ignore Promos
    if (/-[P]($|[A-Z])/i.test(sender)) return { isValid: false, ... };

    // Rule 2: Check Whitelist Bank IDs
    const isKnownBank = BANK_SENDER_IDS.some(regex => regex.test(sender));
    if (isKnownBank) confidence += 0.3;

    // Rule 3: Math weighting
    const threshold = 0.6;
    return { isValid: confidence >= threshold, ... }
}
```
*   **Syntax Breakdown**: `/-[P]($|[A-Z])/i` targets DLT headers. In Indian telecom, promotional texts usually route through headers ending in `-P` (like `JD-DOMINOP`). This regex specifically snipes them and kills the validation pipeline instantly.
*   **Flow & Architecture**: It builds a mathematical confidence score out of 1.0. 
    1. If the Sender ID matches a hard-coded regex list of known Indian banks (e.g. `HDFCBK`), it adds `0.3` to the score.
    2. If the text body has strong financial transaction vocabulary, it adds `0.7`.
    3. If the score breaks `0.6`, it allows the transaction through to the actual parser. If it falls below `0.6`, it acts as a firewall, silently killing the process.

---

### 2. Multi-Bank Resolving System (Lines 411-483)
```typescript
async function resolveAccountId(last4: string | undefined, sender: string, userId: number): Promise<number | null> {
    const bankName = sender.replace(/^[A-Z]{2}-/, ''); // AD-HDFCBK -> HDFCBK

    if (!last4) {
        // Try to find ANY generic account for this bank
        const [existing] = await db.executeSql(
            'SELECT id FROM accounts WHERE bank_name = ? ... LIMIT 1', [bankName, userId]
        );
        if (existing.rows.length > 0) return existing.rows.item(0).id;

        // Auto Create a Generic Bucket
        const [result] = await db.executeSql('INSERT INTO accounts...', [`${bankName} Main Account`, bankName]);
        return result.insertId;
    }
}
```
*   **Syntax Breakdown**: `sender.replace(/^[A-Z]{2}-/, '')` rips the strict carrier prefix code off the front of telecom headers, giving us a clean Bank Name to use in UI.
*   **Flow & Architecture**: Often, small transaction alerts don't actually include your Account Number (`last4`). When this happens, the app refuses to crash or throw errors. Instead, it extracts the `bankName` from the raw Sender ID. It looks at the SQL database: "Do I have an account named 'HDFCBK Main Account'?". If no, it dynamically creates a bucket account for the user, and attaches the transaction to it seamlessly.

---

### 3. Cascading Historical Replacements (Lines 197-222)
```typescript
export async function updateAllTransactionsForMerchant(rawName: string, displayName: string, categoryId: number | null) {
    const db = getDatabase();

    // 1. Update Transactions
    await db.executeSql(
        `UPDATE transactions 
         SET merchant = ?, category_id = ? 
         WHERE UPPER(original_merchant) = UPPER(?) OR UPPER(merchant) = UPPER(?)`,
        [displayName, categoryId, rawName, rawName]
    );
}
```
*   **Syntax Breakdown**: `UPPER(...) = UPPER(...)` is critical string sanitation. It removes case sensitivity. If the database logged `Uber` but the user typed a rule for `UBER`, this forces SQLite to ignore casing entirely and still trigger the match.
*   **Flow & Architecture**: This sits underneath the `MerchantNamingModal`. Imagine the background engine scanned 800 texts while the phone was asleep. It found 10 instances of "AMAZN-RETAIL-404". The user wakes up, taps the notification, and types "Amazon" into the modal. This function takes "Amazon", targets the 10 corrupted rows simultaneously across the entire disk, and mathematically overwrites their merchants and categories backward in time.

---

### 4. High-Level Main Pipeline (Lines 260-406)
```typescript
export async function processSmartSms(sms, sender, ...): Promise<{ success: boolean; needsNaming?: boolean }> {
    // 1. Validate
    const validation = await validateTransactionSms(sms, sender);
    if (!validation.isValid) return { success: false };

    // 2. Parse Math
    const parsed = await parseExpense(sms, isKnownBankSender, smsTimestamp);
    
    // 3. Check Phonebook Rules
    const mapping = await getMerchantMapping(parsed.merchant, currentUserId);
    
    // 4. Save
    const transactionId = await insertTransaction(...);

    // 5. Broadcaster
    if (!mapping) {
        if (onNewMerchantCallback) onNewMerchantCallback(unknownMerchant);
        return { success: true, needsNaming: true };
    }
}
```
*   **Flow & Architecture**: The conductor of the symphony. It linearly manages the lifecycle of a text message. It validates (spam block), parses (Regex text-to-JSON), cross-references User Rules (Contact Mapping), safely inserts the result into SQLite via `insertTransaction()`, and ultimately detects if it should emit a trigger (launch a Modal) if the parsing resulted in a completely alien merchant string.
