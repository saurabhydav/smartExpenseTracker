import { getMerchantMapping, insertMerchantMapping, insertTransaction, getCategories } from '../database';

export interface ParsedExpense {
    amount: number;
    merchant: string;
    type: 'debit' | 'credit';
    date: string;
    accountLast4?: string;
    bankName?: string;
}




// "Smart" Knowledge Base for known merchants
const COMMON_MERCHANTS: { [key: string]: string } = {
    'ZOMATO': 'Zomato',
    'SWIGGY': 'Swiggy',
    'UBER': 'Uber',
    'OLA': 'Ola',
    'AMAZON': 'Amazon',
    'FLIPKART': 'Flipkart',
    'MYNTRA': 'Myntra',
    'NETFLIX': 'Netflix',
    'SPOTIFY': 'Spotify',
    'APPLE': 'Apple',
    'GOOGLE': 'Google',
    'JIO': 'Jio',
    'AIRTEL': 'Airtel',
    'VI': 'Vi',
    'PAYTM': 'Paytm',
    'PHONEPE': 'PhonePe',
    'RAZORPAY': 'Razorpay',
    'DMART': 'DMart',
    'STARBUCKS': 'Starbucks',
    'MCDONALDS': 'McDonalds',
    'KFC': 'KFC',
    'DOMINOS': 'Dominos',
    'PIZZA': 'Pizza Hut',
    'IRCTC': 'IRCTC',
    'INDIGO': 'IndiGo',
    'AIRINDIA': 'Air India',
    'DTH': 'DTH Recharge',
    'BESCOM': 'Electricity Bill',
    'BWSSB': 'Water Bill',
    'ACT': 'ACT Fibernet',
};

// Account extraction patterns
const ACCOUNT_PATTERNS = [
    /(?:A\/c|Acct|Account)\s+(?:no\.|ending)?\s*[:\-\s]?\s*(?:[X*]+)(\d{3,4})/i,
    /(?:Card)\s+(?:no\.|ending)?\s*[:\-\s]?\s*(?:[X*]+)(\d{3,4})/i,
    /(?:A\/c|Acct|Card)\s+(?:[X*]+)(\d{3,4})/i
];

function parseAmount(amountStr: string): number {
    return parseFloat(amountStr.replace(/,/g, ''));
}

function getTransactionType(smsOrType: string): 'debit' | 'credit' {
    const lower = smsOrType.toLowerCase();

    // Explicit Bank Abbreviations
    // If BOTH exist (Dr. and Cr.), it's usually a Debit (Dr. from us, Cr. to them)
    if (smsOrType.includes('Dr.') && smsOrType.includes('Cr.')) return 'debit';
    if (smsOrType.includes('Dr.')) return 'debit';
    if (smsOrType.includes('Cr.')) return 'credit';

    // 1. Explicit Credit indicators (Prioritized to avoid "Payment Received" being debit)
    if (lower.match(/\b(credited|received|deposited|added\s+to|refund|inward|reversal)\b/)) {
        return 'credit';
    }

    // 2. Explicit Debit indicators
    if (lower.match(/\b(debited|spent|paid|sent|withdrawn|withdraw|transfer\s+to|purchase)\b/)) {
        return 'debit';
    }

    // 3. Fallback: If "credit" appears without specific verbs (e.g. "Your A/c is credited")
    if (lower.includes('credited') || lower.includes('deposit')) return 'credit';

    return 'debit'; // Default to expense
}

function extractDate(sms: string): string {
    // Try to find date in DD-MM-YY or DD/MM/YY format
    const dateMatch = sms.match(/(\d{2})[-\/](\d{2})[-\/](\d{2,4})/);
    if (dateMatch) {
        let year = parseInt(dateMatch[3]);
        if (year < 100) year += 2000;
        return `${year}-${dateMatch[2]}-${dateMatch[1]}`; // ISO format matches SQLite
    }
    return new Date().toISOString().split('T')[0];
}

function extractAccountInfo(sms: string): { last4?: string; bankName?: string } {
    let last4: string | undefined;
    for (const pattern of ACCOUNT_PATTERNS) {
        const match = sms.match(pattern);
        if (match) {
            last4 = match[1];
            break;
        }
    }
    return { last4 };
}

/**
 * Smart cleaning of merchant names
 */
function cleanMerchantName(raw: string): string {
    let name = raw.trim();

    // 0. Special Case: Preserve UPI IDs (e.g. 8007320919@ybl)
    // The user wants these raw IDs so they can "Tag" them once and have them auto-recognized later.
    // If we clean them (e.g. remove numbers), we lose the unique identifier.
    if (name.includes('@') && !name.includes(' ')) {
        return name;
    }

    // 1. Check Knowledge Base first (Fast Path)
    for (const [key, displayName] of Object.entries(COMMON_MERCHANTS)) {
        if (name.toUpperCase().includes(key)) {
            return displayName;
        }
    }

    // 2. Remove common garbage prefixes/suffixes
    name = name
        .replace(/^(VPS|IPS|REV|UPI|IMPS|NEFT|RTGS)[\/-]?/i, '') // Banking prefixes
        .replace(/\d{6,}/, '')   // Long numeric IDs
        .replace(/[\/-]/g, ' ')  // Replace separators with space
        .replace(/\s+/g, ' ')    // Collapse spaces
        .trim();

    // 3. Remove "MUMBAI", "BANGALORE" etc if at end? Maybe risky.
    // 4. Capitalize First Letters
    const cleaned = name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    // 5. Final Sanity Check (Don't allow "On 2024..." or huge strings)
    if (cleaned.length > 30 || cleaned.match(/^On \d{4}/)) {
        return 'Unknown Merchant';
    }
    return cleaned;
}


