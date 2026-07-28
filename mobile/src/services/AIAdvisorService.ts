// AI Assistant Service - Smart financial insights engine
// Computes smart insights from SQLite queries — no ML, just clever SQL + conversational copy

import { getDatabase } from '../database';
import { formatCurrency } from '../utils';

// ============================================
// Types
// ============================================

interface Insight {
    type: string;
    message: string;
    priority: number; // 1 = highest
}

interface CategorySpendComparison {
    categoryName: string;
    thisMonth: number;
    lastMonth: number;
    change: number;
    changePercent: number;
}

interface BudgetStatus {
    categoryName: string;
    spent: number;
    budget: number;
    usagePercent: number;
}

interface MerchantSummary {
    merchant: string;
    totalSpent: number;
    txnCount: number;
}

// ============================================
// Helper: date ranges
// ============================================

function getMonthRange(offset: number = 0): { start: string; end: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1 + offset;

    const adjustedDate = new Date(year, month - 1, 1);
    const y = adjustedDate.getFullYear();
    const m = adjustedDate.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();

    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
}

function getWeekRange(): { start: string; end: string } {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    return {
        start: sevenDaysAgo.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
    };
}

function getTodayStr(): string {
    return new Date().toISOString().split('T')[0];
}

// ============================================
// 1. Spending Alerts — Month-over-Month per Category
// ============================================

async function getSpendingAlerts(userId: number): Promise<Insight[]> {
    const db = getDatabase();
    const thisMonth = getMonthRange(0);
    const lastMonth = getMonthRange(-1);
    const insights: Insight[] = [];

    const [result] = await db.executeSql(`
        SELECT
            c.name AS category_name,
            COALESCE(curr.total, 0) AS this_month,
            COALESCE(prev.total, 0) AS last_month
        FROM categories c
        LEFT JOIN (
            SELECT category_id, SUM(amount) AS total
            FROM transactions
            WHERE user_id = ? AND type = 'debit'
              AND date BETWEEN ? AND ?
            GROUP BY category_id
        ) curr ON curr.category_id = c.id
        LEFT JOIN (
            SELECT category_id, SUM(amount) AS total
            FROM transactions
            WHERE user_id = ? AND type = 'debit'
              AND date BETWEEN ? AND ?
            GROUP BY category_id
        ) prev ON prev.category_id = c.id
        WHERE c.user_id = ? AND (curr.total > 0 OR prev.total > 0)
    `, [
        userId, thisMonth.start, thisMonth.end,
        userId, lastMonth.start, lastMonth.end,
        userId,
    ]);

    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        const thisAmt = Number(row.this_month) || 0;
        const lastAmt = Number(row.last_month) || 0;
        const name = row.category_name;

        if (lastAmt > 0 && thisAmt > lastAmt) {
            const pctIncrease = Math.round(((thisAmt - lastAmt) / lastAmt) * 100);
            if (pctIncrease >= 20) {
                insights.push({
                    type: 'spending_alert',
                    message: `📈 Heads up! Your ${name} spending is up ${pctIncrease}% this month (${formatCurrency(thisAmt)} vs ${formatCurrency(lastAmt)} last month). Might be worth a quick check!`,
                    priority: pctIncrease >= 50 ? 1 : 2,
                });
            }
        } else if (lastAmt > 0 && thisAmt < lastAmt * 0.7) {
            const pctDrop = Math.round(((lastAmt - thisAmt) / lastAmt) * 100);
            insights.push({
                type: 'spending_alert',
                message: `🎉 Nice work! ${name} spending dropped ${pctDrop}% compared to last month. Keep it up!`,
                priority: 5,
            });
        }
    }

    return insights;
}

// ============================================
// 2. Budget Warnings — Usage % Check
// ============================================

