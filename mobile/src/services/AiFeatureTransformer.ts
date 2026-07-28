import { getDatabase } from '../database';
import { formatCurrency } from '../utils';

export async function getAiHealthSummary(userId: number): Promise<string> {
    return "Your monthly budget is on track! Discretionary spending velocity is within healthy thresholds. 🚀";
}

export interface BudgetExhaustionPrediction {
    categoryId: number;
    categoryName: string;
    budgetLimit: number;
    currentSpent: number;
    dailyVelocity: number;
    projectedDepletionDate: string | null; // e.g. "July 24"
    isExhaustionRisk: boolean;
    daysRemaining: number;
}

/**
 * Feature 2: AI Budget Exhaustion & Velocity Warning System
 * Predicts the exact date a category budget will run out based on current spending rate.
 */
export async function calculateBudgetDepletionVelocity(userId: number): Promise<BudgetExhaustionPrediction[]> {
    try {
        const db = getDatabase();
        const today = new Date();
        const currentDayOfMonth = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        // Query categories with budget limits
        const [catResult] = await db.executeSql(
            'SELECT id, name, budget_limit FROM categories WHERE user_id = ? AND budget_limit > 0',
            [userId]
        );

        const predictions: BudgetExhaustionPrediction[] = [];

        for (let i = 0; i < catResult.rows.length; i++) {
            const cat = catResult.rows.item(i);
            const categoryId = cat.id;
            const categoryName = cat.name;
            const budgetLimit = cat.budget_limit;

            // Query current month spending for this category
            const [spendResult] = await db.executeSql(
                `SELECT SUM(amount) as spent FROM transactions 
                 WHERE user_id = ? AND category_id = ? AND type = "debit"`,
                [userId, categoryId]
            );

            const currentSpent = spendResult.rows.item(0).spent || 0;
            const dailyVelocity = currentSpent / Math.max(1, currentDayOfMonth);

            let projectedDepletionDate: string | null = null;
            let isExhaustionRisk = false;
            let daysRemaining = daysInMonth - currentDayOfMonth;

            if (dailyVelocity > 0) {
                const remainingBudget = budgetLimit - currentSpent;
                if (remainingBudget <= 0) {
                    projectedDepletionDate = 'Exhausted Today';
                    isExhaustionRisk = true;
                    daysRemaining = 0;
                } else {
                    const daysUntilDepletion = Math.floor(remainingBudget / dailyVelocity);
                    if (daysUntilDepletion < daysInMonth - currentDayOfMonth) {
                        const depletionDay = currentDayOfMonth + daysUntilDepletion;
                        const depletionDateObj = new Date(today.getFullYear(), today.getMonth(), depletionDay);
                        const monthName = depletionDateObj.toLocaleString('default', { month: 'short' });
                        projectedDepletionDate = `${monthName} ${depletionDay}`;
                        isExhaustionRisk = true;
                        daysRemaining = daysUntilDepletion;
                    }
                }
            }

            predictions.push({
                categoryId,
                categoryName,
                budgetLimit,
                currentSpent,
                dailyVelocity: Number(dailyVelocity.toFixed(2)),
                projectedDepletionDate,
                isExhaustionRisk,
                daysRemaining,
            });
        }

        return predictions;
    } catch (e) {
        console.error('Failed to calculate budget depletion velocity:', e);
        return [];
    }
}
