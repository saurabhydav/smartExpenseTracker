// Smart SMS Processing Service
// Validates, parses, and learns merchant names like phone contacts

import { NativeModules, Alert, Platform, DeviceEventEmitter } from 'react-native';
import {
    parseExpense,
    resolveMerchantName,
    autoCategorizeMerchant,
    type ParsedExpense
} from './ExpenseParser';

import {
    insertTransaction,
    getMerchantMapping,
    insertMerchantMapping,
    getDatabase,
    type Transaction,
} from '../database';

// Event emitter for UI notifications
type NewMerchantCallback = (merchant: UnknownMerchant) => void;
let onNewMerchantCallback: NewMerchantCallback | null = null;

export interface UnknownMerchant {
    rawName: string;
    suggestedName: string;
    amount: number;
    transactionId: number;
    categoryId: number | null;
}

export interface SmsValidationResult {
    isValid: boolean;
    isTransaction: boolean;
    confidence: number;
    reason?: string;
}

// Bank SMS patterns for validation
const BANK_INDICATORS = [
    /Rs\.?\s*[\d,]+/i,
    /INR\s*[\d,]+/i,
    /debited|credited|spent|received|auto-?debit|auto-?pay|subscription|membership|paid|sent|transfer|withdrawn|withdraw|payment|Dr\.?|Cr\.?/i,
    /A\/c|account|card|bank|wallet/i,
    /UPI|IMPS|NEFT|RTGS|Ref\s?No|Reference/i,
    /transaction|txn/i,
];

// Known Bank Sender IDs (derived from typical DLT headers like JX-BOBSMS)
const BANK_SENDER_IDS = [
    /BOBSMS|BOBTXN|BOBMS/i, // Bank of Baroda(Added BOBMS)
    /HDFCBK|HDFCBN/i,      // HDFC
    /SBIN|SBIUPI|SBIMPS/i, // SBI
    /ICICIB/i,             // ICICI
    /AXISBK|AXIS/i,        // Axis
    /KOTAK/i,              // Kotak
    /PNBSMS|PNB/i,         // PNB
    /IDFCFB|IDFC/i,        // IDFC
    /YESBNK/i,             // Yes Bank
    /CANARA/i,             // Canara
    /UNIONB/i,             // Union Bank
    /MAHABK/i,             // Maha Bank
    /RBL/i,                // RBL
    /INDZB/i,              // IndusInd
    /CBSSMS/i,             // Central Bank
];

const SPAM_INDICATORS = [
    /click here|tap here|http/i,
    /win|won|lottery|prize/i,
    /offer expires|limited time/i,
    /verify your|confirm your/i,
    /suspicious activity/i,
    // Stricter OTP checks so we don't flag "Do not share OTP" warnings in footer
    /(\d{4,8}\s+is\s+your\s+OTP)|(OTP\s+for)/i,
];

export async function validateTransactionSms(sms: string, sender: string): Promise<SmsValidationResult> {
    let confidence = 0;
    const reasons: string[] = [];

    // 1. FILTER BY SENDER ID
    // User Requirement: "We can create a list... fetch messages from them only"
    // Also block headers ending in "-P" (Promotional) which are usually ads
    if (/-[P]($|[A-Z])/i.test(sender)) {
        return { isValid: false, isTransaction: false, confidence: 0, reason: 'Ignored Promotional Sender (-P)' };
    }

    // Check whitelist
    const isKnownBank = BANK_SENDER_IDS.some(regex => regex.test(sender));
    if (isKnownBank) {
        confidence += 0.5;
        reasons.push('Known Bank Sender');
    }

    // 2. CHECK BODY CONTENT
    let bankMatches = 0;
    for (const pattern of BANK_INDICATORS) {
        if (pattern.test(sms)) {
            bankMatches++;
        }
    }

    if (bankMatches >= 2) {
        confidence += 0.5;
        reasons.push('Contains transaction keywords');
    }

    // 3. SPAM CHECK
    let spamMatches = 0;
    for (const pattern of SPAM_INDICATORS) {
        if (pattern.test(sms)) {
            spamMatches++;
        }
    }

    if (spamMatches > 0) {
        return { isValid: false, isTransaction: false, confidence: 0, reason: 'Contains spam keywords' };
    }

    // Strict Mode: If it's a known bank, we are more lenient on keywords.
    // If unknown sender, we require high keyword match.
    const threshold = isKnownBank ? 0.4 : 0.8;

    return {
        isValid: confidence >= threshold,
        isTransaction: bankMatches >= 2,
        confidence,
        reason: reasons.join('; '),
    };
}

