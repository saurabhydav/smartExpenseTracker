// Transactions Screen - Full transaction list with filters

import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import { useAppStore } from '../store';
import { colors, formatCurrency, formatDate } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import type { Transaction } from '../database';

interface TransactionsScreenProps {
    navigation: any;
}

export default function TransactionsScreen({ navigation }: TransactionsScreenProps) {
    const { transactions, categories } = useAppStore();
    // Defensive check
    const safeCategories = Array.isArray(categories) ? categories : [];

    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit'>('all');

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.merchant.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        return matchesSearch && matchesType;
    });

    const renderTransaction = ({ item }: { item: Transaction }) => {
        const category = safeCategories.find(c => c.id === item.categoryId);

        return (
            <TouchableOpacity
                style={styles.transactionRow}
                onPress={() => navigation.navigate('TransactionDetail', { id: item.id })}
            >
                <View style={[styles.transactionIcon, { backgroundColor: (category?.color || colors.textMuted) + '20' }]}>
                    <Icon name={category?.icon || 'receipt'} size={20} color={category?.color || colors.textMuted} />
                </View>
                <View style={styles.transactionInfo}>
                    <Text style={styles.transactionMerchant}>{item.merchant}</Text>
                    <Text style={styles.transactionCategory}>
                        {category?.name || 'Uncategorized'} • {formatDate(item.date)}
                    </Text>
                </View>
                <Text style={[
                    styles.transactionAmount,
                    { color: item.type === 'debit' ? colors.debit : colors.credit }
                ]}>
                    {item.type === 'debit' ? '-' : '+'}{formatCurrency(item.amount)}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Transactions</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('AddTransaction')}
                >
                    <Icon name="add" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Icon name="search" size={20} color={colors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search transactions..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Icon name="close" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
                {(['all', 'debit', 'credit'] as const).map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[styles.filterTab, filterType === type && styles.filterTabActive]}
                        onPress={() => setFilterType(type)}
                    >
                        <Text style={[styles.filterTabText, filterType === type && styles.filterTabTextActive]}>
                            {type === 'all' ? 'All' : type === 'debit' ? 'Expenses' : 'Income'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Transaction List */}
            <FlatList
                data={filteredTransactions}
                renderItem={renderTransaction}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="receipt-long" size={64} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No transactions found</Text>
                    </View>
                }
            />
        </View>
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
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: 24,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 16,
        color: colors.text,
        marginLeft: 12,
    },
    filterTabs: {
        flexDirection: 'row',
        marginHorizontal: 24,
        marginBottom: 16,
    },
    filterTab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginRight: 8,
        backgroundColor: colors.surface,
    },
    filterTabActive: {
        backgroundColor: colors.primary,
    },
    filterTabText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    filterTabTextActive: {
        color: colors.text,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 100,
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
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    transactionInfo: {
        flex: 1,
        marginLeft: 12,
    },
    transactionMerchant: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
    transactionCategory: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 4,
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textMuted,
        marginTop: 16,
    },
});
