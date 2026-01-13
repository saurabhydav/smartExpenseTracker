// Subscription Detection Service
// Analyzes transaction patterns to detect recurring payments

import { getDatabase, type Transaction } from '../database';

export interface DetectedSubscription {
    merchant: string;
    amount: number;
    frequency: 'weekly' | 'monthly' | 'yearly';
    confidence: number;
    nextExpectedDate: string;
    transactions: number[];
}

/**
 * Analyze transactions to detect subscription patterns
 * Runs as a 24-hour background task
 */
/**
 * Analyze transactions to detect subscription patterns
 * Runs as a 24-hour background task
 */
export async function detectSubscriptions(): Promise<DetectedSubscription[]> {
    const db = getDatabase();
    const subscriptions: DetectedSubscription[] = [];

    // Get transactions from the last 6 months grouped by merchant
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = sixMonthsAgo.toISOString().split('T')[0];

    const [result] = await db.executeSql(`
    SELECT merchant, 
           GROUP_CONCAT(id) as transaction_ids,
           GROUP_CONCAT(amount) as amounts,
           GROUP_CONCAT(date) as dates,
           COUNT(*) as count
    FROM transactions 
    WHERE type = 'debit' 
      AND date >= ?
    GROUP BY UPPER(merchant)
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC
  `, [startDate]);

    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        const amounts = row.amounts.split(',').map(Number);
        const dates = row.dates.split(',');
        const transactionIds = row.transaction_ids.split(',').map(Number);

        // Heuristic detection only (AI removed as per user request)
        const pattern = detectPatternHeuristic(amounts, dates);
        if (pattern) {
            subscriptions.push({
                merchant: row.merchant,
                amount: pattern.amount,
                frequency: pattern.frequency,
                confidence: pattern.confidence,
                nextExpectedDate: pattern.nextDate,
                transactions: transactionIds,
            });
        }
    }

    return subscriptions;
}

/**
 * Heuristic-based pattern detection
 */
function detectPatternHeuristic(
    amounts: number[],
    dates: string[]
): { amount: number; frequency: 'weekly' | 'monthly' | 'yearly'; confidence: number; nextDate: string } | null {
    if (amounts.length < 2) return null;

    // Check if amounts are consistent (within 5% variance)
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountVariance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.05);

    if (!amountVariance) return null;

    // Calculate intervals between dates
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
        const d1 = new Date(dates[i - 1]);
        const d2 = new Date(dates[i]);
        const diffDays = Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        intervals.push(diffDays);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Determine frequency based on average interval
    let frequency: 'weekly' | 'monthly' | 'yearly';
    let confidence: number;

    if (avgInterval >= 5 && avgInterval <= 9) {
        frequency = 'weekly';
        confidence = 1 - Math.abs(avgInterval - 7) / 7;
    } else if (avgInterval >= 25 && avgInterval <= 35) {
        frequency = 'monthly';
        confidence = 1 - Math.abs(avgInterval - 30) / 30;
    } else if (avgInterval >= 350 && avgInterval <= 380) {
        frequency = 'yearly';
        confidence = 1 - Math.abs(avgInterval - 365) / 365;
    } else {
        return null; // No clear pattern
    }

    // Require at least 60% confidence
    if (confidence < 0.6) return null;

    return {
        amount: avgAmount,
        frequency,
        confidence,
        nextDate: calculateNextDate(dates[dates.length - 1], frequency),
    };
}

/**
 * Calculate next expected date based on frequency
 */
function calculateNextDate(lastDate: string, frequency: 'weekly' | 'monthly' | 'yearly'): string {
    const date = new Date(lastDate);

    switch (frequency) {
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'yearly':
            date.setFullYear(date.getFullYear() + 1);
            break;
    }

    return date.toISOString().split('T')[0];
}

/**
 * Save detected subscriptions to database
 */
export async function saveSubscriptions(subscriptions: DetectedSubscription[]): Promise<void> {
    const db = getDatabase();

    // Clear existing subscriptions
    await db.executeSql('DELETE FROM subscriptions');

    // Insert new ones
    for (const sub of subscriptions) {
        await db.executeSql(`
      INSERT INTO subscriptions (merchant, amount, frequency, next_date, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [sub.merchant, sub.amount, sub.frequency, sub.nextExpectedDate]);
    }
}

/**
 * Get all active subscriptions
 */
export async function getActiveSubscriptions(): Promise<DetectedSubscription[]> {
    const db = getDatabase();
    const [result] = await db.executeSql(`
    SELECT * FROM subscriptions WHERE is_active = 1 ORDER BY next_date
  `);

    const subscriptions: DetectedSubscription[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        subscriptions.push({
            merchant: row.merchant,
            amount: row.amount,
            frequency: row.frequency,
            confidence: 1,
            nextExpectedDate: row.next_date,
            transactions: [],
        });
    }
    return subscriptions;
}

/**
 * Calculate total monthly subscription cost
 */
export async function getMonthlySubscriptionCost(): Promise<number> {
    const subscriptions = await getActiveSubscriptions();

    return subscriptions.reduce((total, sub) => {
        switch (sub.frequency) {
            case 'weekly':
                return total + (sub.amount * 4.33);
            case 'monthly':
                return total + sub.amount;
            case 'yearly':
                return total + (sub.amount / 12);
            default:
                return total;
        }
    }, 0);
}

export default {
    detectSubscriptions,
    saveSubscriptions,
    getActiveSubscriptions,
    getMonthlySubscriptionCost,
};
