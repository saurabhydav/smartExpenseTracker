// Utility functions and constants

// Mutable currency code (set by App.tsx from Store)
let globalCurrencyCode = 'INR';

export function setGlobalCurrency(code: string) {
    globalCurrencyCode = code;
}

// Format currency
export function formatCurrency(amount: number, currency: string = globalCurrencyCode): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

// Format date
export function formatDate(dateString: string, format: 'short' | 'long' = 'short'): string {
    const date = new Date(dateString);

    if (format === 'short') {
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
        });
    }

    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

// Format relative time
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateString);
}

// Get month name
export function getMonthName(month: number): string {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
}

// Calculate percentage
export function calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
}

// Theme colors
export const colors = {
    primary: '#6366f1',
    primaryDark: '#4f46e5',
    secondary: '#10b981',
    background: '#0f172a',
    surface: '#1e293b',
    surfaceLight: '#334155',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    border: '#334155',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
    debit: '#ef4444',
    credit: '#22c55e',
};

// Category icons (Material icons names)
export const categoryIcons: Record<string, string> = {
    'Food & Dining': 'restaurant',
    'Shopping': 'shopping-cart',
    'Transportation': 'directions-car',
    'Entertainment': 'movie',
    'Bills & Utilities': 'receipt',
    'Health': 'favorite',
    'Education': 'school',
    'Travel': 'flight',
    'Groceries': 'shopping-basket',
    'Other': 'more-horiz',
};

// Get icon for category
export function getCategoryIcon(categoryName: string): string {
    return categoryIcons[categoryName] || 'label';
}
