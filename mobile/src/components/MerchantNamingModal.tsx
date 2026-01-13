// Merchant Naming Modal Component
// Prompts user to name new merchants like saving phone contacts

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    DeviceEventEmitter,
} from 'react-native';
import { getCategories, type Category } from '../database';
import { saveMerchantName, updateTransactionMerchant, type UnknownMerchant } from '../services/SmartSmsProcessor';
import { colors, formatCurrency } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface MerchantNamingModalProps {
    visible: boolean;
    merchant: UnknownMerchant | null;
    onComplete: () => void;
    onSkip: () => void;
}

export default function MerchantNamingModal({
    visible,
    merchant,
    onComplete,
    onSkip,
}: MerchantNamingModalProps) {
    const [name, setName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [showCategories, setShowCategories] = useState(false);

    const categories = getCategories();
    // Defensive check
    const safeCategories = Array.isArray(categories) ? categories : [];

    useEffect(() => {
        if (merchant) {
            setName(merchant.suggestedName);
            setSelectedCategory(merchant.categoryId);
        }
    }, [merchant]);

    const handleSave = async () => {
        if (!merchant) return;

        const displayName = name.trim() || merchant.suggestedName;

        // We need userId here. Ideally passed via props or from store.
        // Assuming MerchantNamingModal has access to store or we pass it down.
        // For now, let's fetch from store
        // We can't use hook inside callback easily if not top level.
        // Let's assume we import store.
        const { user, refreshAll } = require('../store/useAppStore').useAppStore.getState();

        if (!user) {
            console.error('Cannot save merchant name: User not logged in');
            return;
        }

        // Save merchant mapping (like saving a contact)
        await saveMerchantName(merchant.rawName, displayName, selectedCategory, user.id);

        if (merchant.transactionId === -1) {
            // Batch update all pending transactions with this raw name
            const { updateAllTransactionsForMerchant } = require('../services/SmartSmsProcessor');
            await updateAllTransactionsForMerchant(merchant.rawName, displayName, selectedCategory);
        } else {
            // Update single transaction
            await updateTransactionMerchant(merchant.transactionId, displayName, selectedCategory);
        }

        // INSTANT REFRESH: Update UI state
        await refreshAll();
        DeviceEventEmitter.emit('TRANSACTION_UPDATED');

        // Reset and close
        setName('');
        setSelectedCategory(null);
        onComplete();
    };

    const handleSkip = () => {
        setName('');
        setSelectedCategory(null);
        onSkip();
    };

    const selectedCategoryData = safeCategories.find(c => c.id === selectedCategory);

    if (!merchant) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleSkip}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Icon name="storefront" size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>New Merchant Detected</Text>
                        <Text style={styles.subtitle}>
                            Save a name for "{merchant.rawName}" to recognize future transactions
                        </Text>
                    </View>

                    {/* Transaction Preview */}
                    <View style={styles.transactionPreview}>
                        <Text style={styles.amount}>{formatCurrency(merchant.amount)}</Text>
                        <Text style={styles.rawName}>From: {merchant.rawName}</Text>
                    </View>

                    {/* Name Input */}
                    <View style={styles.inputSection}>
                        <Text style={styles.label}>Save as</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter a name (e.g., Netflix, Uber)"
                            placeholderTextColor={colors.textMuted}
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />
                    </View>

                    {/* Category Selector */}
                    <View style={styles.inputSection}>
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
                            <ScrollView style={styles.categoryList} nestedScrollEnabled>
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
                                            <Icon name="check" size={18} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    {/* Info Note */}
                    <View style={styles.infoNote}>
                        <Icon name="info-outline" size={16} color={colors.primary} />
                        <Text style={styles.infoText}>
                            Like phone contacts, this name will be used for all future transactions from this merchant
                        </Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                            <Text style={styles.skipButtonText}>Skip</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Icon name="save" size={18} color={colors.text} />
                            <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    transactionPreview: {
        backgroundColor: colors.background,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
    },
    amount: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.text,
    },
    rawName: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 4,
    },
    inputSection: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    categorySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background,
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
        backgroundColor: colors.background,
        borderRadius: 12,
        marginTop: 8,
        maxHeight: 160,
        borderWidth: 1,
        borderColor: colors.border,
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
    infoNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.primary + '10',
        padding: 12,
        borderRadius: 10,
        marginTop: 8,
        marginBottom: 24,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: colors.textSecondary,
        marginLeft: 8,
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    skipButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    saveButton: {
        flex: 2,
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
});