async function getBudgetWarnings(userId: number): Promise<Insight[]> {
    const db = getDatabase();
    const thisMonth = getMonthRange(0);
    const insights: Insight[] = [];

    const [result] = await db.executeSql(`
        SELECT
            c.name AS category_name,
            c.budget_limit AS budget,
            COALESCE(SUM(t.amount), 0) AS spent
        FROM categories c
        LEFT JOIN transactions t
            ON t.category_id = c.id
            AND t.user_id = ?
            AND t.type = 'debit'
           
            AND t.date BETWEEN ? AND ?
        WHERE c.user_id = ? AND c.budget_limit IS NOT NULL AND c.budget_limit > 0
        GROUP BY c.id
    `, [userId, thisMonth.start, thisMonth.end, userId]);

    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        const spent = Number(row.spent) || 0;
        const budget = Number(row.budget) || 0;
        const name = row.category_name;
        const usagePct = Math.round((spent / budget) * 100);

        if (usagePct >= 100) {
            insights.push({
                type: 'budget_warning',
                message: `🚨 You've exceeded your ${name} budget! You've spent ${formatCurrency(spent)} out of ${formatCurrency(budget)} (${usagePct}%). Time to pump the brakes.`,
                priority: 1,
            });
        } else if (usagePct >= 80) {
            insights.push({
                type: 'budget_warning',
                message: `⚠️ ${name} is at ${usagePct}% of budget (${formatCurrency(spent)} of ${formatCurrency(budget)}). You've got ${formatCurrency(budget - spent)} left — pace yourself!`,
                priority: 2,
            });
        } else if (usagePct >= 50) {
            insights.push({
                type: 'budget_warning',
                message: `💡 ${name} is halfway through its budget at ${usagePct}% (${formatCurrency(spent)} of ${formatCurrency(budget)}). Looking steady so far.`,
                priority: 4,
            });
        }
    }

    return insights;
}

// ============================================
// 3. Savings Opportunities — Top Discretionary Categories
// ============================================

async function getSavingsOpportunities(userId: number): Promise<Insight[]> {
    const db = getDatabase();
    const thisMonth = getMonthRange(0);
    const insights: Insight[] = [];

    // Discretionary categories = those without strict budgets or high-spend without budget
    const [result] = await db.executeSql(`
        SELECT
            c.name AS category_name,
            SUM(t.amount) AS total_spent,
            COUNT(t.id) AS txn_count,
            c.budget_limit
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = ? AND t.type = 'debit'
          AND t.date BETWEEN ? AND ?
        GROUP BY c.id
        ORDER BY total_spent DESC
        LIMIT 3
    `, [userId, thisMonth.start, thisMonth.end]);

    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        const name = row.category_name;
        const total = Number(row.total_spent) || 0;
        const count = Number(row.txn_count) || 0;
        const hasBudget = row.budget_limit && Number(row.budget_limit) > 0;

        if (!hasBudget && total > 0) {
            insights.push({
                type: 'savings_opportunity',
                message: `💰 You spent ${formatCurrency(total)} on ${name} this month across ${count} transactions — and there's no budget set. Setting a limit could save you some serious cash!`,
                priority: 3,
            });
        } else if (hasBudget && total > 0 && i === 0) {
            insights.push({
                type: 'savings_opportunity',
                message: `🏆 ${name} is your biggest spending category at ${formatCurrency(total)} (${count} transactions). Even a 10% cut would save you ${formatCurrency(total * 0.1)}/month!`,
                priority: 3,
            });
        }
    }

    return insights;
}

// ============================================
// 4. Weekly Summary
// ============================================

async function getWeeklySummary(userId: number): Promise<Insight[]> {
    const db = getDatabase();
    const week = getWeekRange();
    const insights: Insight[] = [];

    const [result] = await db.executeSql(`
        SELECT
            COUNT(*) AS txn_count,
            COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS total_debit,
            COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_credit
        FROM transactions
        WHERE user_id = ? AND date BETWEEN ? AND ?
    `, [userId, week.start, week.end]);

    const row = result.rows.item(0);
    const txnCount = Number(row.txn_count) || 0;
    const totalDebit = Number(row.total_debit) || 0;
    const totalCredit = Number(row.total_credit) || 0;

    if (txnCount > 0) {
        const netFlow = totalCredit - totalDebit;
        const emoji = netFlow >= 0 ? '✅' : '📊';
        insights.push({
            type: 'weekly_summary',
            message: `${emoji} This week: ${txnCount} transactions, ${formatCurrency(totalDebit)} spent, ${formatCurrency(totalCredit)} earned. Net flow: ${netFlow >= 0 ? '+' : ''}${formatCurrency(netFlow)}.`,
            priority: 4,
        });
    } else {
        insights.push({
            type: 'weekly_summary',
            message: `📭 No transactions this week! Either you're on a spending detox or your SMS isn't syncing — worth a quick check.`,
            priority: 5,
        });
    }

    return insights;
}

