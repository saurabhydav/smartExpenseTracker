import { useAppStore, type TamagotchiState } from '../store';
import { getDatabase, getCategoryById } from '../database';

// Logarithmic EXP progression curve (Step 61)
export function getRequiredExp(level: number): number {
    return Math.floor(100 * Math.pow(1.15, level - 1));
}

/**
 * Real over-budget check, replacing the previous hardcoded `false` passed at
 * every call site. Budgets in this app are set per-category (categories.budget_limit,
 * nullable) rather than as one flat monthly number, so this looks up the specific
 * category's limit and compares it against that category's actual month-to-date
 * spend. A category with no budget set returns false — no budget means nothing
 * to be "over."
 */
export async function checkCategoryOverBudget(userId: number, categoryId: number): Promise<boolean> {
    try {
        const category = await getCategoryById(categoryId);
        if (!category || category.budgetLimit == null) {
            return false;
        }

        const db = getDatabase();
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        const [result] = await db.executeSql(
            `SELECT COALESCE(SUM(amount), 0) as total
             FROM transactions
             WHERE user_id = ? AND category_id = ? AND type = 'debit' AND date >= ?`,
            [userId, categoryId, monthStart]
        );

        const monthToDateSpend = result.rows.item(0).total as number;
        return monthToDateSpend > category.budgetLimit;
    } catch (err) {
        // A failed lookup shouldn't block a transaction from saving or crash
        // the gamification flow — default to "not over budget" and let the
        // pet's mood catch up on the next successful check.
        console.warn('[TamagotchiService] checkCategoryOverBudget failed, defaulting to false:', err);
        return false;
    }
}

// Evaluate expense transaction and calculate gamification EXP / Coin adjustments (Steps 62 & 63)
export function processTransactionGamification(
    type: 'debit' | 'credit',
    amount: number,
    categoryName: string,
    isOverBudget: boolean
): { expDelta: number; coinDelta: number; message: string } {
    let expDelta = 0;
    let coinDelta = 0;
    let message = '';

    const lowerCategory = (categoryName || '').toLowerCase();

    // 1. Savings & Investment Bonus (+50 EXP, +15 Coins)
    if (lowerCategory.includes('saving') || lowerCategory.includes('investment') || lowerCategory.includes('deposit')) {
        expDelta = 50;
        coinDelta = 15;
        message = 'Great investment! +50 EXP & +15 Coins 💰';
    } 
    // 2. Budget Over-spending Debuff (-25 EXP, -10 Coins)
    else if (isOverBudget) {
        expDelta = -25;
        coinDelta = -10;
        message = 'Budget limit exceeded! -25 EXP ⚠️';
    } 
    // 3. Regular Transaction Reward
    else if (type === 'debit') {
        expDelta = 10;
        coinDelta = 2;
        message = 'Transaction logged! +10 EXP 📝';
    } else {
        expDelta = 15;
        coinDelta = 5;
        message = 'Income recorded! +15 EXP 💵';
    }

    return { expDelta, coinDelta, message };
}

// Update pet state with leveling and ghost state triggers
export function applyGamificationUpdate(expDelta: number, coinDelta: number): void {
    const store = useAppStore.getState();
    const tamagotchi = store.tamagotchi || {
        petType: 'cat',
        petsData: {},
        level: 1,
        exp: 0,
        coins: 100,
        streakDays: 1,
        ghostState: false,
    };

    const currentPetId = tamagotchi.petType || 'cat';
    const petsData = { ...(tamagotchi.petsData || {}) };
    
    const activePet = petsData[currentPetId] || {
        level: tamagotchi.level || 1,
        exp: tamagotchi.exp || 0,
        coins: tamagotchi.coins || 100,
        feedCount: 0,
        playCount: 0,
        specialCount: 0,
    };

    let newLevel = activePet.level;
    let newExp = activePet.exp + expDelta;
    let newCoins = Math.max(0, activePet.coins + coinDelta);
    let newGhostState = tamagotchi.ghostState;

    // Level up check
    let required = getRequiredExp(newLevel);
    while (newExp >= required && newLevel < 10) {
        newExp -= required;
        newLevel += 1;
        required = getRequiredExp(newLevel);
    }

    if (newLevel >= 10) {
        newLevel = 10;
        newExp = Math.min(newExp, getRequiredExp(10));
    }

    // Ghost state trigger if EXP drops below -50
    if (newExp < -50) {
        newGhostState = true;
        newExp = 0;
    } else if (newExp < 0) {
        newExp = 0;
    }

    petsData[currentPetId] = {
        ...activePet,
        level: newLevel,
        exp: newExp,
        coins: newCoins,
    };

    store.updateTamagotchi({
        petsData,
        level: newLevel,
        exp: newExp,
        coins: newCoins,
        ghostState: newGhostState,
    });
}
