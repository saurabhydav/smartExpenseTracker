// Transaction Detail Screen
// View details and edit category/merchant

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Switch,
} from 'react-native';
import { useAppStore } from '../store';
import { updateTransaction, getCategoryById, deleteTransaction } from '../database';
import { saveMerchantName, updateAllTransactionsForMerchant } from '../services/SmartSmsProcessor';
import { parseExpense } from '../services/ExpenseParser';
import { classifier } from '../services/SmartClassifier';
import { colors, formatCurrency, formatDate } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TransactionDetailScreenProps {
    navigation: any;
    route: any;
}

export default function TransactionDetailScreen({ navigation, route }: TransactionDetailScreenProps) {
    const { id } = route.params;
    const { categories, user, refreshAll, transactions } = useAppStore();
    const safeCategories = Array.isArray(categories) ? categories : [];

    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [showCategories, setShowCategories] = useState(false);
    const [autoCategorizeFuture, setAutoCategorizeFuture] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadTransaction();
    }, [id, transactions]);

    const loadTransaction = () => {
        // Find in store first for speed
        const found = transactions.find(t => t.id === id);
        if (found) {
            setTransaction(found);
            setSelectedCategory(found.categoryId);
        } else {
            // Fallback to DB if not in current store list (rare)
            // For now just error or handle gracefully
            Alert.alert('Error', 'Transaction not found');
            navigation.goBack();
        }
    };

    const handleSave = async () => {
        if (!transaction || !user) return;

        setIsSaving(true);
        try {
            // 1. Update the transaction's category
            await updateTransaction(transaction.id, user.id, { categoryId: selectedCategory });

            // 2. If it's an SMS transaction and user wants to learn
            if (transaction.rawSms && autoCategorizeFuture) {
                // We need the raw merchant name to map it
                // We re-parse the SMS to get the original raw merchant
                const parsed = await parseExpense(transaction.rawSms);

                if (parsed && parsed.merchant) {
                    // Save mapping: Raw Name -> Display Name + Category
                    await saveMerchantName(
                        parsed.merchant,
                        transaction.merchant, // Use current display name
                        selectedCategory,
                        user.id
                    );
                    Alert.alert('Updated', `Category updated. Future transactions from "${transaction.merchant}" will be auto-categorized.`);
                } else {
                    // Fallback if re-parsing fails (unlikely)
                    console.warn('Could not re-parse SMS to get raw merchant name');
                }
            } else {
                Alert.alert('Success', 'Transaction category updated');
            }

            refreshAll();
            navigation.goBack();
        } catch (error) {
            console.error('Failed to update transaction:', error);
            Alert.alert('Error', 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    if (!transaction) return <View style={styles.container} />;

    const category = safeCategories.find(c => c.id === selectedCategory);
    const currentCategory = safeCategories.find(c => c.id === transaction.categoryId);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.scrollView}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Icon name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Transaction Details</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Amount Card */}
                <View style={styles.amountCard}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <Text style={[
                        styles.amount,
                        { color: transaction.type === 'debit' ? colors.debit : colors.credit }
                    ]}>
                        {transaction.type === 'debit' ? '-' : '+'}{formatCurrency(transaction.amount)}
                    </Text>
                    <Text style={styles.date}>{formatDate(transaction.date)}</Text>
                    {transaction.accountId && (
                        <View style={styles.badgeContainer}>
                            <Icon name="account-balance" size={12} color={colors.textSecondary} />
                            <Text style={styles.badgeText}>Bank Account Linked</Text>
                        </View>
                    )}
                </View>

                {/* Merchant Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Merchant</Text>
                    <View style={styles.row}>
                        <Icon name="store" size={24} color={colors.textSecondary} />
                        <Text style={styles.rowValue}>{transaction.merchant}</Text>
                    </View>
                </View>

                {/* Category Section with Edit */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Category</Text>

                    <TouchableOpacity
                        style={styles.categorySelector}
                        onPress={() => setShowCategories(!showCategories)}
                    >
                        <View style={styles.row}>
                            <View style={[styles.iconBox, { backgroundColor: (category?.color || colors.textMuted) + '20' }]}>
                                <Icon name={category?.icon || 'help-outline'} size={24} color={category?.color || colors.textMuted} />
                            </View>
                            <Text style={styles.categoryName}>{category?.name || 'Uncategorized'}</Text>
                        </View>
                        <Icon name={showCategories ? "expand-less" : "expand-more"} size={24} color={colors.textMuted} />
                    </TouchableOpacity>

                    {showCategories && (
                        <View style={styles.categoryList}>
                            {safeCategories.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.categoryOption,
                                        selectedCategory === cat.id && styles.categoryOptionSelected
                                    ]}
                                    onPress={() => {
                                        setSelectedCategory(cat.id);
                                        setShowCategories(false);
                                    }}
                                >
                                    <View style={[styles.dot, { backgroundColor: cat.color }]} />
                                    <Text style={styles.categoryOptionText}>{cat.name}</Text>
                                    {selectedCategory === cat.id && <Icon name="check" size={20} color={colors.primary} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Learning Toggle (Only for SMS transactions) */}
                {transaction.rawSms && selectedCategory !== transaction.categoryId && (
                    <View style={styles.toggleSection}>
                        <View style={styles.toggleInfo}>
                            <Text style={styles.toggleTitle}>Auto-categorize Future</Text>
                            <Text style={styles.toggleSubtitle}>
                                Automatically assign "{category?.name}" to future transactions from {transaction.merchant}
                            </Text>
                        </View>
                        <Switch
                            value={autoCategorizeFuture}
                            onValueChange={setAutoCategorizeFuture}
                            trackColor={{ false: colors.border, true: colors.primary + '80' }}
                            thumbColor={autoCategorizeFuture ? colors.primary : '#f4f3f4'}
                        />
                    </View>
                )}

                {/* SMS Data (Debug/Info) */}
                {transaction.rawSms && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Original SMS</Text>
                        <Text style={styles.smsText}>{transaction.rawSms}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.saveButton, { opacity: isSaving ? 0.7 : 1 }]}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    <Text style={styles.saveButtonText}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                        Alert.alert(
                            'Delete Transaction',
                            'Are you sure you want to delete this transaction? This cannot be undone.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                        if (!user) return;
                                        setIsSaving(true);
                                        try {
                                            const { deleteTransaction } = require('../database');
                                            await deleteTransaction(transaction.id, user.id);
                                            refreshAll();
                                            navigation.goBack();
                                        } catch (error) {
                                            console.error('Failed to delete transaction', error);
                                            Alert.alert('Error', 'Failed to delete transaction');
                                            setIsSaving(false);
                                        }
                                    }
                                }
                            ]
                        );
                    }}
                >
                    <Icon name="delete" size={20} color={colors.debit} style={{ marginRight: 8 }} />
                    <Text style={styles.deleteButtonText}>Delete Transaction</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        paddingTop: 48,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    amountCard: {
        alignItems: 'center',
        paddingVertical: 32,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 24,
    },
    amountLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    amount: {
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    date: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    badgeText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginLeft: 6,
    },
    section: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowValue: {
        fontSize: 18,
        color: colors.text,
        marginLeft: 16,
        flex: 1,
    },
    categorySelector: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    categoryName: {
        fontSize: 18,
        color: colors.text,
    },
    categoryList: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    categoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    categoryOptionSelected: {
        backgroundColor: colors.surfaceLight,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    categoryOptionText: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
    },
    toggleSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        marginHorizontal: 24,
        marginBottom: 24,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    toggleInfo: {
        flex: 1,
        marginRight: 16,
    },
    toggleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    toggleSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    smsText: {
        fontSize: 14,
        color: colors.textMuted,
        fontStyle: 'italic',
        lineHeight: 20,
    },
    saveButton: {
        backgroundColor: colors.primary,
        marginHorizontal: 24,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
    },
    saveButtonText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 24,
        padding: 16,
        borderRadius: 12,
        backgroundColor: colors.background, // Transparent-ish or surface
        borderWidth: 1,
        borderColor: colors.debit,
        marginBottom: 32,
    },
    deleteButtonText: {
        color: colors.debit,
        fontSize: 16,
        fontWeight: '600',
    },
});