// ============================================
// 5. No-Spend Streaks
// ============================================

async function getNoSpendStreak(userId: number): Promise<Insight[]> {
    const db = getDatabase();
    const insights: Insight[] = [];
    const today = getTodayStr();

    // Get recent debit dates to calculate streak
    const [result] = await db.executeSql(`
        SELECT DISTINCT date
        FROM transactions
        WHERE user_id = ? AND type = 'debit'
          AND date <= ?
        ORDER BY date DESC
        LIMIT 60
    `, [userId, today]);

    if (result.rows.length === 0) {
        return insights;
    }

    const spendDates = new Set<string>();
    for (let i = 0; i < result.rows.length; i++) {
        spendDates.add(result.rows.item(i).date);
    }

    // Count consecutive no-spend days backwards from today
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
        const dateStr = d.toISOString().split('T')[0];
        if (spendDates.has(dateStr)) {
            break;
        }
        streak++;
        d.setDate(d.getDate() - 1);
    }

    if (streak >= 3) {
        insights.push({
            type: 'no_spend_streak',
            message: `🔥 You're on a ${streak}-day no-spend streak! That's impressive discipline. Your wallet thanks you.`,
            priority: 2,
        });
    } else if (streak >= 1) {
        insights.push({
            type: 'no_spend_streak',
            message: `💪 ${streak} day${streak > 1 ? 's' : ''} without spending — keep it going! Every day counts.`,
            priority: 5,
        });
    }

    return insights;
}

// ============================================
// 6. Trend Analysis — 3-Month Comparison
// ============================================

async function getTrendAnalysis(userId: number): Promise<Insight[]> {
    const db = getDatabase();
    const insights: Insight[] = [];

    const months: { label: string; total: number }[] = [];

    for (let offset = 0; offset >= -2; offset--) {
        const range = getMonthRange(offset);
        const [result] = await db.executeSql(`
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM transactions
            WHERE user_id = ? AND type = 'debit'
              AND date BETWEEN ? AND ?
        `, [userId, range.start, range.end]);

        const d = new Date();
        d.setMonth(d.getMonth() + offset);
        const label = d.toLocaleString('default', { month: 'short' });
        months.push({ label, total: Number(result.rows.item(0).total) || 0 });
    }

    // months[0] = this month, months[1] = last month, months[2] = 2 months ago
    const [current, prev, twoAgo] = months;

    if (prev.total > 0 && twoAgo.total > 0) {
        const isDecreasing = current.total < prev.total && prev.total < twoAgo.total;
        const isIncreasing = current.total > prev.total && prev.total > twoAgo.total;

        if (isDecreasing) {
            insights.push({
                type: 'trend_analysis',
                message: `📉 Your spending has been dropping for 3 months straight: ${twoAgo.label} ${formatCurrency(twoAgo.total)} → ${prev.label} ${formatCurrency(prev.total)} → ${current.label} ${formatCurrency(current.total)}. Fantastic trend!`,
                priority: 2,
            });
        } else if (isIncreasing) {
            insights.push({
                type: 'trend_analysis',
                message: `📈 Spending has climbed for 3 months: ${twoAgo.label} ${formatCurrency(twoAgo.total)} → ${prev.label} ${formatCurrency(prev.total)} → ${current.label} ${formatCurrency(current.total)}. Might be a good time to review your habits.`,
                priority: 1,
            });
        } else {
            insights.push({
                type: 'trend_analysis',
                message: `📊 3-month trend: ${twoAgo.label} ${formatCurrency(twoAgo.total)}, ${prev.label} ${formatCurrency(prev.total)}, ${current.label} ${formatCurrency(current.total)}. Spending is fluctuating — consistency helps!`,
                priority: 4,
            });
        }
    }

    return insights;
}

// ============================================
// 7. Top Merchant Analysis
// ============================================

