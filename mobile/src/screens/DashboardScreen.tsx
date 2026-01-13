// Dashboard Screen - Main expense overview

import React, { useEffect } from 'react';
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

const { width } = Dimensions.get('window');

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

    const [refreshing, setRefreshing] = React.useState(false);

    useEffect(() => {
        refreshAll();
        const subscription = DeviceEventEmitter.addListener('TRANSACTION_UPDATED', () => {
            refreshAll();
        });
        return () => subscription.remove();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        refreshAll();
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
                <TouchableOpacity style={styles.profileButton}>
                    <Icon name="person" size={24} color={colors.text} />
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
                            onPress={() => navigation.navigate('TransactionDetail', { id: transaction.id })}
                        >
                            <View style={[styles.transactionIcon, { backgroundColor: (category?.color || colors.textMuted) + '20' }]}>
                                <Icon name={category?.icon || 'receipt'} size={20} color={category?.color || colors.textMuted} />
                            </View>
                            <View style={styles.transactionInfo}>
                                <Text style={styles.transactionMerchant}>{transaction.merchant}</Text>
                                <Text style={styles.transactionDate}>{transaction.date}</Text>
                            </View>
                            <Text style={[
                                styles.transactionAmount,
                                { color: transaction.type === 'debit' ? colors.debit : colors.credit }
                            ]}>
                                {transaction.type === 'debit' ? '-' : '+'}{formatCurrency(transaction.amount)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                {transactions.length === 0 && (
                    <Text style={styles.emptyText}>No transactions yet</Text>
                )}
            </View>

            <View style={{ height: 100 }} />
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
        padding: 24,
        paddingTop: 48,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    monthText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginHorizontal: 16,
    },
    totalCard: {
        marginHorizontal: 24,
        borderRadius: 20,
        overflow: 'hidden',
    },
    totalCardGradient: {
        backgroundColor: colors.primary,
        padding: 24,
    },
    totalLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    totalAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: colors.text,
        marginTop: 8,
    },
    totalStats: {
        flexDirection: 'row',
        marginTop: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 24,
    },
    statText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginLeft: 4,
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    seeAllText: {
        fontSize: 14,
        color: colors.primary,
    },
    categoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryInfo: {
        flex: 1,
        marginLeft: 12,
    },
    categoryName: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 6,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.surfaceLight,
        borderRadius: 2,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    categoryAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginLeft: 12,
    },
    transactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    transactionIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    transactionInfo: {
        flex: 1,
        marginLeft: 12,
    },
    transactionMerchant: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    transactionDate: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: 14,
        fontWeight: '600',
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        paddingVertical: 24,
    },
});
