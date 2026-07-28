// Smart Category Detector — Auto-categorizes transactions based on merchant history + keyword fallback

import { getDatabase } from '../database';

// ============================================
// Types
// ============================================

interface CategorySuggestion {
    category: string;
    confidence: number; // 0.0 – 1.0
}

// ============================================
// Keyword → Category mapping (fallback for unknown merchants)
// ============================================

const KEYWORD_CATEGORY_MAP: { keywords: string[]; category: string }[] = [
    { keywords: ['swiggy', 'zomato', 'dominos', 'mcdonalds', 'kfc', 'starbucks', 'cafe', 'restaurant', 'pizza', 'burger', 'biryani', 'food', 'eat', 'dine', 'kitchen', 'barbeque', 'haldiram', 'subway', 'dunkin'], category: 'Food & Dining' },
    { keywords: ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'nykaa', 'tatacliq', 'snapdeal', 'shein', 'shopping', 'mall', 'store', 'mart', 'bazaar'], category: 'Shopping' },
    { keywords: ['uber', 'ola', 'rapido', 'metro', 'irctc', 'petrol', 'fuel', 'diesel', 'parking', 'toll', 'fastag', 'cab', 'taxi', 'auto', 'bus', 'train', 'railway'], category: 'Transportation' },
    { keywords: ['netflix', 'hotstar', 'prime video', 'spotify', 'youtube', 'disney', 'jiocinema', 'zee5', 'sonyliv', 'gaana', 'movie', 'cinema', 'pvr', 'inox', 'theatre', 'game', 'gaming', 'xbox', 'playstation', 'steam'], category: 'Entertainment' },
    { keywords: ['electricity', 'water', 'gas', 'internet', 'wifi', 'broadband', 'jio', 'airtel', 'vi', 'bsnl', 'recharge', 'mobile', 'phone', 'bill', 'dth', 'tata sky', 'rent', 'maintenance', 'society'], category: 'Bills & Utilities' },
    { keywords: ['hospital', 'clinic', 'doctor', 'pharma', 'medical', 'medicine', 'apollo', 'medplus', 'netmeds', 'pharmeasy', '1mg', 'health', 'dental', 'eye', 'lab', 'diagnostic', 'gym', 'fitness'], category: 'Health' },
    { keywords: ['school', 'college', 'university', 'tuition', 'course', 'udemy', 'coursera', 'unacademy', 'byjus', 'vedantu', 'book', 'stationery', 'education', 'exam', 'coaching'], category: 'Education' },
    { keywords: ['flight', 'airline', 'indigo', 'spicejet', 'vistara', 'air india', 'hotel', 'oyo', 'airbnb', 'makemytrip', 'goibibo', 'booking', 'travel', 'trip', 'tour', 'resort'], category: 'Travel' },
    { keywords: ['bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart', 'reliance', 'grocery', 'grocer', 'supermarket', 'vegetables', 'fruits', 'milk', 'bread', 'kirana'], category: 'Groceries' },
];

// ============================================
// Core: Suggest category for a merchant name
// ============================================

/**
 * Suggests a category for a given merchant.
 *
 * Strategy (in order of confidence):
 * 1. Check user's past transactions for this exact merchant (high confidence)
 * 2. Check user's merchant_mapping table (high confidence)
 * 3. Fuzzy keyword matching against known patterns (medium confidence)
 * 4. Return null if nothing matches
 */