// Removed validateWithAI function since User requested No AI.

/**
 * Register callback for new merchant notifications
 */
export function onNewMerchantDetected(callback: NewMerchantCallback): void {
    onNewMerchantCallback = callback;
}

/**
 * Check if merchant is known (like checking if phone number has a contact name)
 */
export async function isKnownMerchant(rawName: string, userId: number): Promise<boolean> {
    const mapping = await getMerchantMapping(rawName, userId);
    return mapping !== null;
}

/**
 * Save merchant name (like saving a contact)
 */
export async function saveMerchantName(
    rawName: string,
    displayName: string,
    categoryId: number | null,
    userId: number // Added userId
): Promise<void> {
    // Check if already exists
    const existing = await getMerchantMapping(rawName, userId);

    if (existing) {
        // Update existing
        const db = getDatabase();
        await db.executeSql(
            'UPDATE merchant_mapping SET display_name = ?, category_id = ? WHERE id = ?',
            [displayName, categoryId, existing.id]
        );
    } else {
        // Insert new
        await insertMerchantMapping({
            smsName: rawName.toUpperCase(),
            displayName,
            categoryId,
            userId, // Pass userId
        });
    }

    // AUTO-UPDATE: Apply this rule to ALL past transactions immediately
    console.log(`Applying rule for ${rawName} -> ${displayName} to all past transactions...`);
    await updateAllTransactionsForMerchant(rawName, displayName, categoryId);

    console.log(`Saved merchant rule and updated history: ${rawName} -> ${displayName}`);
    DeviceEventEmitter.emit('TRANSACTION_UPDATED');
}

/**
 * Update ALL transactions for a raw merchant name (batch update)
 */
export async function updateAllTransactionsForMerchant(
    rawName: string,
    displayName: string,
    categoryId: number | null
): Promise<void> {
    const db = getDatabase();
    await db.executeSql(
        'UPDATE transactions SET merchant = ?, category_id = ? WHERE UPPER(merchant) = UPPER(?)',
        [displayName, categoryId, rawName]
    );
}

/**
 * Update transaction with new merchant name
 */
export async function updateTransactionMerchant(
    transactionId: number,
    displayName: string,
    categoryId: number | null
): Promise<void> {
    const db = getDatabase();
    await db.executeSql(
        'UPDATE transactions SET merchant = ?, category_id = ? WHERE id = ?',
        [displayName, categoryId, transactionId]
    );
}

/**
 * Get suggested display name from raw merchant
 */
