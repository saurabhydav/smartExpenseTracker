jest.mock('llama.rn', () => ({
    initLlama: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
    getGenericPassword: jest.fn(),
    setGenericPassword: jest.fn(),
    resetGenericPassword: jest.fn(),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
}));

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/test-dir',
    exists: jest.fn(),
    mkdir: jest.fn(),
}));

jest.mock('react-native-device-info', () => ({
    getTotalMemory: jest.fn().mockResolvedValue(4 * 1024 * 1024 * 1024),
}));

jest.mock('react-native', () => ({
    NativeModules: {},
    Platform: { OS: 'android', select: jest.fn(obj => obj.android) },
    DeviceEventEmitter: { emit: jest.fn(), addListener: jest.fn() },
    AppRegistry: { registerHeadlessTask: jest.fn(), registerComponent: jest.fn() },
}));

import { getRequiredExp, processTransactionGamification } from '../services/TamagotchiService';

describe('TamagotchiService Unit Tests', () => {
    test('getRequiredExp calculates logarithmic progression curve', () => {
        expect(getRequiredExp(1)).toBe(100);
        expect(getRequiredExp(2)).toBe(114);
        expect(getRequiredExp(3)).toBeGreaterThan(120);
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