async function getTopMerchantAnalysis(userId: number): Promise<Insight[]> {
    const db = getDatabase();
    const thisMonth = getMonthRange(0);
    const insights: Insight[] = [];

    const [result] = await db.executeSql(`
        SELECT merchant, SUM(amount) AS total_spent, COUNT(*) AS txn_count
        FROM transactions
        WHERE user_id = ? AND type = 'debit'
          AND date BETWEEN ? AND ?
        GROUP BY UPPER(merchant)
        ORDER BY total_spent DESC
        LIMIT 3
    `, [userId, thisMonth.start, thisMonth.end]);

    if (result.rows.length > 0) {
        const top = result.rows.item(0);
        const topName = top.merchant;
        const topAmount = Number(top.total_spent) || 0;
        const topCount = Number(top.txn_count) || 0;

        insights.push({
            type: 'top_merchant',
            message: `🏪 Your top merchant this month is ${topName} — ${formatCurrency(topAmount)} across ${topCount} visit${topCount > 1 ? 's' : ''}. ${topCount > 5 ? 'That\'s a lot of trips! Maybe consolidate?' : 'Keeping it focused!'}`,
            priority: 3,
        });

        if (result.rows.length >= 3) {
            const merchants: string[] = [];
            let totalTop3 = 0;
            for (let i = 0; i < Math.min(3, result.rows.length); i++) {
                const r = result.rows.item(i);
                merchants.push(`${r.merchant} (${formatCurrency(Number(r.total_spent))})`);
                totalTop3 += Number(r.total_spent) || 0;
            }

            insights.push({
                type: 'top_merchant',
                message: `📋 Top 3 merchants: ${merchants.join(', ')}. Together that's ${formatCurrency(totalTop3)} this month.`,
                priority: 5,
            });
        }
    }

    return insights;
}

// ============================================
// 8. Daily Average & Monthly Projection
// ============================================

async function getDailyAverageProjection(userId: number): Promise<Insight[]> {
    const db = getDatabase();
    const thisMonth = getMonthRange(0);
    const insights: Insight[] = [];
    const today = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const [result] = await db.executeSql(`
        SELECT COALESCE(SUM(amount), 0) AS total_spent
        FROM transactions
        WHERE user_id = ? AND type = 'debit'
          AND date BETWEEN ? AND ?
    `, [userId, thisMonth.start, thisMonth.end]);

    const totalSpent = Number(result.rows.item(0).total_spent) || 0;

    if (dayOfMonth > 0 && totalSpent > 0) {
        const dailyAvg = totalSpent / dayOfMonth;
        const projection = dailyAvg * daysInMonth;
        const remaining = daysInMonth - dayOfMonth;

        insights.push({
            type: 'daily_average',
            message: `📅 Daily average: ${formatCurrency(dailyAvg)}. At this pace, you'll spend ~${formatCurrency(projection)} by end of month. ${remaining} days left to adjust!`,
            priority: 3,
        });

        // Compare with total budget
        const [budgetResult] = await db.executeSql(`
            SELECT COALESCE(SUM(budget_limit), 0) AS total_budget
            FROM categories
            WHERE user_id = ? AND budget_limit IS NOT NULL AND budget_limit > 0
        `, [userId]);

        const totalBudget = Number(budgetResult.rows.item(0).total_budget) || 0;

        if (totalBudget > 0) {
            const projPct = Math.round((projection / totalBudget) * 100);
            if (projPct > 100) {
                insights.push({
                    type: 'daily_average',
                    message: `⚠️ Projected spending (${formatCurrency(projection)}) is ${projPct}% of your total budget (${formatCurrency(totalBudget)}). You'd need to cut daily spending to ${formatCurrency((totalBudget - totalSpent) / remaining)} to stay on track.`,
                    priority: 1,
                });
            } else if (projPct <= 80) {
                insights.push({
                    type: 'daily_average',
                    message: `✨ Looking great! You're projected to use only ${projPct}% of your budget. Keep this pace and you'll save ${formatCurrency(totalBudget - projection)}!`,
                    priority: 5,
                });
            }
        }
    }

    return insights;
}

// ============================================
// Exported Public API
// ============================================

/**
 * Get a single conversational daily insight — the most relevant one right now
 */
