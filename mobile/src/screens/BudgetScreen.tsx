// Budget Screen - Category budgets with progress tracking & AI Velocity Warnings

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
} from 'react-native';
import { useAppStore } from '../store';
import {
    updateCategoryBudget,
    insertCategory,
    deleteCategory,
    type Category
} from '../database';
import { colors, formatCurrency, getMonthName, calculatePercentage } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AddCategoryModal from '../components/AddCategoryModal';
import { calculateBudgetDepletionVelocity, type BudgetExhaustionPrediction } from '../services/AiFeatureTransformer';

interface BudgetScreenProps {
    navigation: any;
}

export default function BudgetScreen({ navigation }: BudgetScreenProps) {
    const {
        categories,
        categorySpending,
        monthlyTotal,
        selectedMonth,
        loadCategories,
        refreshAll,
        user
    } = useAppStore();

    // Defensive check
    const safeCategories = Array.isArray(categories) ? categories : [];
    const safeCategorySpending = Array.isArray(categorySpending) ? categorySpending : [];

    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [budgetInput, setBudgetInput] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    const [aiPredictions, setAiPredictions] = useState<BudgetExhaustionPrediction[]>([]);
    const userId = user?.id || 1;

    useEffect(() => {
        loadCategories();
        calculateBudgetDepletionVelocity(userId).then(setAiPredictions);
    }, [user, categorySpending]);

    // Combine categories with their spending
    const categoryData = safeCategories.map(category => {
        const spending = safeCategorySpending.find(cs => cs.categoryId === category.id);
        const aiPred = aiPredictions.find(p => p.categoryId === category.id);
        return {
            ...category,
            spent: spending?.total || 0,
            remaining: category.budgetLimit ? category.budgetLimit - (spending?.total || 0) : null,
            percentage: category.budgetLimit
                ? calculatePercentage(spending?.total || 0, category.budgetLimit)
                : 0,
            aiPred,
        };
    }).sort((a, b) => b.spent - a.spent);

    const totalBudget = safeCategories.reduce((sum, c) => sum + (c.budgetLimit || 0), 0);
    const totalPercentage = totalBudget > 0 ? calculatePercentage(monthlyTotal, totalBudget) : 0;

    const handleSaveBudget = async () => {
        if (!editingCategory || !user) return;

        const budget = budgetInput.trim() === '' ? null : parseFloat(budgetInput);

        if (budget !== null && (isNaN(budget) || budget < 0)) {
            Alert.alert('Error', 'Please enter a valid budget amount');
            return;
        }

        try {
            await updateCategoryBudget(editingCategory.id, user.id, budget);
            await loadCategories();
            setEditingCategory(null);
            setBudgetInput('');
            refreshAll();
            calculateBudgetDepletionVelocity(user.id).then(setAiPredictions);
        } catch (error) {
            console.error('Error updating budget:', error);
            Alert.alert('Error', 'Failed to update budget');
        }
    };

    const handleDeleteCategory = (category: Category) => {
        if (!user) return;

        Alert.alert(
            'Delete Category',
            `Are you sure you want to delete "${category.name}"? Transactions in this category will be reassigned to Uncategorized.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteCategory(category.id, user.id);
                            await loadCategories();
                            refreshAll();
                        } catch (error) {
                            console.error('Error deleting category:', error);
                            Alert.alert('Error', 'Failed to delete category');
                        }
                    },
                },
            ]
        );
    };

    const getProgressColor = (percentage: number): string => {
        if (percentage >= 100) return colors.debit;
        if (percentage >= 80) return colors.warning;
        return colors.credit;
    };

    const highRiskPredictions = aiPredictions.filter(p => p.isExhaustionRisk);

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Budget</Text>
                    <Text style={styles.subtitle}>
                        {getMonthName(selectedMonth.month)} {selectedMonth.year}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddModal(true)}
                >
                    <Icon name="add" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* AI BUDGET EXHAUSTION WARNING BANNER */}
            {highRiskPredictions.length > 0 && (
                <View style={styles.aiDepletionBanner}>
                    <View style={styles.aiDepletionHeader}>
                        <Icon name="speed" size={18} color="#ef4444" />
                        <Text style={styles.aiDepletionTitle}>AI SPEED WARNING</Text>
                    </View>
                    {highRiskPredictions.map((pred) => (
                        <Text key={pred.categoryId} style={styles.aiDepletionText}>
                            ⚠️ <Text style={{ fontWeight: 'bold', color: colors.text }}>{pred.categoryName}</Text> budget projected to exhaust on <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>{pred.projectedDepletionDate}</Text> (₹{pred.dailyVelocity}/day velocity)
                        </Text>
                    ))}
                </View>
            )}

            {/* Overview Card */}
            <View style={styles.overviewCard}>
                <View style={styles.overviewRow}>
                    <View>
                        <Text style={styles.overviewLabel}>Total Spent</Text>
                        <Text style={styles.overviewAmount}>{formatCurrency(monthlyTotal)}</Text>
                    </View>
                    <View style={styles.overviewRight}>
                        <Text style={styles.overviewLabel}>Budget</Text>
                        <Text style={styles.overviewAmount}>
                            {totalBudget > 0 ? formatCurrency(totalBudget) : 'Not Set'}
                        </Text>
                    </View>
                </View>

                {totalBudget > 0 && (
                    <View style={styles.overviewProgress}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${Math.min(totalPercentage, 100)}%`,
                                        backgroundColor: getProgressColor(totalPercentage),
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[styles.percentageText, { color: getProgressColor(totalPercentage) }]}>
                            {totalPercentage}% used
                        </Text>
                    </View>
                )}
            </View>

            {/* Category Budgets */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Category Budgets</Text>

                {categoryData.map(category => (
                    <View key={category.id} style={styles.categoryCard}>
                        <View style={styles.categoryHeader}>
                            <View style={styles.categoryTitleGroup}>
                                <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                                    <Icon name={category.icon} size={20} color={category.color} />
                                </View>
                                <View>
                                    <Text style={styles.categoryName}>{category.name}</Text>
                                    {category.budgetLimit ? (
                                        <Text style={styles.budgetText}>
                                            {formatCurrency(category.spent)} of {formatCurrency(category.budgetLimit)}
                                        </Text>
                                    ) : (
                                        <Text style={styles.noBudgetText}>No budget set</Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.actionGroup}>
                                <TouchableOpacity
                                    style={styles.editButton}
                                    onPress={() => {
                                        setEditingCategory(category);
                                        setBudgetInput(category.budgetLimit ? category.budgetLimit.toString() : '');
                                    }}
                                >
                                    <Icon name="edit" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDeleteCategory(category)}
                                >
                                    <Icon name="delete-outline" size={18} color={colors.debit} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {category.budgetLimit && (
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${Math.min(category.percentage, 100)}%`,
                                                backgroundColor: getProgressColor(category.percentage),
                                            }
                                        ]}
                                    />
                                </View>
                                <View style={styles.progressFooter}>
                                    <Text style={[styles.remainingText, { color: category.remaining && category.remaining < 0 ? colors.debit : colors.textSecondary }]}>
                                        {category.remaining !== null
                                            ? category.remaining >= 0
                                                ? `${formatCurrency(category.remaining)} left`
                                                : `${formatCurrency(Math.abs(category.remaining))} over`
                                            : ''}
                                    </Text>
                                    <Text style={[styles.percentageText, { color: getProgressColor(category.percentage) }]}>
                                        {category.percentage}%
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                ))}
            </View>

            {/* Edit Budget Modal */}
            <Modal
                visible={editingCategory !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setEditingCategory(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Set Budget for {editingCategory?.name}</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Enter amount (leave empty to remove)"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={budgetInput}
                            onChangeText={setBudgetInput}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setEditingCategory(null)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={handleSaveBudget}
                            >
                                <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Category Modal */}
            <AddCategoryModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={async (name, icon, color, budget) => {
                    if (!user) return;
                    try {
                        await insertCategory({ name, icon, color, budgetLimit: budget, userId: user.id });
                        await loadCategories();
                        refreshAll();
                    } catch (e) {
                        console.error('Failed to create category:', e);
                    }
                    setShowAddModal(false);
                }}
            />
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
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    aiDepletionBanner: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        marginHorizontal: 24,
        marginBottom: 16,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        gap: 6,
    },
    aiDepletionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    aiDepletionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#ef4444',
    },
    aiDepletionText: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 16,
    },
    overviewCard: {
        backgroundColor: colors.surface,
        marginHorizontal: 24,
        marginBottom: 24,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    overviewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    overviewRight: {
        alignItems: 'flex-end',
    },
    overviewLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    overviewAmount: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginTop: 4,
    },
    overviewProgress: {
        marginTop: 16,
    },
    progressBar: {
        height: 8,
        backgroundColor: colors.background,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    percentageText: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'right',
    },
    section: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
    },
    categoryCard: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    categoryName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    budgetText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    noBudgetText: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    editButton: {
        padding: 6,
    },
    deleteButton: {
        padding: 6,
    },
    progressContainer: {
        marginTop: 12,
    },
    progressFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    remainingText: {
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 14,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: colors.primary,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
});
