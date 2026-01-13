
import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../utils';
import { getCategories, type Category } from '../database';
import { saveMerchantName } from '../services/SmartSmsProcessor';
import { useAppStore } from '../store';

interface AddMerchantModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: {
        id?: number;
        smsName: string;
        displayName: string;
        categoryId: number | null;
    };
}

export default function AddMerchantModal({ visible, onClose, onSave, initialData }: AddMerchantModalProps) {
    const [smsName, setSmsName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    // Get user from store for saving
    const { user } = useAppStore();

    useEffect(() => {
        if (visible) {
            loadCategories();
            if (initialData) {
                setSmsName(initialData.smsName);
                setDisplayName(initialData.displayName);
                setSelectedCategory(initialData.categoryId);
            } else {
                setSmsName('');
                setDisplayName('');
                setSelectedCategory(null);
            }
        }
    }, [visible, initialData]);

    const loadCategories = async () => {
        try {
            const userId = user?.id;
            const cats = await getCategories(userId);
            setCategories(cats);
        } catch (error) {
            console.error('Failed to load categories', error);
        }
    };

    const handleSave = async () => {
        if (!smsName.trim() || !displayName.trim()) {
            return;
        }

        if (!user) return;

        // Use the service to save/update
        // Note: saveMerchantName handles both insert and update (upsert based on sms_name)
        // Ideally we should have an explicit update by ID if renaming SMS Name, but for now app assumes SMS Name is key
        await saveMerchantName(smsName.trim(), displayName.trim(), selectedCategory, user.id);

        onSave();
        onClose();
    };

    const renderCategoryItem = ({ item }: { item: Category }) => (
        <TouchableOpacity
            key={item.id}
            style={[
                styles.categoryItem,
                selectedCategory === item.id && styles.selectedCategory,
                { borderColor: item.color }
            ]}
            onPress={() => setSelectedCategory(item.id)}
        >
            <View style={[styles.categoryIcon, { backgroundColor: item.color + '20' }]}>
                <Icon name={item.icon} size={24} color={item.color} />
            </View>
            <Text style={[
                styles.categoryName,
                selectedCategory === item.id && styles.selectedCategoryText
            ]}>
                {item.name}
            </Text>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {initialData ? 'Edit Merchant Rule' : 'Add Merchant Rule'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Icon name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>SMS Contains (Trigger)</Text>
                            <TextInput
                                style={styles.input}
                                value={smsName}
                                onChangeText={setSmsName}
                                placeholder="e.g. UBER or ZOMATO"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="characters"
                                editable={!initialData} // Lock trigger for edits to standard simplicity
                            />
                            <Text style={styles.helperText}>
                                When an SMS contains this name...
                            </Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Save As (Display Name)</Text>
                            <TextInput
                                style={styles.input}
                                value={displayName}
                                onChangeText={setDisplayName}
                                placeholder="e.g. Uber Rides"
                                placeholderTextColor={colors.textMuted}
                            />
                            <Text style={styles.helperText}>
                                ...it will appear in your expenses like this.
                            </Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Category</Text>
                            <View style={styles.categoriesGrid}>
                                {categories.map(cat => renderCategoryItem({ item: cat }))}
                            </View>
                        </View>
                    </ScrollView>

                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            (!smsName.trim() || !displayName.trim()) && styles.disabledButton
                        ]}
                        onPress={handleSave}
                        disabled={!smsName.trim() || !displayName.trim()}
                    >
                        <Text style={styles.saveButtonText}>Save Rule</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    form: {
        flex: 1,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
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
    helperText: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 6,
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    categoryItem: {
        width: '30%',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        marginBottom: 8,
    },
    selectedCategory: {
        backgroundColor: colors.primary + '10',
        borderColor: colors.primary,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    categoryName: {
        fontSize: 12,
        color: colors.text,
        textAlign: 'center',
    },
    selectedCategoryText: {
        color: colors.primary,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    disabledButton: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