export async function suggestCategory(
    merchantName: string,
    userId: number
): Promise<CategorySuggestion | null> {
    if (!merchantName || merchantName.trim().length === 0) {
        return null;
    }

    const normalizedMerchant = merchantName.trim().toUpperCase();

    try {
        const db = getDatabase();

        // ─── Strategy 1: Check past transactions for this merchant ───
        // Use the most frequently assigned category for this merchant
        const [historyResult] = await db.executeSql(`
            SELECT c.name AS category_name, COUNT(*) AS occurrence
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = ?
              AND UPPER(t.merchant) = ?
              AND t.category_id IS NOT NULL
            GROUP BY t.category_id
            ORDER BY occurrence DESC
            LIMIT 1
        `, [userId, normalizedMerchant]);

        if (historyResult.rows.length > 0) {
            const row = historyResult.rows.item(0);
            const occurrences = Number(row.occurrence) || 1;
            // More history = higher confidence (caps at 0.95)
            const confidence = Math.min(0.95, 0.7 + (occurrences * 0.05));
            return {
                category: row.category_name,
                confidence,
            };
        }

        // ─── Strategy 2: Check merchant_mapping table ───
        const [mappingResult] = await db.executeSql(`
            SELECT c.name AS category_name
            FROM merchant_mapping mm
            JOIN categories c ON c.id = mm.category_id
            WHERE mm.user_id = ? AND UPPER(mm.sms_name) = ?
            LIMIT 1
        `, [userId, normalizedMerchant]);

        if (mappingResult.rows.length > 0) {
            return {
                category: mappingResult.rows.item(0).category_name,
                confidence: 0.85,
            };
        }

        // ─── Strategy 3: Keyword matching ───
        const merchantLower = merchantName.toLowerCase();

        for (const entry of KEYWORD_CATEGORY_MAP) {
            for (const keyword of entry.keywords) {
                if (merchantLower.includes(keyword)) {
                    // Longer keyword match = higher confidence
                    const matchRatio = keyword.length / merchantLower.length;
                    const confidence = Math.min(0.75, 0.4 + matchRatio * 0.35);
                    return {
                        category: entry.category,
                        confidence: Math.round(confidence * 100) / 100,
                    };
                }
            }
        }

        // ─── Nothing matched ───
        return null;
    } catch (error) {
        console.error('suggestCategory error:', error);
        return null;
    }
}

// ============================================
// Build a full merchant → category map for the user
// ============================================

/**
 * Builds a comprehensive Map<merchantName, categoryName> from:
 * 1. User's transaction history (grouped by merchant + most common category)
 * 2. User's merchant_mapping table
 * 3. Keyword-based fallback for any known patterns
 *
 * Useful for bulk processing (e.g., importing a batch of SMS).
 */
export async function buildCategoryMap(userId: number): Promise<Map<string, string>> {
    const categoryMap = new Map<string, string>();

    try {
        const db = getDatabase();

        // ─── Source 1: Past transactions — most frequent category per merchant ───
        const [txnResult] = await db.executeSql(`
            SELECT
                UPPER(t.merchant) AS merchant_upper,
                t.merchant AS merchant_name,
                c.name AS category_name,
                COUNT(*) AS occurrence
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = ? AND t.category_id IS NOT NULL
            GROUP BY UPPER(t.merchant), t.category_id
            ORDER BY UPPER(t.merchant), occurrence DESC
        `, [userId]);

        // For each merchant, pick the category with the most occurrences
        const merchantBest = new Map<string, { category: string; count: number }>();
        for (let i = 0; i < txnResult.rows.length; i++) {
            const row = txnResult.rows.item(i);
            const key = row.merchant_upper;
            const existing = merchantBest.get(key);
            if (!existing || row.occurrence > existing.count) {
                merchantBest.set(key, {
                    category: row.category_name,
                    count: row.occurrence,
                });
                categoryMap.set(row.merchant_name, row.category_name);
            }
        }

        // ─── Source 2: Merchant mappings (fills gaps) ───
        const [mappingResult] = await db.executeSql(`
            SELECT mm.sms_name, mm.display_name, c.name AS category_name
            FROM merchant_mapping mm
            JOIN categories c ON c.id = mm.category_id
            WHERE mm.user_id = ?
        `, [userId]);

        for (let i = 0; i < mappingResult.rows.length; i++) {
            const row = mappingResult.rows.item(i);
            // Only add if not already known from transaction history
            if (!categoryMap.has(row.display_name)) {
                categoryMap.set(row.display_name, row.category_name);
            }
            if (!categoryMap.has(row.sms_name)) {
                categoryMap.set(row.sms_name, row.category_name);
            }
        }

    } catch (error) {
        console.error('buildCategoryMap error:', error);
    }

    return categoryMap;
}