function getSuggestedName(rawName: string): string {
    // Clean up and format the name
    return rawName
        .replace(/[^\w\s]/g, '')
        .split(/[\s_-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
}

/**
 * Smart SMS processor - the main entry point
 * Works like phone contacts: learns merchant names
 */
import { getTokens } from './api';

// ...

export async function processSmartSms(
    sms: string,
    sender: string,
    userId?: number, // Optional: can be passed or retrieved storage
    smsTimestamp?: number, // NEW: For historical scans
    suppressNotification: boolean = false // NEW: Prevent UI popups
): Promise<{
    success: boolean;
    transactionId?: number;
    needsNaming?: boolean;
    merchant?: UnknownMerchant;
    error?: string;
}> {
    console.log('Smart SMS processing started');

    // Attempt to get userId if not provided (e.g. background task)
    let currentUserId = userId;
    if (!currentUserId) {
        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const json = await AsyncStorage.getItem('expense-tracker-storage');
            if (json) {
                const storage = JSON.parse(json);
                if (storage.state && storage.state.user) {
                    currentUserId = storage.state.user.id;
                }
            }
        } catch (e) {
            console.error('Failed to retrieve userId for background validation', e);
        }
    }

    if (!currentUserId) {
        console.log('No user logged in, skipping SMS processing');
        return { success: false, error: 'User not logged in' };
    }



    if (!currentUserId) {
        console.log('No user logged in, skipping SMS processing');
        return { success: false, error: 'User not logged in' };
    }


    // Step 1: Validate the SMS
    const validation = await validateTransactionSms(sms, sender);

    if (!validation.isValid) {
        console.log('SMS validation failed:', validation.reason);
        return {
            success: false,
            error: `Not a valid transaction: ${validation.reason} `
        };
    }

    if (!validation.isTransaction) {
        console.log('Not a transaction SMS');
        return { success: false, error: 'Not a transaction SMS' };
    }

    // Check known bank again for parser usage
    const isKnownBankSender = BANK_SENDER_IDS.some(regex => regex.test(sender));

    // Step 2: Parse the transaction (Pass timestamp and knownBank flag)
    const parsed = await parseExpense(sms, isKnownBankSender, smsTimestamp);

    if (!parsed) {
        console.log('Could not parse transaction details');
        return { success: false, error: 'Could not parse transaction details' };
    }

    console.log(`Parsed: Amount = ${parsed.amount}, Type = ${parsed.type}, Merchant = ${parsed.merchant} `);

    // Step 3: Check if merchant is known
    const mapping = await getMerchantMapping(parsed.merchant, currentUserId);
    const isKnown = !!mapping;

    let displayName = parsed.merchant;
    let categoryId: number | null = null;

    if (isKnown) {
        displayName = mapping!.displayName;
        categoryId = mapping!.categoryId;
        console.log(`Known merchant: ${parsed.merchant} -> ${displayName} `);
    } else {
        displayName = getSuggestedName(parsed.merchant);
        categoryId = await autoCategorizeMerchant(parsed.merchant, currentUserId);
        console.log(`New merchant detected: ${parsed.merchant} `);
    }

    // Step 3.5: Handle Account Detection
    let accountId: number | null = null;
    // Resolve account even if last4 is missing (pass sender)
    accountId = await resolveAccountId(parsed.accountLast4, sender, currentUserId);

    // Step 3.6: Pattern Analysis (Removed as per user request to disable all AI features)
    // We rely purely on direct user mapping for merchant naming.

    // Step 4: Save transaction
    const transactionId = await insertTransaction({
        amount: parsed.amount,
        type: parsed.type,
        merchant: displayName,
        categoryId,
        accountId,
        userId: currentUserId, // Pass detected userId
        date: parsed.date,
        rawSms: sms,
        notes: null,
    });

    console.log(`Transaction saved with ID: ${transactionId} `);
    if (!suppressNotification) {
        DeviceEventEmitter.emit('TRANSACTION_UPDATED');
    }

    // Step 5: If new merchant, notify UI to ask for name
    if (!isKnown) {
        const unknownMerchant: UnknownMerchant = {
            rawName: parsed.merchant,
            suggestedName: displayName,
            amount: parsed.amount,
            transactionId,
            categoryId,
        };

        // Call the registered callback
        if (onNewMerchantCallback && !suppressNotification) {
            onNewMerchantCallback(unknownMerchant);
        }

        return {
            success: true,
            transactionId,
            needsNaming: true,
            merchant: unknownMerchant,
        };
    }

    return {
        success: true,
        transactionId,
        needsNaming: false,
    };
}

/**
 * Resolve or create account based on last 4 digits
 */
/**
 * Resolve or create account based on last 4 digits
 */
async function resolveAccountId(last4: string | undefined, sender: string, userId: number): Promise<number | null> {
    const db = getDatabase();
    // Clean sender ID (e.g., AD-HDFCBK -> HDFCBK)
    const bankName = sender.replace(/^[A-Z]{2}-/, '');

    try {
        // Case 1: No Last 4 Digits (e.g. strict account check skipped for known bank)
        if (!last4) {
            // Try to find ANY account for this bank
            const [existing] = await db.executeSql(
                'SELECT id FROM accounts WHERE bank_name = ? AND user_id = ? ORDER BY id ASC LIMIT 1',
                [bankName, userId]
            );
            if (existing.rows.length > 0) {
                return existing.rows.item(0).id;
            }

            // Create generic account
            const defaultName = `${bankName} Main Account`;
            const [result] = await db.executeSql(
                'INSERT INTO accounts (name, bank_name, last_4, type, user_id) VALUES (?, ?, ?, ?, ?)',
                [defaultName, bankName, 'XXXX', 'debit', userId]
            );
            console.log(`Created Generic Account: ${defaultName} `);
            return result.insertId;
        }

        // Case 2: Specific Last 4 Digits
        const [existing] = await db.executeSql(
            'SELECT id FROM accounts WHERE bank_name = ? AND last_4 = ? AND user_id = ?',
            [bankName, last4, userId]
        );

        if (existing.rows.length > 0) {
            return existing.rows.item(0).id;
        }

        // Create new account if not found
        const type = 'debit'; // Default type
        const defaultName = `${bankName} ${type} - ${last4} `;

        const [result] = await db.executeSql(
            'INSERT INTO accounts (name, bank_name, last_4, type, user_id) VALUES (?, ?, ?, ?, ?)',
            [defaultName, bankName, last4, type, userId]
        );

        console.log(`New Account Detected: ${defaultName} `);
        return result.insertId;
    } catch (error: any) {
        // RACE CONDITION HANDLE: If unique constraint fails, it means another thread just created it.
        // So we just fetch it again.
        if (error?.message?.includes('UNIQUE constraint failed') || error?.message?.includes('code 2067')) {
            console.log(`Race condition resolved for ${bankName} account`);
            try {
                // Determine if we were looking for generic or specific
                const queryLast4 = last4 || 'XXXX';
                const [existing] = await db.executeSql(
                    'SELECT id FROM accounts WHERE bank_name = ? AND last_4 = ? AND user_id = ?',
                    [bankName, queryLast4, userId]
                );
                if (existing.rows.length > 0) {
                    return existing.rows.item(0).id;
                }
            } catch (retryError) {
                console.warn('Retry fetch failed:', retryError);
            }
        }

        // Fail Open: Only if retry fails too
        console.warn(`Account resolution failed for ${bankName}(User ${userId}).Defaulting to NULL account.Error: `, error);
        return null;
    }
}

/**
 * Get all unique merchants without names (pending naming)
 */
export async function getUnnamedMerchants(userId: number): Promise<{ rawName: string; count: number; lastAmount: number }[]> {
    const db = getDatabase();

    const [result] = await db.executeSql(`
    SELECT t.merchant as raw_name,
    COUNT(*) as count,
    MAX(t.amount) as last_amount
    FROM transactions t
    LEFT JOIN merchant_mapping m ON UPPER(t.merchant) = UPPER(m.sms_name) AND m.user_id = ?
    WHERE m.id IS NULL AND t.user_id = ?
        GROUP BY UPPER(t.merchant)
    ORDER BY count DESC
    `, [userId, userId]);

    const merchants: { rawName: string; count: number; lastAmount: number }[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        merchants.push({
            rawName: row.raw_name,
            count: row.count,
            lastAmount: row.last_amount,
        });
    }
    return merchants;
}

export default {
    validateTransactionSms,
    processSmartSms,
    onNewMerchantDetected,
    isKnownMerchant,
    saveMerchantName,
    updateTransactionMerchant,
    updateAllTransactionsForMerchant,
    getUnnamedMerchants,
};
