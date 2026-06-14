// Analytics Service - Burn rate, predictions, and insights

import { getDatabase } from '../database';
import { getMonthlySubscriptionCost } from './SubscriptionService';

export interface BurnRateData {
    dailyAverage: number;
    weeklyAverage: number;
    monthlyProjection: number;
    daysUntilBudgetExhausted: number | null;
    trend: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number;
}

export interface SpendingInsight {
    type: 'warning' | 'info' | 'success';
    title: string;
    description: string;
    icon: string;
}

export interface MonthlyComparison {
    currentMonth: number;
    previousMonth: number;
    percentageChange: number;
}


/**
 * Calculate burn rate based on Rolling 30-Day Average
 * Uses historical data for accuracy instead of volatile month-to-date partials
 */
export async function calculateBurnRate(userId: number, budgetLimit?: number): Promise<BurnRateData> {
    const db = getDatabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentDayOfMonth = now.getDate();
    const daysRemaining = daysInMonth - currentDayOfMonth;

    // 1. Get spending for the last 30 days (Rolling Window for Stability)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch daily data for the last 30 days to calculate averages and trend
    const [result] = await db.executeSql(`
        SELECT date, SUM(amount) as total
        FROM transactions
        WHERE user_id = ? 
          AND type = 'debit'
          AND date >= ?
        GROUP BY date
        ORDER BY date
    `, [userId, dateLimit]);

    const dailySpending: { date: string; total: number }[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        dailySpending.push(result.rows.item(i));
    }

    // Calculate sum of last 30 days
    const totalLast30Days = dailySpending.reduce((sum, d) => sum + d.total, 0);

    // Daily Average = Total / 30 (Use fixed 30 days to account for zero-spend days correctly)
    const dailyAverage = totalLast30Days / 30;

    // Weekly Average = Daily Average * 7
    const weeklyAverage = dailyAverage * 7;

    // 2. Get accurate spending for THIS current month so far
    const currentStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const currentEndDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

    const [currentMonthResult] = await db.executeSql(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = ? 
          AND type = 'debit'
          AND date BETWEEN ? AND ?
    `, [userId, currentStartDate, currentEndDate]);

    const spentThisMonth = currentMonthResult.rows.item(0).total || 0;

    // 3. Monthly Projection = Spent So Far + (Daily Average * Remaining Days)
    // This combines actuals with historical prediction
    const monthlyProjection = spentThisMonth + (dailyAverage * daysRemaining);

    // Days until budget exhausted
    let daysUntilBudgetExhausted: number | null = null;
    if (budgetLimit && dailyAverage > 0) {
        const remaining = budgetLimit - spentThisMonth;
        daysUntilBudgetExhausted = remaining > 0 ? Math.floor(remaining / dailyAverage) : 0;
    }

    // Calculate trend (First 15 days vs Last 15 days of the window)
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let trendPercentage = 0;

    if (dailySpending.length >= 2) {
        const midpoint = Math.floor(dailySpending.length / 2);
        const firstHalf = dailySpending.slice(0, midpoint);
        const secondHalf = dailySpending.slice(midpoint);

        // Calculate averages for halves (sum / count)
        const firstHalfAvg = firstHalf.length ? firstHalf.reduce((s, d) => s + d.total, 0) / firstHalf.length : 0;
        const secondHalfAvg = secondHalf.length ? secondHalf.reduce((s, d) => s + d.total, 0) / secondHalf.length : 0;

        if (firstHalfAvg > 0) {
            trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

            if (trendPercentage > 10) trend = 'increasing';
            else if (trendPercentage < -10) trend = 'decreasing';
        }
    }

    return {
        dailyAverage,
        weeklyAverage,
        monthlyProjection,
        daysUntilBudgetExhausted,
        trend,
        trendPercentage: Math.abs(trendPercentage),
    };
}

/**
 * Compare spending between current and previous month
 */
export async function getMonthlyComparison(userId: number): Promise<MonthlyComparison> {
    const db = getDatabase();
    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Current month total
    const currentStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const currentEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;

    const [currentResult] = await db.executeSql(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE user_id = ?
      AND type = 'debit'
      AND date BETWEEN ? AND ?
  `, [userId, currentStart, currentEnd]);

    // Previous month total
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-31`;

    const [prevResult] = await db.executeSql(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE user_id = ?
      AND type = 'debit'
      AND date BETWEEN ? AND ?
  `, [userId, prevStart, prevEnd]);

    const currentMonthTotal = currentResult.rows.item(0)?.total || 0;
    const previousMonthTotal = prevResult.rows.item(0)?.total || 0;

    const percentageChange = previousMonthTotal > 0
        ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
        : 0;

    return {
        currentMonth: currentMonthTotal,
        previousMonth: previousMonthTotal,
        percentageChange,
    };
}

/**
 * Generate spending insights based on patterns
 */
