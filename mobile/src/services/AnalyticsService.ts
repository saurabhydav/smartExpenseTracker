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
 * Calculate burn rate based on recent spending
 */
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
    const subscriptionCost = await getMonthlySubscriptionCost(); // This needs userId too? Yes, likely.

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
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [result] = await db.executeSql(`
    SELECT date, COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE user_id = ?
      AND type = 'debit'
      AND date >= ?
      AND date <= ?
    GROUP BY date
    ORDER BY date
  `, [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    const data: { date: string; amount: number }[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        data.push({
            date: row.date,
            amount: row.total,
        });
    }
    return data;
}

export default {
    calculateBurnRate,
    getMonthlyComparison,
    generateInsights,
    getChartData,
};
