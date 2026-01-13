// Global application state using Zustand

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, type UserInfo } from '../services';
import { getCategories, getTransactions, getMonthlySpending, getCategorySpending, ensureUserInitialized, type Category, type Transaction } from '../database';

interface AuthState {
    isAuthenticated: boolean;
    user: UserInfo | null;
    isLoading: boolean;
}

interface ExpenseState {
    transactions: Transaction[];
    categories: Category[];
    monthlyTotal: number;
    categorySpending: { categoryId: number; total: number }[];
    isLoading: boolean;
}

interface AppState extends AuthState, ExpenseState {
    // Auth actions
    setUser: (user: UserInfo | null) => void;
    setAuthenticated: (value: boolean) => void;
    logout: () => Promise<void>;
    checkAuth: () => Promise<boolean>;

    // Expense actions
    loadTransactions: (limit?: number) => void;
    loadCategories: () => void;
    loadMonthlyStats: () => void;
    refreshAll: () => void;

    // UI state
    selectedMonth: { year: number; month: number };
    setSelectedMonth: (year: number, month: number) => void;

    // Global Settings
    currencySymbol: string;
    setCurrencySymbol: (symbol: string) => void;
}

const getCurrentMonth = () => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Initial auth state
            isAuthenticated: false,
            user: null,
            isLoading: true,

            // Initial expense state
            transactions: [],
            categories: [],
            monthlyTotal: 0,
            categorySpending: [],

            // Global Settings
            currencySymbol: '₹',
            setCurrencySymbol: (symbol: string) => set({ currencySymbol: symbol }),

            // Selected month for filtering
            selectedMonth: getCurrentMonth(),

            // Auth actions
            setUser: (user) => set({ user, isAuthenticated: !!user }),

            setAuthenticated: (value) => set({ isAuthenticated: value }),

            checkAuth: async () => {
                set({ isLoading: true });
                try {
                    const isAuth = await authService.isAuthenticated();
                    set({ isAuthenticated: isAuth, isLoading: false });
                    return isAuth;
                } catch (error) {
                    set({ isAuthenticated: false, isLoading: false });
                    return false;
                }
            },

            logout: async () => {
                await authService.logout();
                set({
                    isAuthenticated: false,
                    user: null,
                    transactions: [],
                    categories: [],
                    monthlyTotal: 0,
                    categorySpending: [],
                });
            },

            // Expense actions
            loadTransactions: async (limit = 50) => {
                const { user, selectedMonth } = get();
                if (!user) return; // Guard clause

                try {
                    const startDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`;
                    const endDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-31`;

                    const transactions = await getTransactions(user.id, limit, 0, startDate, endDate);
                    set({ transactions });
                } catch (error) {
                    console.error('Failed to load transactions:', error);
                }
            },

            loadCategories: async () => {
                const { user } = get();
                // We allow loading categories without user (defaults), but better to wait
                // For now pass undefined if no user
                try {
                    if (user) {
                        await ensureUserInitialized(user.id);
                    }
                    const categories = await getCategories(user ? user.id : undefined);
                    // Ensure we always set an array
                    set({ categories: Array.isArray(categories) ? categories : [] });
                } catch (error) {
                    console.error('Failed to load categories:', error);
                    // Don't set state on error to preserve initial []
                }
            },

            loadMonthlyStats: async () => {
                const { user, selectedMonth } = get();
                if (!user) return; // Guard clause

                try {
                    const monthlyTotal = await getMonthlySpending(user.id, selectedMonth.year, selectedMonth.month);
                    const categorySpending = await getCategorySpending(user.id, selectedMonth.year, selectedMonth.month);
                    set({ monthlyTotal, categorySpending });
                } catch (error) {
                    console.error('Failed to load monthly stats:', error);
                }
            },

            refreshAll: async () => {
                const { loadTransactions, loadCategories, loadMonthlyStats, user } = get();
                if (!user) return;

                // Do not set global isLoading here as it unmounts the AppStack
                await Promise.all([
                    loadCategories(),
                    loadTransactions(),
                    loadMonthlyStats()
                ]);
            },

            setSelectedMonth: (year, month) => {
                set({ selectedMonth: { year, month } });
                // Refresh data for new month
                const { loadTransactions, loadMonthlyStats } = get();
                loadTransactions();
                loadMonthlyStats();
            },
        }),
        {
            name: 'expense-tracker-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                user: state.user,
                currencySymbol: state.currencySymbol,
                // Don't persist selectedMonth so we always start fresh
            }),
        }
    )
);

export default useAppStore;