export async function generateInsights(userId: number, totalBudget?: number): Promise<SpendingInsight[]> {
    const insights: SpendingInsight[] = [];
    const burnRate = await calculateBurnRate(userId, totalBudget);
    const comparison = await getMonthlyComparison(userId);
    const subscriptionCost = await getMonthlySubscriptionCost(userId);

    // Budget warning
    if (burnRate.daysUntilBudgetExhausted !== null) {
        if (burnRate.daysUntilBudgetExhausted <= 5) {
            insights.push({
                type: 'warning',
                title: 'Budget Alert',
                description: `At current rate, budget exhausts in ${burnRate.daysUntilBudgetExhausted} days`,
                icon: 'warning',
            });
        } else if (burnRate.daysUntilBudgetExhausted > 15) {
            insights.push({
                type: 'success',
                title: 'On Track',
                description: 'Your spending is within budget',
                icon: 'check-circle',
            });
        }
    }

    // Trend insight
    if (burnRate.trend === 'increasing' && burnRate.trendPercentage > 20) {
        insights.push({
            type: 'warning',
            title: 'Spending Increasing',
            description: `Spending up ${Math.round(burnRate.trendPercentage)}% this week`,
            icon: 'trending-up',
        });
    } else if (burnRate.trend === 'decreasing' && burnRate.trendPercentage > 15) {
        insights.push({
            type: 'success',
            title: 'Good Progress',
            description: `Spending down ${Math.round(burnRate.trendPercentage)}% this week`,
            icon: 'trending-down',
        });
    }

    // Month comparison
    if (comparison.percentageChange > 25) {
        insights.push({
            type: 'warning',
            title: 'Higher Than Last Month',
            description: `Spending ${Math.round(comparison.percentageChange)}% more than last month`,
            icon: 'arrow-upward',
        });
    } else if (comparison.percentageChange < -15) {
        insights.push({
            type: 'success',
            title: 'Saving More',
            description: `Spending ${Math.round(Math.abs(comparison.percentageChange))}% less than last month`,
            icon: 'savings',
        });
    }

    // Subscription insight
    if (subscriptionCost > 0) {
        insights.push({
            type: 'info',
            title: 'Recurring Payments',
            description: `₹${Math.round(subscriptionCost)} in monthly subscriptions`,
            icon: 'refresh',
        });
    }

    return insights;
}

/**
 * Get spending data for chart visualization
 */
export async function getChartData(userId: number, days: number = 30): Promise<{ date: string; amount: number }[]> {
    const db = getDatabase();
    const data: { date: string; amount: number }[] = [];

    // Group spending into 4 weeks (last 28 days)
    for (let i = 3; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - (i + 1) * 7 + 1);
        const end = new Date();
        end.setDate(end.getDate() - i * 7);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const [result] = await db.executeSql(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_id = ?
              AND type = 'debit'
              AND date >= ?
              AND date <= ?
        `, [userId, startStr, endStr]);

        const total = result.rows.length > 0 ? result.rows.item(0).total : 0;

        let label = '';
        if (i === 0) {
            label = 'This Wk';
        } else if (i === 1) {
            label = '1 Wk Ago';
        } else {
            label = `${i} Wks Ago`;
        }

        data.push({
            date: label, // Store weekly label in the date field to preserve types
            amount: total,
        });
    }
    return data;
}

/**
 * Calculate "Safe to Spend Today" daily limit
 */
export async function calculateSafeToSpendToday(userId: number): Promise<{
    safeToSpendToday: number;
    hasBudget: boolean;
    remainingBudget: number;
    daysRemaining: number;
}> {
    const db = getDatabase();
    
    // 1. Get total budget limit
    const [budgetResult] = await db.executeSql(`
        SELECT SUM(budget_limit) as total_budget
        FROM categories
    `);
    const totalBudget = budgetResult.rows.item(0).total_budget || 0;
    
    // 2. Get total spending for current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentDayOfMonth = now.getDate();
    const daysRemaining = Math.max(1, daysInMonth - currentDayOfMonth + 1); // including today
    
    const startStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`; // SQL BETWEEN takes care of it
    
    const [spentResult] = await db.executeSql(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = ?
          AND type = 'debit'
          AND date BETWEEN ? AND ?
    `, [userId, startStr, endStr]);
    const spentThisMonth = spentResult.rows.item(0).total || 0;
    
    if (totalBudget <= 0) {
        return {
            safeToSpendToday: 0,
            hasBudget: false,
            remainingBudget: 0,
            daysRemaining,
        };
    }
    
    // 3. Get upcoming active subscriptions for the rest of this month
    const todayStr = now.toISOString().split('T')[0];
    const endOfMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${daysInMonth}`;
    
    const [subsResult] = await db.executeSql(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM subscriptions
        WHERE user_id = ?
          AND is_active = 1
          AND next_date BETWEEN ? AND ?
    `, [userId, todayStr, endOfMonthStr]);
    const upcomingSubscriptionsTotal = subsResult.rows.item(0).total || 0;
    
    // 4. Calculate Safe to Spend Today
    const remainingBudget = totalBudget - spentThisMonth;
    const allocatableBudget = remainingBudget - upcomingSubscriptionsTotal;
    
    const safeToSpendToday = Math.max(0, allocatableBudget / daysRemaining);
    
    return {
        safeToSpendToday,
        hasBudget: true,
        remainingBudget,
        daysRemaining,
    };
}

export default {
    calculateBurnRate,
    getMonthlyComparison,
    generateInsights,
    getChartData,
    calculateSafeToSpendToday,
};