// ============================================
// Smart Validation (Powered by ExpenseNet AI)
// ============================================

export function isValidTransaction(sms: string): boolean {
    // Must look like a bank transaction: digits + keywords
    return /[\d]+/.test(sms) && /(?:credited|debited|paid|spent|received|withdrawn|dr\.|cr\.|transfer|sent|payment)/i.test(sms);
}

function normalizeMessage(sms: string): string {
    // 1. Normalize Unicode Mathematical Sans-Serif (and others) to ASCII using NFKC
    // This fixes "𝖽𝖾𝖻𝗂𝗍𝖾𝖽" -> "debited"
    return sms.normalize('NFKC');
}

export function parseExpenseWithRegex(rawSms: string, isKnownBank: boolean = false, smsTimestamp?: number): ParsedExpense | null {
    // 0. Normalize Unicode
    const sms = normalizeMessage(rawSms);

    // 1. Validate first (Basic Keywords)
    if (!isValidTransaction(sms)) return null;

    // 2. Extract Account
    // Requirement: Account num OR Known Bank Sender (e.g. BX-BOBMS often skips account # in alerts)
    const { last4 } = extractAccountInfo(sms);
    if (!last4 && !isKnownBank) return null; // If neither, ignore.

    // 3. Extract Amount
    const amountMatch = sms.match(/(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i);
    if (!amountMatch) return null;
    const amount = parseAmount(amountMatch[1]);

    // 4. Determine Type
    const type = getTransactionType(sms);

    // 5. Merchant Logic
    let merchant = 'General Expense';

    // A. UPI ID
    const upiMatch = sms.match(/([a-zA-Z0-9.\-_]+@[a-zA-Z]+)/);
    if (upiMatch && !upiMatch[1].includes('.com')) {
        merchant = upiMatch[1];
    } else {
        // B. Heuristic "at", "to", "via", "by", "from"
        const merchantMatch = sms.match(/(?:to|at|via|spent on|paid to|sent to|by|from)\s+([^,.;]+?)(?:\s+(?:on|Ref|Avl|Bal|end|txn)|$|\.)/i);
        if (merchantMatch) merchant = merchantMatch[1];
    }
    merchant = cleanMerchantName(merchant) || 'General Expense';

    // 6. Date
    let dateStr = '';
    if (smsTimestamp) {
        const d = new Date(smsTimestamp);
        dateStr = d.toISOString().split('T')[0];
    } else {
        dateStr = extractDate(sms);
    }

    return {
        amount,
        merchant,
        type,
        date: dateStr,
        accountLast4: last4,
    };
}

export async function parseExpense(sms: string, isKnownBank: boolean = false, smsTimestamp?: number): Promise<ParsedExpense | null> {
    // Direct regex only - No AI
    return parseExpenseWithRegex(sms, isKnownBank, smsTimestamp);
}

export function resolveMerchantName(rawMerchant: string, userId: number): { displayName: string; categoryId: number | null } {
    // Check Knowledge Base
    for (const [key, displayName] of Object.entries(COMMON_MERCHANTS)) {
        if (rawMerchant.toUpperCase().includes(key)) {
            return { displayName, categoryId: null };
        }
    }

    return { displayName: rawMerchant, categoryId: null };
}

export async function autoCategorizeMerchant(merchantName: string, userId: number): Promise<number | null> {
    const categories = await getCategories(userId);

    // 1. AI Removed. Direct fallthrough to keyword matching.

    // 2. Fallback to keyword heuristics if AI is unsure (Low confidence)
    const lowerMerchant = merchantName.toLowerCase();
    const categoryKeywords: { [key: string]: string[] } = {
        'Food & Dining': ['zomato', 'swiggy', 'dominos', 'pizza', 'restaurant', 'kfc', 'burger', 'cafe', 'coffee', 'bakery', 'hotel'],
        'Transportation': ['uber', 'ola', 'rapido', 'petrol', 'fuel', 'shell', 'hpcl', 'bpcl', 'metro', 'cab', 'auto', 'parking'],
        'Shopping': ['amazon', 'flipkart', 'myntra', 'shop', 'decathlon', 'nike', 'adidas', 'mall', 'mart', 'retail', 'clothing', 'fashion'],
        'Groceries': ['bigbasket', 'blinkit', 'zepto', 'dmart', 'fresh', 'vegetable', 'fruit', 'dairy', 'milk', 'grocery', 'supermarket'],
        'Entertainment': ['netflix', 'spotify', 'hotstar', 'prime', 'youtube', 'cinema', 'bookmyshow', 'multiplex', 'game', 'subscription'],
        'Bills & Utilities': ['bescom', 'bwssb', 'electricity', 'water', 'gas', 'bill', 'act', 'jio', 'airtel', 'vi', 'vodafone', 'bsnl', 'recharge', 'broadband', 'mobile'],
        'Medical': ['pharmacy', 'hospital', 'clinic', 'medplus', 'apollo', 'doctor', 'health', 'medical'],
        'Travel': ['irctc', 'flight', 'booking', 'makemytrip', 'hotel', 'train', 'bus'],
        'Other': ['atm', 'withdrawal', 'transfer', 'upi', 'general', 'misc']
    };

    for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => lowerMerchant.includes(keyword))) {
            const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
            if (category) return category.id;
        }
    }

    // 3. If "UPI Transaction" but no specific keyword, try 'Other' or 'Transfer'
    if (lowerMerchant.includes('upi')) {
        const other = categories.find(c => c.name === 'Other');
        if (other) return other.id;
    }

    return null;
}