export async function getDailyInsight(userId: number): Promise<string> {
    try {
        const allInsights = await getAllInsights(userId);

        if (allInsights.length === 0) {
            const greetings = [
                "Hey there! 👋 No major insights today — your finances are looking calm. Enjoy the peace!",
                "All quiet on the spending front! 🧘 Keep it up and check back tomorrow.",
                "Nothing to flag today! 💪 Looks like you're in good shape financially.",
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }

        // Return the highest priority insight
        return allInsights[0].message;
    } catch (error) {
        console.error('getDailyInsight error:', error);
        return "I couldn't pull your insights right now — give it another shot in a bit! 🔄";
    }
}

/**
 * Get a comprehensive financial summary — overview paragraph
 */
export async function getFinancialSummary(userId: number): Promise<string> {
    try {
        const db = getDatabase();
        const thisMonth = getMonthRange(0);
        const lastMonth = getMonthRange(-1);
        const today = new Date();
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const monthName = today.toLocaleString('default', { month: 'long' });

        // This month's totals
        const [thisResult] = await db.executeSql(`
            SELECT
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS debit,
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS credit,
                COUNT(*) AS txn_count
            FROM transactions
            WHERE user_id = ? AND date BETWEEN ? AND ?
        `, [userId, thisMonth.start, thisMonth.end]);

        // Last month's totals
        const [lastResult] = await db.executeSql(`
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM transactions
            WHERE user_id = ? AND type = 'debit'
              AND date BETWEEN ? AND ?
        `, [userId, lastMonth.start, lastMonth.end]);

        const thisDebit = Number(thisResult.rows.item(0).debit) || 0;
        const thisCredit = Number(thisResult.rows.item(0).credit) || 0;
        const txnCount = Number(thisResult.rows.item(0).txn_count) || 0;
        const lastDebit = Number(lastResult.rows.item(0).total) || 0;

        const dailyAvg = dayOfMonth > 0 ? thisDebit / dayOfMonth : 0;
        const projection = dailyAvg * daysInMonth;

        let trend = '';
        if (lastDebit > 0) {
            const changePct = Math.round(((thisDebit - lastDebit) / lastDebit) * 100);
            if (changePct > 0) {
                trend = `That's ${changePct}% more than last month.`;
            } else if (changePct < 0) {
                trend = `That's ${Math.abs(changePct)}% less than last month — great job!`;
            } else {
                trend = `About the same as last month.`;
            }
        }

        const parts = [
            `📊 **${monthName} Summary** (Day ${dayOfMonth}/${daysInMonth})`,
            ``,
            `You've spent ${formatCurrency(thisDebit)} across ${txnCount} transactions this month.`,
            trend,
            thisCredit > 0 ? `You received ${formatCurrency(thisCredit)} in credits.` : '',
            `Daily average: ${formatCurrency(dailyAvg)}. Projected month-end: ${formatCurrency(projection)}.`,
        ].filter(Boolean);

        return parts.join('\n');
    } catch (error) {
        console.error('getFinancialSummary error:', error);
        return "Couldn't generate your summary right now. Try again in a moment! 🔄";
    }
}

/**
 * Answer a natural-language spending question with real data
 */
export async function getSpendingAnswer(userId: number, question: string): Promise<string> {
    try {
        const db = getDatabase();
        const thisMonth = getMonthRange(0);
        const q = (question || '').toLowerCase().trim();

        // Fetch full contextual stats from SQLite
        const [spentResult] = await db.executeSql(`
            SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
            FROM transactions
            WHERE user_id = ? AND type = 'debit'
              AND date BETWEEN ? AND ?
        `, [userId, thisMonth.start, thisMonth.end]);

        const [budgetResult] = await db.executeSql(`
            SELECT COALESCE(SUM(budget_limit), 0) AS total_budget
            FROM categories
            WHERE user_id = ? AND budget_limit IS NOT NULL AND budget_limit > 0
        `, [userId]);

        const totalSpent = Number(spentResult.rows.item(0).total) || 0;
        const totalBudget = Number(budgetResult.rows.item(0).total_budget) || 0;
        const txnCount = Number(spentResult.rows.item(0).count) || 0;
        const netSaved = Math.max(0, totalBudget - totalSpent);

        const today = new Date();
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - dayOfMonth;
        const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
        const projectedTotal = dailyAvg * daysInMonth;

        // 1. Biggest Expense Query
        if (q.includes('biggest') || q.includes('largest') || q.includes('most expensive') || q.includes('top expense')) {
            const [result] = await db.executeSql(`
                SELECT merchant, amount, date, category_name
                FROM transactions
                WHERE user_id = ? AND type = 'debit'
                  AND date BETWEEN ? AND ?
                ORDER BY amount DESC
                LIMIT 1
            `, [userId, thisMonth.start, thisMonth.end]);

            if (result.rows.length > 0) {
                const row = result.rows.item(0);
                const pctOfTotal = totalSpent > 0 ? Math.round((Number(row.amount) / totalSpent) * 100) : 0;
                return [
                    `📊 **Biggest Expense Breakdown**`,
                    `Your single largest expense this month was **${formatCurrency(row.amount)}** spent at **${row.merchant}** on ${row.date}.`,
                    `💡 **Financial Context & Risk Impact**\n• This purchase accounts for **${pctOfTotal}%** of your total monthly outflow (${formatCurrency(totalSpent)}).\n• Category: **${row.category_name || 'General'}**.`,
                    `🎯 **Actionable Advice**\n1. Review if this was a planned key purchase or impulse spending.\n2. You have **${daysLeft} days** left in the month with a daily burn rate of **${formatCurrency(dailyAvg)}/day**.\n3. Consider setting a single-transaction limit in your budget controls to stay ahead!`
                ].join('\n\n');
            }
            return `📊 **Expense Analysis**\n\nNo debit transactions recorded yet for this month! Tap + to log an expense.`;
        }

        // 2. Savings & Budget Remaining Query
        if (q.includes('save') || q.includes('saving') || q.includes('left') || q.includes('afford') || q.includes('budget')) {
            const [catBudgetResult] = await db.executeSql(`
                SELECT c.name, c.budget_limit AS budget, COALESCE(SUM(t.amount), 0) AS spent
                FROM categories c
                LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = ? AND t.type = 'debit' AND t.date BETWEEN ? AND ?
                WHERE c.user_id = ? AND c.budget_limit > 0
                GROUP BY c.id
                ORDER BY spent DESC
            `, [userId, thisMonth.start, thisMonth.end, userId]);

            const categoryBreakdown: string[] = [];
            for (let i = 0; i < catBudgetResult.rows.length; i++) {
                const item = catBudgetResult.rows.item(i);
                const b = Number(item.budget) || 0;
                const s = Number(item.spent) || 0;
                const pct = Math.round((s / b) * 100);
                categoryBreakdown.push(`• **${item.name}**: ${formatCurrency(s)} / ${formatCurrency(b)} (${pct}% used)`);
            }

            const isUnder = totalSpent <= totalBudget;
            return [
                `🎯 **Budget & Savings Intelligence**`,
                totalBudget > 0
                    ? `You have spent **${formatCurrency(totalSpent)}** against a total budget of **${formatCurrency(totalBudget)}**. ${isUnder ? `Remaining surplus: **${formatCurrency(totalBudget - totalSpent)}**!` : `Currently over budget by **${formatCurrency(totalSpent - totalBudget)}**!`}`
                    : `Total monthly spend is **${formatCurrency(totalSpent)}**. (No category budget limits set yet).`,
                categoryBreakdown.length > 0 ? `📊 **Category Budget Breakdown**\n${categoryBreakdown.join('\n')}` : `💡 *Tip: Add category budgets in the Budget tab to enable granular tracking.*`,
                `🧠 **Pacing & Action Plan**\n• **Pacing**: ${daysLeft} days remaining in month.\n• **Daily Safe Target**: ${daysLeft > 0 ? formatCurrency(Math.max(0, totalBudget - totalSpent) / daysLeft) : formatCurrency(0)}/day.\n• **Projected EOM Spend**: ${formatCurrency(projectedTotal)} (${totalBudget > 0 ? `${Math.round((projectedTotal / totalBudget) * 100)}% of budget` : 'unconstrained'}).`
            ].join('\n\n');
        }

        // 3. Top Merchants & Store Breakdown
        if (q.includes('merchant') || q.includes('store') || q.includes('where') || q.includes('vendor') || q.includes('place')) {
            const [merResult] = await db.executeSql(`
                SELECT merchant, SUM(amount) AS total_spent, COUNT(*) AS txn_count
                FROM transactions
                WHERE user_id = ? AND type = 'debit'
                  AND date BETWEEN ? AND ?
                GROUP BY UPPER(merchant)
                ORDER BY total_spent DESC
                LIMIT 5
            `, [userId, thisMonth.start, thisMonth.end]);

            if (merResult.rows.length > 0) {
                const merchants: string[] = [];
                for (let i = 0; i < merResult.rows.length; i++) {
                    const r = merResult.rows.item(i);
                    const amt = Number(r.total_spent) || 0;
                    const cnt = Number(r.txn_count) || 0;
                    merchants.push(`${i + 1}. **${r.merchant}**: ${formatCurrency(amt)} (${cnt} visit${cnt > 1 ? 's' : ''})`);
                }

                return [
                    `🏪 **Top Merchants & Outlets Ranking**`,
                    merchants.join('\n'),
                    `💡 **Merchant Concentration Analysis**\nYour highest merchant outflow is at **${merResult.rows.item(0).merchant}** (${formatCurrency(Number(merResult.rows.item(0).total_spent))}). High transaction frequency at specific merchants indicates key opportunity areas for bulk discounts or loyalty savings.`
                ].join('\n\n');
            }
        }

        // 4. Specific Category Search (e.g. Food, Shopping, Transport)
        let searchTerm = q.replace(/how much|did i|spend|spent|on|at|for|my|the|this|month|category|\?|\./gi, '').trim();
        if (!searchTerm) searchTerm = q;

        const [catSearch] = await db.executeSql(`
            SELECT c.name, c.budget_limit AS budget, COALESCE(SUM(t.amount), 0) AS total, COUNT(t.id) AS count
            FROM categories c
            LEFT JOIN transactions t
                ON t.category_id = c.id AND t.user_id = ? AND t.type = 'debit'
                AND t.date BETWEEN ? AND ?
            WHERE c.user_id = ? AND UPPER(c.name) LIKE UPPER(?)
            GROUP BY c.id
        `, [userId, thisMonth.start, thisMonth.end, userId, `%${searchTerm}%`]);

        if (catSearch.rows.length > 0 && Number(catSearch.rows.item(0).count) > 0) {
            const row = catSearch.rows.item(0);
            const spent = Number(row.total) || 0;
            const budget = Number(row.budget) || 0;
            const count = Number(row.count) || 0;
            const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

            return [
                `📝 **${row.name} Category Deep-Dive**`,
                `• **Total Spent**: **${formatCurrency(spent)}** across **${count}** transaction${count !== 1 ? 's' : ''}.`,
                budget > 0 ? `• **Category Budget**: ${formatCurrency(budget)} (${pct}% used, ${formatCurrency(budget - spent)} remaining).` : `• **Category Budget**: No limit defined.`,
                `💡 **Intelligence & Recommendations**\n${spent > (budget || 5000) ? `⚠️ ${row.name} spending is running high. Consider setting daily caps for the next ${daysLeft} days.` : `✅ ${row.name} spending is well controlled and within healthy limits!`}`
            ].join('\n\n');
        }

        // 5. Default General Financial Analysis
        return [
            `📊 **Comprehensive Monthly Financial Analysis**`,
            `• **Total Outflow**: **${formatCurrency(totalSpent)}** (${txnCount} transactions logged).`,
            `• **Active Budget**: **${formatCurrency(totalBudget)}** | Net Surplus: **${formatCurrency(netSaved)}**.`,
            `• **Current Velocity**: **${formatCurrency(dailyAvg)}/day** | Projected EOM: **${formatCurrency(projectedTotal)}**.`,
            `💡 **Financial Assistant Summary**\nMaintain a target daily spend under **${daysLeft > 0 ? formatCurrency(Math.max(0, totalBudget - totalSpent) / daysLeft) : formatCurrency(0)}** for the remaining **${daysLeft} days** of the month to maximize net savings.`,
            `ℹ️ *This automated summary is for expense tracking only and does not constitute financial advice.*`
        ].join('\n\n');

    } catch (error) {
        console.error('getSpendingAnswer error:', error);
        return "I couldn't analyze your data right now. Please try again! 🔄";
    }
}

/**
 * Get ALL insights, sorted by priority (1 = most urgent)
 */
export async function getAllInsights(userId: number): Promise<Insight[]> {
    try {
        const allPromises = await Promise.allSettled([
            getSpendingAlerts(userId),
            getBudgetWarnings(userId),
            getSavingsOpportunities(userId),
            getWeeklySummary(userId),
            getNoSpendStreak(userId),
            getTrendAnalysis(userId),
            getTopMerchantAnalysis(userId),
            getDailyAverageProjection(userId),
        ]);

        const insights: Insight[] = [];

        for (const result of allPromises) {
            if (result.status === 'fulfilled') {
                insights.push(...result.value);
            }
        }

        insights.sort((a, b) => a.priority - b.priority);
        return insights;
    } catch (error) {
        console.error('getAllInsights error:', error);
        return [];
    }
}

/**
 * Generate full financial context from SQLite for model reasoning
 */
export async function getFullAppContext(userId: number): Promise<{
    summaryText: string;
    monthlyTotal: number;
    budgetTotal: number;
    savedTotal: number;
    categories: Array<{ name: string; budget: number; spent: number }>;
    recentTransactions: Array<{ merchant: string; amount: number; date: string; type: string }>;
}> {
    try {
        const db = getDatabase();
        const thisMonth = getMonthRange(0);

        const [spentResult] = await db.executeSql(`
            SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
            FROM transactions
            WHERE user_id = ? AND type = 'debit'
              AND date BETWEEN ? AND ?
        `, [userId, thisMonth.start, thisMonth.end]);

        const [budgetResult] = await db.executeSql(`
            SELECT COALESCE(SUM(budget_limit), 0) AS total_budget
            FROM categories
            WHERE user_id = ? AND budget_limit IS NOT NULL AND budget_limit > 0
        `, [userId]);

        const monthlyTotal = Number(spentResult.rows.item(0).total) || 0;
        const budgetTotal = Number(budgetResult.rows.item(0).total_budget) || 0;
        const savedTotal = Math.max(0, budgetTotal - monthlyTotal);

        const [catResult] = await db.executeSql(`
            SELECT c.name, COALESCE(c.budget_limit, 0) AS budget, COALESCE(SUM(t.amount), 0) AS spent
            FROM categories c
            LEFT JOIN transactions t
                ON t.category_id = c.id AND t.user_id = ? AND t.type = 'debit'
                AND t.date BETWEEN ? AND ?
            WHERE c.user_id = ?
            GROUP BY c.id
            HAVING spent > 0 OR budget > 0
            ORDER BY spent DESC
        `, [userId, thisMonth.start, thisMonth.end, userId]);

        const categories = [];
        for (let i = 0; i < catResult.rows.length; i++) {
            const item = catResult.rows.item(i);
            categories.push({
                name: item.name,
                budget: Number(item.budget) || 0,
                spent: Number(item.spent) || 0
            });
        }

        const [txResult] = await db.executeSql(`
            SELECT merchant, amount, date, type
            FROM transactions
            WHERE user_id = ?
            ORDER BY date DESC, id DESC
            LIMIT 10
        `, [userId]);

        const recentTransactions = [];
        for (let i = 0; i < txResult.rows.length; i++) {
            const item = txResult.rows.item(i);
            recentTransactions.push({
                merchant: item.merchant,
                amount: Number(item.amount),
                date: item.date,
                type: item.type
            });
        }

        const summaryText = await getFinancialSummary(userId);

        return {
            summaryText,
            monthlyTotal,
            budgetTotal,
            savedTotal,
            categories,
            recentTransactions
        };
    } catch (e) {
        console.error('getFullAppContext error:', e);
        return {
            summaryText: 'Financial summary unavailable',
            monthlyTotal: 0,
            budgetTotal: 0,
            savedTotal: 0,
            categories: [],
            recentTransactions: []
        };
    }
}
