// Merchant Contacts Screen
// View and manage saved merchants like a contact list

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
} from 'react-native';
import { getDatabase, deleteMerchantMapping, type Category } from '../database';
import { saveMerchantName, getUnnamedMerchants } from '../services/SmartSmsProcessor';
import { colors, formatCurrency } from '../utils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AddMerchantModal from '../components/AddMerchantModal';

interface MerchantContact {
    id: number;
    smsName: string;
    displayName: string;
    categoryId: number | null;
    transactionCount: number;
    totalSpent: number;
}

export default function MerchantContactsScreen({ navigation }: { navigation: any }) {
    const [merchants, setMerchants] = useState<MerchantContact[]>([]);
    const [unnamedMerchants, setUnnamedMerchants] = useState<{ rawName: string; count: number; lastAmount: number }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingMerchant, setEditingMerchant] = useState<{ id?: number; smsName: string; displayName: string; categoryId: number | null } | undefined>(undefined);

    const { user } = require('../store').useAppStore();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        await Promise.all([
            loadMerchants(),
            loadCategories()
        ]);
    };

    const loadCategories = async () => {
        try {
            const { getCategories } = require('../database');
            const cats = await getCategories(user?.id);
            setCategories(Array.isArray(cats) ? cats : []);
        } catch (error) {
            console.warn('Failed to load categories', error);
            setCategories([]);
        }
    };

    const loadMerchants = async () => {
        if (!user) return;
        const db = getDatabase();

        try {
            const [result] = await db.executeSql(`
                SELECT 
                    m.id,
                    m.sms_name,
                    m.display_name,
                    m.category_id,
                    COUNT(t.id) as transaction_count,
                    COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) as total_spent
                FROM merchant_mapping m
                LEFT JOIN transactions t ON UPPER(t.merchant) = UPPER(m.display_name) AND t.user_id = ?
                WHERE m.user_id = ?
                GROUP BY m.id
                ORDER BY transaction_count DESC
            `, [user.id, user.id]);

            const loadedMerchants: MerchantContact[] = [];
            for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                loadedMerchants.push({
                    id: row.id,
                    smsName: row.sms_name,
                    displayName: row.display_name,
                    categoryId: row.category_id,
                    transactionCount: row.transaction_count,
                    totalSpent: row.total_spent,
                });
            }
            setMerchants(loadedMerchants);

            if (user?.id) {
                const unnamed = await getUnnamedMerchants(user.id);
                setUnnamedMerchants(unnamed);
            }
        } catch (error) {
            console.error('Failed to load merchants', error);
        }
    };

    const handleAdd = () => {
        setEditingMerchant(undefined);
        setModalVisible(true);
    };

    const handleEditMerchant = (merchant: MerchantContact) => {
        setEditingMerchant({
            id: merchant.id,
            smsName: merchant.smsName,
            displayName: merchant.displayName,
            categoryId: merchant.categoryId,
        });
        setModalVisible(true);
    };

    const handleNameUnnamed = (rawName: string) => {
        setEditingMerchant({
            smsName: rawName,
            displayName: rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase(),
            categoryId: null,
        });
        setModalVisible(true);
    };

    const handleDelete = (merchant: MerchantContact) => {
        if (!user) return;
        Alert.alert(
            'Delete Rule',
            `Are you sure you want to delete the rule for "${merchant.displayName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteMerchantMapping(merchant.id, user.id);
                            loadData(); // Reload list
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete rule');
                        }
                    }
                }
            ]
        );
    };

    const getCategoryById = (id: number | null): Category | undefined => {
        return categories.find(c => c.id === id);
    };

    const renderMerchant = ({ item }: { item: MerchantContact }) => {
        const category = getCategoryById(item.categoryId);

        return (
            <TouchableOpacity
                style={styles.merchantCard}
                onPress={() => handleEditMerchant(item)}
            >
                <View style={[styles.merchantIcon, { backgroundColor: (category?.color || colors.primary) + '20' }]}>
                    <Icon name={category?.icon || 'store'} size={22} color={category?.color || colors.primary} />
                </View>
                <View style={styles.merchantInfo}>
                    <Text style={styles.merchantName}>{item.displayName}</Text>
                    <Text style={styles.merchantSms}>SMS: {item.smsName}</Text>
                </View>
                <View style={styles.merchantStats}>
                    <Text style={styles.merchantSpent}>{formatCurrency(item.totalSpent)}</Text>
                    <Text style={styles.merchantCount}>{item.transactionCount} txns</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 8 }}>
                    <Icon name="delete-outline" size={24} color={colors.error} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const renderUnnamed = ({ item }: { item: { rawName: string; count: number; lastAmount: number } }) => (
        <TouchableOpacity
            style={styles.unnamedCard}
            onPress={() => handleNameUnnamed(item.rawName)}
        >
            <View style={styles.unnamedIcon}>
                <Icon name="add-circle-outline" size={22} color={colors.warning} />
            </View>
            <View style={styles.merchantInfo}>
                <Text style={styles.merchantName}>{item.rawName}</Text>
                <Text style={styles.merchantSms}>Tap to create rule</Text>
            </View>
            <View style={styles.merchantStats}>
                <Text style={styles.merchantCount}>{item.count} txns</Text>
            </View>
        </TouchableOpacity>
    );

    const filteredMerchants = merchants.filter(m =>
        m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.smsName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Merchant Rules</Text>
                <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
                    <Icon name="add" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.searchContainer}>
                <Icon name="search" size={20} color={colors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search rules..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={unnamedMerchants.length > 0 ? [{ type: 'unnamed' }, ...filteredMerchants.map(m => ({ ...m, type: 'saved' }))] : filteredMerchants.map(m => ({ ...m, type: 'saved' }))}
                renderItem={({ item }) => {
                    if ((item as any).type === 'unnamed') {
                        return (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>
                                    <Icon name="warning" size={14} color={colors.warning} /> Needs Rules ({unnamedMerchants.length})
                                </Text>
                                {unnamedMerchants.map(m => (
                                    <View key={m.rawName}>{renderUnnamed({ item: m })}</View>
                                ))}
                            </View>
                        );
                    }
                    return renderMerchant({ item: item as MerchantContact });
                }}
                keyExtractor={(item) => (item as any).id?.toString() || 'unnamed'}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListHeaderComponent={
                    <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
                        <Text style={styles.helperText}>
                            Create rules to automatically categorize SMS transactions.
                        </Text>
                    </View>
                }
                ListEmptyComponent={
                    unnamedMerchants.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Icon name="rule" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>No rules yet.</Text>
                            <Text style={styles.emptySubText}>Tap + to add a rule for your SMS.</Text>
                        </View>
                    ) : null
                }
            />

            <AddMerchantModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={loadMerchants}
                initialData={editingMerchant}
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
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
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
    section: {
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 12,
    },
    merchantCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    unnamedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning + '15',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.warning + '30',
    },
    merchantIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unnamedIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.warning + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    merchantInfo: {
        flex: 1,
        marginLeft: 12,
    },
    merchantName: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.text,
    },
    merchantSms: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    merchantStats: {
        alignItems: 'flex-end',
    },
    merchantSpent: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    merchantCount: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 12,
    },
    emptySubText: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 4,
    },
    helperText: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
