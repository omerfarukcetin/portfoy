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

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.label, { color: colors.subText }]}>Kategori Adı</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                value={name}
                                onChangeText={setName}
                                placeholder="Örn: Market"
                                placeholderTextColor={colors.subText}
                                autoFocus
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
                                        <Text style={{ fontSize: 24 }}>{icon}</Text>
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
        padding: 20,
    },
    keyboardView: {
        width: '100%',
    },
    container: {
        borderRadius: 24,
        padding: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
        marginTop: 10,
    },
    input: {
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 12,
        fontSize: 16,
        borderWidth: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    gridItem: {
        width: '18%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        margin: '1%',
    },
    colorItem: {
        width: '13%',
        aspectRatio: 1,
        borderRadius: 12,
        margin: '1%',
    },
    addButton: {
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
