// Budget Screen - Category budgets with progress tracking

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
    deleteCategory, // Imported
    type Category
} from '../database';
import { colors, formatCurrency, getMonthName, calculatePercentage } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AddCategoryModal from '../components/AddCategoryModal';

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

    useEffect(() => {
        loadCategories();
    }, []);

    // Combine categories with their spending
    const categoryData = safeCategories.map(category => {
        const spending = safeCategorySpending.find(cs => cs.categoryId === category.id);
        return {
            ...category,
            spent: spending?.total || 0,
            remaining: category.budgetLimit ? category.budgetLimit - (spending?.total || 0) : null,
            percentage: category.budgetLimit
                ? calculatePercentage(spending?.total || 0, category.budgetLimit)
                : 0,
        };
    }).sort((a, b) => b.spent - a.spent);

    const totalBudget = safeCategories.reduce((sum, c) => sum + (c.budgetLimit || 0), 0);
    const totalPercentage = totalBudget > 0 ? calculatePercentage(monthlyTotal, totalBudget) : 0;

    const handleSaveBudget = () => {
        if (!editingCategory || !user) return;

        const budget = budgetInput.trim() === '' ? null : parseFloat(budgetInput);

        if (budget !== null && (isNaN(budget) || budget < 0)) {
            Alert.alert('Error', 'Please enter a valid budget amount');
            return;
        }

        updateCategoryBudget(editingCategory.id, user.id, budget);
        loadCategories();
        setEditingCategory(null);
        setBudgetInput('');
    };

    const handleAddCategory = async (name: string, icon: string, color: string, budget: number | null) => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to create categories');
            return;
        }
        try {
            await insertCategory({
                name,
                icon,
                color,
                budgetLimit: budget,
                userId: user.id
            });
            setShowAddModal(false);
            loadCategories();
        } catch (error) {
            console.error('Failed to add category:', error);
            const errMsg = error instanceof Error ? error.message : String(error);

            if (errMsg.includes('already exists')) {
                Alert.alert('Duplicate Category', 'This category name is already in use.');
            } else {
                Alert.alert('Error', 'Could not create category.');
            }
        }
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setBudgetInput(category.budgetLimit?.toString() || '');
    };

    const getProgressColor = (percentage: number): string => {
        if (percentage >= 100) return colors.debit;
        if (percentage >= 80) return colors.warning;
        return colors.credit;
    };

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

                {categoryData.map((category) => (
                    <TouchableOpacity
                        key={category.id}
                        style={styles.categoryCard}
                        onPress={() => openEditModal(category)}
                    >
                        <View style={styles.categoryHeader}>
                            <View style={styles.categoryInfo}>
                                <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                                    <Icon name={category.icon || 'label'} size={20} color={category.color} />
                                </View>
                                <Text style={styles.categoryName}>{category.name}</Text>
                            </View>
                            <Icon name="edit" size={18} color={colors.textMuted} />
                        </View>

                        <View style={styles.categoryStats}>
                            <Text style={styles.spentAmount}>{formatCurrency(category.spent)}</Text>
                            <Text style={styles.budgetAmount}>
                                / {category.budgetLimit ? formatCurrency(category.budgetLimit) : 'No budget'}
                            </Text>
                        </View>

                        {category.budgetLimit && (
                            <>
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
                                <View style={styles.categoryFooter}>
                                    <Text style={[
                                        styles.remainingText,
                                        { color: category.remaining! >= 0 ? colors.credit : colors.debit }
                                    ]}>
                                        {category.remaining! >= 0
                                            ? `${formatCurrency(category.remaining!)} remaining`
                                            : `${formatCurrency(Math.abs(category.remaining!))} over budget`
                                        }
                                    </Text>
                                    <Text style={[styles.percentageText, { color: getProgressColor(category.percentage) }]}>
                                        {category.percentage}%
                                    </Text>
                                </View>
                            </>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Add Category Modal */}
            <AddCategoryModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={handleAddCategory}
            />

            {/* Edit Budget Modal */}
            <Modal
                visible={editingCategory !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setEditingCategory(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Set Budget</Text>
                        <Text style={styles.modalSubtitle}>{editingCategory?.name}</Text>

                        <View style={styles.budgetInputContainer}>
                            <Text style={styles.currencySymbol}>₹</Text>
                            <TextInput
                                style={styles.budgetInput}
                                placeholder="Enter budget"
                                placeholderTextColor={colors.textMuted}
                                value={budgetInput}
                                onChangeText={setBudgetInput}
                                keyboardType="decimal-pad"
                                autoFocus
                            />
                        </View>

                        <Text style={styles.hint}>Leave empty to remove budget limit</Text>

                        <View style={styles.modalButtons}>
                            {/* Delete Button (Icon only or small text) */}
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => {
                                    Alert.alert(
                                        'Delete Category',
                                        `Are you sure you want to delete "${editingCategory?.name}"? Transactions will become Uncategorized.`,
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    if (editingCategory && user) {
                                                        try {
                                                            await deleteCategory(editingCategory.id, user.id);
                                                            setEditingCategory(null);
                                                            // Small delay to ensure DB update propagates before reload
                                                            setTimeout(() => loadCategories(), 100);
                                                        } catch (error) {
                                                            console.error('Failed to delete category:', error);
                                                            const errMsg = error instanceof Error ? error.message : String(error);
                                                            Alert.alert('Error', `Failed to delete: ${errMsg}`);
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Icon name="delete" size={24} color={colors.debit} />
                            </TouchableOpacity>

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
        padding: 24,
        paddingTop: 48,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    overviewCard: {
        backgroundColor: colors.surface,
        marginHorizontal: 24,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    overviewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    overviewRight: {
        alignItems: 'flex-end',
    },
    overviewLabel: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    overviewAmount: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        marginTop: 4,
    },
    overviewProgress: {
        marginTop: 20,
    },
    section: {
        paddingHorizontal: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 16,
    },
    categoryCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryName: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.text,
        marginLeft: 12,
    },
    categoryStats: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 10,
    },
    spentAmount: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
    },
    budgetAmount: {
        fontSize: 14,
        color: colors.textSecondary,
        marginLeft: 4,
    },
    progressBar: {
        height: 6,
        backgroundColor: colors.surfaceLight,
        borderRadius: 3,
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    categoryFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    remainingText: {
        fontSize: 12,
        fontWeight: '500',
    },
    percentageText: {
        fontSize: 12,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 24,
    },
    budgetInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    budgetInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        padding: 16,
    },
    hint: {
        fontSize: 12,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 12,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 24,
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    saveButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    deleteButton: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: colors.debit + '20', // Light red
        alignItems: 'center',
        justifyContent: 'center',
        width: 50,
    },
});
