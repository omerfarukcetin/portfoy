import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { useBudget } from '../context/BudgetContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { X } from 'lucide-react-native';
import { showAlert } from '../utils/alerts';

interface AddCategoryModalProps {
    visible: boolean;
    onClose: () => void;
    type: 'income' | 'expense';
}

const ICONS = ['💰', '🛒', '🏠', '🚗', '🏥', '🎉', '📈', '☕', '🎁', '📺', '📚', '💼', '🍔', '✈️', '🏋️', '⚡'];
const COLORS = ['#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE', '#60A5FA', '#818CF8', '#A78BFA', '#F472B6', '#94A3B8'];

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ visible, onClose, type }) => {
    const { addCategory } = useBudget();
    const { colors } = useTheme();
    const { t } = useLanguage();

    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);

    const handleAdd = async () => {
        if (!name) {
            showAlert('Hata', 'Lütfen bir kategori adı girin.');
            return;
        }

        try {
            await addCategory({
                type,
                name,
                icon: selectedIcon,
                color: selectedColor
            });
            onClose();
            setName('');
        } catch (error) {
            showAlert('Hata', 'Kategori eklenirken bir hata oluştu.');
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>
                                {type === 'income' ? 'Yeni Gelir Kategorisi' : 'Yeni Gider Kategorisi'}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <X size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={[styles.label, { color: colors.subText }]}>Kategori Adı</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                value={name}
                                onChangeText={setName}
                                placeholder="Örn: Market"
                                placeholderTextColor={colors.subText}
                                onSubmitEditing={handleAdd}
                                blurOnSubmit={false}
                            />

                            <Text style={[styles.label, { color: colors.subText }]}>İkon Seç</Text>
                            <View style={styles.grid}>
                                {ICONS.map(icon => (
                                    <TouchableOpacity
                                        key={icon}
                                        style={[
                                            styles.gridItem,
                                            { backgroundColor: selectedIcon === icon ? colors.primary + '20' : colors.background }
                                        ]}
                                        onPress={() => setSelectedIcon(icon)}
                                    >
                                        <Text style={{ fontSize: 20 }}>{icon}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: colors.subText }]}>Renk Seç</Text>
                            <View style={styles.grid}>
                                {COLORS.map(color => (
                                    <TouchableOpacity
                                        key={color}
                                        style={[
                                            styles.colorItem,
                                            { backgroundColor: color, borderWidth: selectedColor === color ? 3 : 0, borderColor: colors.text }
                                        ]}
                                        onPress={() => setSelectedColor(color)}
                                    />
                                ))}
                            </View>

                            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAdd}>
                                <Text style={styles.buttonText}>Kategori Ekle</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    keyboardView: {
        width: '100%',
        maxWidth: 400,
    },
    container: {
        borderRadius: 12,
        padding: 10,
        maxHeight: '90%',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 2,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4,
        marginLeft: 2,
        marginTop: 4,
    },
    input: {
        height: 34,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
        fontSize: 13,
        borderWidth: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -2,
    },
    gridItem: {
        width: '10.5%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
        margin: '1%',
    },
    colorItem: {
        width: '8.5%',
        aspectRatio: 1,
        borderRadius: 4,
        margin: '1%',
    },
    addButton: {
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
