import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    StyleSheet,
    ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../utils';

interface AddCategoryModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (name: string, icon: string, color: string, budget: number | null) => void;
}

const ICONS = [
    'shopping-cart', 'restaurant', 'directions-car', 'flight', 'home',
    'medical-services', 'school', 'fitness-center', 'pets', 'work',
    'local-offer', 'redeem', 'sports-esports', 'theater-comedy', 'warning'
];

const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
];

export default function AddCategoryModal({ visible, onClose, onSave }: AddCategoryModalProps) {
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [budget, setBudget] = useState('');

    const handleSave = () => {
        if (!name.trim()) return;
        onSave(name, selectedIcon, selectedColor, budget ? parseFloat(budget) : null);
        resetForm();
    };

    const resetForm = () => {
        setName('');
        setSelectedIcon(ICONS[0]);
        setSelectedColor(COLORS[0]);
        setBudget('');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.title}>New Category</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Category Name"
                        placeholderTextColor={colors.textMuted}
                        value={name}
                        onChangeText={setName}
                    />

                    <Text style={styles.label}>Select Icon</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerContainer}>
                        {ICONS.map(icon => (
                            <TouchableOpacity
                                key={icon}
                                onPress={() => setSelectedIcon(icon)}
                                style={[
                                    styles.iconItem,
                                    selectedIcon === icon && { backgroundColor: selectedColor }
                                ]}
                            >
                                <Icon
                                    name={icon}
                                    size={24}
                                    color={selectedIcon === icon ? '#fff' : colors.textSecondary}
                                />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={styles.label}>Select Color</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerContainer}>
                        {COLORS.map(color => (
                            <TouchableOpacity
                                key={color}
                                onPress={() => setSelectedColor(color)}
                                style={[
                                    styles.colorItem,
                                    { backgroundColor: color },
                                    selectedColor === color && styles.selectedColor
                                ]}
                            />
                        ))}
                    </ScrollView>

                    <Text style={styles.label}>Monthly Budget (Optional)</Text>
                    <View style={styles.budgetContainer}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                            style={styles.budgetInput}
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            value={budget}
                            onChangeText={setBudget}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveButton, !name.trim() && styles.disabledButton]}
                            onPress={handleSave}
                            disabled={!name.trim()}
                        >
                            <Text style={styles.saveText}>Create Category</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '80%',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 24,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 16,
        color: colors.text,
        fontSize: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 12,
    },
    pickerContainer: {
        flexDirection: 'row',
        marginBottom: 24,
        maxHeight: 60,
    },
    iconItem: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    colorItem: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    selectedColor: {
        borderWidth: 3,
        borderColor: colors.text,
    },
    budgetContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: colors.border,
    },
    currencySymbol: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
        marginRight: 8,
    },
    budgetInput: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 18,
        color: colors.text,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    cancelButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: colors.background,
        alignItems: 'center',
    },
    saveButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.5,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    saveText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
});
