// Dashboard Screen - Main expense overview with AI Integration

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    RefreshControl,
    DeviceEventEmitter,
} from 'react-native';
import { useAppStore } from '../store';
import { colors, formatCurrency, getMonthName, calculatePercentage } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { checkUpcomingSubscriptionsAndNotify } from '../services/SubscriptionService';
import { FinancialTamagotchi } from '../components';
import { getDailyInsight } from '../services/AIAdvisorService';

const { width } = Dimensions.get('window');

const getInitials = (name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
};

interface DashboardScreenProps {
    navigation: any;
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
    const {
        transactions,
        categories,
        monthlyTotal,
        categorySpending,
        selectedMonth,
        refreshAll,
        setSelectedMonth,
        user,
        isLoading,
    } = useAppStore();

    // Defensive check
    const safeCategories = Array.isArray(categories) ? categories : [];
    const safeCategorySpending = Array.isArray(categorySpending) ? categorySpending : [];

    const [refreshing, setRefreshing] = useState(false);
    const [aiSummary, setAiSummary] = useState<string>('Analyzing your monthly financial health...');
    const [healthScore, setHealthScore] = useState<number>(85);

    const userId = user?.id || 1;

    const loadAiInsights = async () => {
        try {
            const insight = await getDailyInsight(userId);
            setAiSummary(insight);
            // Calculate dynamic health score from budget usage
            const safeCS = Array.isArray(categorySpending) ? categorySpending : [];
            const totalBudget = safeCategories.reduce((s, c) => s + (c.budgetLimit || 0), 0);
            if (totalBudget > 0) {
                const usagePct = (monthlyTotal / totalBudget) * 100;
                setHealthScore(Math.max(30, Math.min(98, Math.round(100 - usagePct))));
            } else {
                setHealthScore(75);
            }
        } catch (e) {
            setAiSummary('Keep tracking your daily expenses to keep your budget healthy!');
        }
    };

    useEffect(() => {
        refreshAll();
        loadAiInsights();
        if (user) {
            checkUpcomingSubscriptionsAndNotify(user.id);
        }
        const subscription = DeviceEventEmitter.addListener('TRANSACTION_UPDATED', () => {
            refreshAll();
            loadAiInsights();
        });
        return () => subscription.remove();
    }, [user]);

    const onRefresh = async () => {
        setRefreshing(true);
        refreshAll();
        await loadAiInsights();
        setRefreshing(false);
    };

    const navigateMonth = (direction: number) => {
        let newMonth = selectedMonth.month + direction;
        let newYear = selectedMonth.year;

        if (newMonth > 12) {
            newMonth = 1;
            newYear++;
        } else if (newMonth < 1) {
            newMonth = 12;
            newYear--;
        }

        setSelectedMonth(newYear, newMonth);
    };

    // Get top spending categories
    const topCategories = (safeCategorySpending || [])
        .map(cs => {
            const category = safeCategories.find(c => c.id === cs.categoryId);
            return { ...cs, category };
        })
        .filter(cs => cs.category)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'User'}</Text>
                    <Text style={styles.subtitle}>Here's your expense summary</Text>
                </View>
                <TouchableOpacity 
                    style={styles.profileButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <Text style={styles.profileButtonText}>
                        {getInitials(user?.name || 'User')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Month Selector */}
            <View style={styles.monthSelector}>
                <TouchableOpacity onPress={() => navigateMonth(-1)}>
                    <Icon name="chevron-left" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                    {getMonthName(selectedMonth.month)} {selectedMonth.year}
                </Text>
                <TouchableOpacity onPress={() => navigateMonth(1)}>
                    <Icon name="chevron-right" size={28} color={colors.text} />
                </TouchableOpacity>
            </View>



            {/* Financial Tamagotchi Pet Widget */}
            <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                <FinancialTamagotchi />
            </View>

            {/* Total Spending Card */}
            <View style={styles.totalCard}>
                <View style={styles.totalCardGradient}>
                    <Text style={styles.totalLabel}>Total Spending</Text>
                    <Text style={styles.totalAmount}>{formatCurrency(monthlyTotal)}</Text>
                    <View style={styles.totalStats}>
                        <View style={styles.statItem}>
                            <Icon name="trending-down" size={16} color={colors.debit} />
                            <Text style={styles.statText}>{transactions.filter(t => t.type === 'debit').length} expenses</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Icon name="trending-up" size={16} color={colors.credit} />
                            <Text style={styles.statText}>{transactions.filter(t => t.type === 'credit').length} income</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Category Breakdown */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>By Category</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Budget')}>
                        <Text style={styles.seeAllText}>See All</Text>
                    </TouchableOpacity>
                </View>

                {topCategories.length > 0 ? (
                    topCategories.map((item, index) => (
                        <View key={item.categoryId} style={styles.categoryRow}>
                            <View style={[styles.categoryIcon, { backgroundColor: item.category?.color + '20' }]}>
                                <Icon name={item.category?.icon || 'label'} size={20} color={item.category?.color} />
                            </View>
                            <View style={styles.categoryInfo}>
                                <Text style={styles.categoryName}>{item.category?.name}</Text>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${calculatePercentage(item.total, monthlyTotal)}%`,
                                                backgroundColor: item.category?.color,
                                            }
                                        ]}
                                    />
                                </View>
                            </View>
                            <Text style={styles.categoryAmount}>{formatCurrency(item.total)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No spending this month</Text>
                )}
            </View>

            {/* Recent Transactions */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                        <Text style={styles.seeAllText}>See All</Text>
                    </TouchableOpacity>
                </View>

                {transactions.slice(0, 5).map((transaction) => {
                    const category = safeCategories.find(c => c.id === transaction.categoryId);
                    return (
                        <TouchableOpacity
                            key={transaction.id}
                            style={styles.transactionRow}
                            onPress={() => navigation.navigate('TransactionDetail', { transaction })}
                        >
                            <View style={[styles.categoryIcon, { backgroundColor: (category?.color || colors.primary) + '20' }]}>
                                <Icon name={category?.icon || 'receipt'} size={20} color={category?.color || colors.primary} />
                            </View>
                            <View style={styles.transactionInfo}>
                                <Text style={styles.merchantName}>{transaction.merchant}</Text>
                                <Text style={styles.transactionDate}>{transaction.date}</Text>
                            </View>
                            <Text
                                style={[
                                    styles.transactionAmount,
                                    { color: transaction.type === 'debit' ? colors.debit : colors.credit }
                                ]}
                            >
                                {transaction.type === 'debit' ? '-' : '+'}{formatCurrency(transaction.amount)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: 16,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginVertical: 8,
    },
    monthText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    aiHealthCard: {
        backgroundColor: colors.surface,
        marginHorizontal: 24,
        marginVertical: 12,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    aiHealthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    aiBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: colors.primary,
    },
    healthScoreText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.text,
    },
    aiSummaryText: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
        marginBottom: 12,
    },
    aiChatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.primary,
        paddingVertical: 10,
        borderRadius: 12,
    },
    aiChatButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    totalCard: {
        marginHorizontal: 24,
        marginBottom: 20,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    totalCardGradient: {
        padding: 20,
    },
    totalLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    totalAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
        marginVertical: 8,
    },
    totalStats: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 4,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: colors.textMuted,
    },
    section: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    seeAllText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    categoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    categoryInfo: {
        flex: 1,
        marginRight: 12,
    },
    categoryName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    progressBar: {
        height: 6,
        backgroundColor: colors.surface,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    categoryAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    transactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    transactionInfo: {
        flex: 1,
    },
    merchantName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    transactionDate: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        marginVertical: 12,
    },
});
