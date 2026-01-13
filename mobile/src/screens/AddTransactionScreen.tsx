// Add Transaction Screen - Manual expense entry

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useAppStore } from '../store';
import { insertTransaction, getCategories, type Category } from '../database';
import { colors, formatCurrency } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface AddTransactionScreenProps {
    navigation: any;
}

export default function AddTransactionScreen({ navigation }: AddTransactionScreenProps) {
    const [amount, setAmount] = useState('');
    const [merchant, setMerchant] = useState('');
    const [type, setType] = useState<'debit' | 'credit'>('debit');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [showCategories, setShowCategories] = useState(false);

    const { refreshAll, user } = useAppStore();
    const categories = getCategories();
    const safeCategories = Array.isArray(categories) ? categories : [];

    const handleSave = async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to add a transaction');
            return;
        }

        const parsedAmount = parseFloat(amount);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (!merchant.trim()) {
            Alert.alert('Error', 'Please enter a merchant name');
            return;
        }

        try {
            await insertTransaction({
                amount: parsedAmount,
                type,
                merchant: merchant.trim(),
                categoryId: selectedCategory,
                accountId: null, // Manual entry doesn't have account auto-linked yet
                userId: user.id, // Pass userId
                date,
                rawSms: null,
                notes: notes.trim() || null,
            }, false); // Allow duplicates for manual entries

            await refreshAll();
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to save transaction');
            console.error('Error saving transaction:', error);
        }
    };

    const selectedCategoryData = safeCategories.find(c => c.id === selectedCategory);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Icon name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Add Transaction</Text>
                    <TouchableOpacity onPress={handleSave}>
                        <Icon name="check" size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Type Toggle */}
                <View style={styles.typeToggle}>
                    <TouchableOpacity
                        style={[styles.typeButton, type === 'debit' && styles.typeButtonActiveDebit]}
                        onPress={() => setType('debit')}
                    >
                        <Icon name="trending-down" size={20} color={type === 'debit' ? '#fff' : colors.debit} />
                        <Text style={[styles.typeButtonText, type === 'debit' && styles.typeButtonTextActive]}>
                            Expense
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeButton, type === 'credit' && styles.typeButtonActiveCredit]}
                        onPress={() => setType('credit')}
                    >
                        <Icon name="trending-up" size={20} color={type === 'credit' ? '#fff' : colors.credit} />
                        <Text style={[styles.typeButtonText, type === 'credit' && styles.typeButtonTextActive]}>
                            Income
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Amount Input */}
                <View style={styles.amountContainer}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                        style={styles.amountInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                    />
                </View>

                {/* Form Fields */}
                <View style={styles.form}>
                    <View style={[styles.inputGroup, Platform.OS === 'android' ? { elevation: 10, zIndex: 100 } : { zIndex: 100 }]}>
                        <Text style={styles.label}>Category</Text>
                        <TouchableOpacity
                            style={styles.categorySelector}
                            onPress={() => setShowCategories(!showCategories)}
                        >
                            {selectedCategoryData ? (
                                <View style={styles.selectedCategory}>
                                    <View style={[styles.categoryDot, { backgroundColor: selectedCategoryData.color }]} />
                                    <Text style={styles.categoryText}>{selectedCategoryData.name}</Text>
                                </View>
                            ) : (
                                <Text style={styles.placeholderText}>Select category</Text>
                            )}
                            <Icon name={showCategories ? 'expand-less' : 'expand-more'} size={24} color={colors.textMuted} />
                        </TouchableOpacity>

                        {showCategories && (
                            <View style={[styles.categoryList, Platform.OS === 'android' && { elevation: 10 }]}>
                                {safeCategories.map((category) => (
                                    <TouchableOpacity
                                        key={category.id}
                                        style={[
                                            styles.categoryOption,
                                            selectedCategory === category.id && styles.categoryOptionSelected,
                                        ]}
                                        onPress={() => {
                                            setSelectedCategory(category.id);
                                            setShowCategories(false);
                                        }}
                                    >
                                        <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                                        <Text style={styles.categoryOptionText}>{category.name}</Text>
                                        {selectedCategory === category.id && (
                                            <Icon name="check" size={20} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={[styles.inputGroup, Platform.OS === 'android' ? { elevation: 1, zIndex: 1 } : { zIndex: 1 }]}>
                        <Text style={styles.label}>Merchant / Description</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Swiggy, Amazon"
                            placeholderTextColor={colors.textMuted}
                            value={merchant}
                            onChangeText={setMerchant}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={colors.textMuted}
                            value={date}
                            onChangeText={setDate}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Notes (optional)</Text>
                        <TextInput
                            style={[styles.input, styles.notesInput]}
                            placeholder="Add notes..."
                            placeholderTextColor={colors.textMuted}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save Transaction</Text>
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
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 24,
        marginBottom: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    typeToggle: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
        marginBottom: 32,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
    },
    typeButtonActiveDebit: {
        backgroundColor: colors.debit,
    },
    typeButtonActiveCredit: {
        backgroundColor: colors.credit,
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginLeft: 8,
    },
    typeButtonTextActive: {
        color: '#fff',
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    currencySymbol: {
        fontSize: 36,
        fontWeight: 'bold',
        color: colors.text,
        marginRight: 8,
    },
    amountInput: {
        fontSize: 48,
        fontWeight: 'bold',
        color: colors.text,
        minWidth: 100,
        textAlign: 'center',
    },
    form: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    notesInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    categorySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    selectedCategory: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    categoryText: {
        fontSize: 16,
        color: colors.text,
    },
    placeholderText: {
        fontSize: 16,
        color: colors.textMuted,
    },
    categoryList: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginTop: 4,
        borderWidth: 1,
        borderColor: colors.border,
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        maxHeight: 200,
    },
    categoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    categoryOptionSelected: {
        backgroundColor: colors.surfaceLight,
    },
    categoryOptionText: {
        flex: 1,
        fontSize: 14,
        color: colors.text,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
});
