import { getRequiredExp, processTransactionGamification } from '../services/TamagotchiService';

describe('TamagotchiService Unit Tests', () => {
    test('getRequiredExp calculates logarithmic progression curve', () => {
        expect(getRequiredExp(1)).toBe(100);
        expect(getRequiredExp(2)).toBe(115);
        expect(getRequiredExp(3)).toBe(132);
        expect(getRequiredExp(10)).toBeGreaterThan(300);
    });

    test('processTransactionGamification rewards investment category', () => {
        const result = processTransactionGamification('debit', 500, 'Investments', false);
        expect(result.expDelta).toBe(50);
        expect(result.coinDelta).toBe(15);
    });

    test('processTransactionGamification penalizes over-budget spending', () => {
        const result = processTransactionGamification('debit', 200, 'Shopping', true);
        expect(result.expDelta).toBe(-25);
        expect(result.coinDelta).toBe(-10);
    });

    test('processTransactionGamification rewards regular income', () => {
        const result = processTransactionGamification('credit', 1000, 'Salary', false);
        expect(result.expDelta).toBe(15);
        expect(result.coinDelta).toBe(5);
    });
});
