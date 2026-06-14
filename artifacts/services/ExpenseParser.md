# `src/services/ExpenseParser.ts` - In-Depth Technical Explanation

This file is a pure text-processing engine. It takes raw, unstructured human SMS strings and uses advanced Regular Expressions (Regex) and heuristics to extract clean structured JSON objects.

---

### 1. The Regular Expression Engine (Lines 49-54 & 179-181)
```typescript
// Account extraction patterns
const ACCOUNT_PATTERNS = [
    /(?:A\/c|Acct|Account)\s+(?:no\.|ending)?\s*[:\-\s]?\s*(?:[X*]+)(\d{3,4})/i,
];

// Amount Match
const amountMatch = sms.match(/(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i);
```
*   **Syntax Breakdown**: 
    - `(?:Rs\.?|INR)`: A Non-Capturing Group. It looks for "Rs.", "Rs", or "INR", but doesn't bother saving that text into memory.
    - `([\d,]+(?:\.\d{2})?)`: A Capturing Group `()`. This actively targets numbers `\d`, commas `,`, and optionally `?` grabs exactly two decimal points `.\d{2}`. Because this is wrapped in a standard parenthesis, the engine saves this specific numerical float into `amountMatch[1]`.
*   **Flow & Architecture**: A text like "Spent Rs. 4,500.50 at Amazon" hits this engine. It ignores the text and strictly extracts "4,500.50". The `parseAmount` function then runs a global regex (`replace(/,/g, '')`) to strip commas so SQLite can do math on `4500.50`.

---

### 2. Deep Transaction Type Logic (Lines 60-84)
```typescript
function getTransactionType(smsOrType: string): 'debit' | 'credit' {
    const lower = smsOrType.toLowerCase();
    // ...
    // Explicit Credit indicators
    if (lower.match(/\b(credited|received|deposited|added\s+to|refund|inward)\b/)) {
        return 'credit';
    }
    // Explicit Debit indicators
    if (lower.match(/\b(debited|spent|paid|sent|withdrawn|withdraw|purchase)\b/)) {
        return 'debit';
    }
    return 'debit'; // Default to expense
}
```
*   **Syntax Breakdown**: `\b` enforces a "Word Boundary". If a text says "discredited", without `\b`, the regex would accidentally trigger on "credited". `\b` ensures we only flag exact, isolated words.
*   **Flow & Architecture**: Banks are inconsistent. Some use `Dr.` and `Cr.`, some use plain English. The parser builds a waterfall hierarchy:
    1. First, look for explicitly clear Debit/Credit acronyms in the same sentence.
    2. Then, check against a dictionary of strong "Income" verbs (refund, deposited).
    3. Lastly, check dictionary verbs for "Expense".
    4. If the message is completely vague ("Amount Rs 500 transferred"), it defaults to `debit` under the assumption that 90% of user transactions are spending.

---

### 3. Merchant NLP Cleanup (Lines 111-149)
```typescript
function cleanMerchantName(raw: string): string {
    let name = raw.trim();

    // Preserve UPI IDs (e.g. 8007320919@ybl)
    if (name.includes('@') && !name.includes(' ')) return name;

    // Fast Path Knowledge Base
    for (const [key, displayName] of Object.entries(COMMON_MERCHANTS)) {
        if (name.toUpperCase().includes(key)) return displayName;
    }

    // Remove garbage
    name = name.replace(/^(VPS|IPS|REV|UPI|IMPS|NEFT)[\/-]?/i, '');
    
    // Capitalize First Letters
    const cleaned = name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
```
*   **Flow & Architecture**: When `parseExpenseWithRegex` pulls out a block of text targeting who the money went to, it often looks horrible (e.g., `UPI/REV/ZOMATO/40302/Mumbai`). 
    1. **Bypass**: If the regex notices an `@` with no spaces, it recognizes a clean UPI ID and aborts cleaning so the user can see exact UPI addresses.
    2. **Fast Matching**: It checks the `COMMON_MERCHANTS` dictionary. If the messy string contains `ZOMATO`, it immediately deletes everything else and just returns "Zomato".
    3. **Regex Sterilization**: If it's a completely unknown store, it forcefully strips out standard Indian banking prefixes (`IMPS/`, `NEFT/`), removes double spaces, and standardizes capitalization so `joe coffee` becomes `Joe Coffee`.

---

### 4. Categorization Fallback Dictionary (Lines 237-258)
```typescript
    const categoryKeywords: { [key: string]: string[] } = {
        'Food & Dining': ['zomato', 'swiggy', 'dominos', 'pizza', 'restaurant'],
        'Transportation': ['uber', 'ola', 'rapido', 'petrol', 'fuel'],
    };

    for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => lowerMerchant.includes(keyword))) {
            const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
            if (category) return category.id;
        }
    }
```
*   **Syntax Breakdown**: `keywords.some()` is a short-circuit array loop. As soon as it finds one match (e.g. it hits "uber" in "Uber Rides"), it stops processing the rest of the array immediately to save CPU cycles.
*   **Flow & Architecture**: If the App detects a brand new merchant, it runs this offline categorization dictionary. It scans the raw name against localized keywords. If it can confidently guess, it automatically tags the Database ID. If not, the UI will fall back to "Select Category" when the user clicks on the transaction.
