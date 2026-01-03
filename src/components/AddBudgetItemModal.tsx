import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Switch,
    Dimensions
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useBudget } from '../context/BudgetContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { showAlert } from '../utils/alerts';
import { X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface AddBudgetItemModalProps {
    visible: boolean;
    onClose: () => void;
}

export const AddBudgetItemModal: React.FC<AddBudgetItemModalProps> = ({ visible, onClose }) => {
    const { addBudgetItem, categories } = useBudget();
    const { portfolios } = usePortfolio();
    const { colors } = useTheme();
    const { t } = useLanguage();

    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [amount, setAmount] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [linkedPortfolioId, setLinkedPortfolioId] = useState<string | undefined>(undefined);

    const filteredCategories = useMemo(() => {
        return categories.filter(c => c.type === type);
    }, [categories, type]);

    const handleAdd = async () => {
        if (!amount || !categoryId) {
            showAlert('Hata', 'Lütfen tutar ve kategori seçin.');
            return;
        }

        const amountNum = parseFloat(amount.replace(',', '.'));
        if (isNaN(amountNum) || amountNum <= 0) {
            showAlert('Hata', 'Geçerli bir tutar girin.');
            return;
        }

        try {
            await addBudgetItem({
                type,
                amount: amountNum,
                categoryId,
                currency: 'TRY',
                date: date.getTime(),
                note,
                linkedPortfolioId
            });
            onClose();
            resetForm();
        } catch (error) {
            showAlert('Hata', 'İşlem kaydedilirken bir hata oluştu.');
        }
    };

    const resetForm = () => {
        setAmount('');
        setCategoryId('');
        setNote('');
        setDate(new Date());
        setLinkedPortfolioId(undefined);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>Yeni İşlem Ekle</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <X size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Type Toggle */}
                            <View style={styles.typeToggle}>
                                <TouchableOpacity
                                    style={[
                                        styles.typeButton,
                                        type === 'expense' && { backgroundColor: '#F87171' }
                                    ]}
                                    onPress={() => { setType('expense'); setCategoryId(''); }}
                                >
                                    <Text style={[styles.typeText, type === 'expense' && { color: '#FFF' }]}>Gider</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.typeButton,
                                        type === 'income' && { backgroundColor: '#4ADE80' }
                                    ]}
                                    onPress={() => { setType('income'); setCategoryId(''); }}
                                >
                                    <Text style={[styles.typeText, type === 'income' && { color: '#FFF' }]}>Gelir</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Amount Input */}
                            <Text style={[styles.label, { color: colors.subText }]}>Tutar</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                                placeholderTextColor={colors.subText}
                            />

                            {/* Category Grid */}
                            <Text style={[styles.label, { color: colors.subText }]}>Kategori</Text>
                            <View style={styles.categoryGrid}>
                                {filteredCategories.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.categoryItem,
                                            {
                                                backgroundColor: categoryId === cat.id ? (cat.color || colors.primary) : colors.background,
                                                borderColor: categoryId === cat.id ? (cat.color || colors.primary) : colors.border
                                            }
                                        ]}
                                        onPress={() => setCategoryId(cat.id)}
                                    >
                                        <Text style={{ fontSize: 16 }}>{cat.icon || '💰'}</Text>
                                        <Text style={[
                                            styles.categoryName,
                                            { color: categoryId === cat.id ? '#FFF' : colors.text }
                                        ]}>
                                            {cat.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Date Picker */}
                            <Text style={[styles.label, { color: colors.subText }]}>Tarih</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    value={date.toISOString().split('T')[0]}
                                    onChange={(e: any) => setDate(new Date(e.target.value))}
                                    style={{
                                        padding: 12,
                                        fontSize: 16,
                                        borderRadius: 12,
                                        border: `1px solid ${colors.border}`,
                                        backgroundColor: colors.background,
                                        color: colors.text,
                                        width: '100%',
                                        height: 48,
                                        marginBottom: 16,
                                    }}
                                />
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: 'center' }]}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={{ color: colors.text }}>{date.toLocaleDateString('tr-TR')}</Text>
                                    </TouchableOpacity>
                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={date}
                                            mode="date"
                                            onChange={(event, selectedDate) => {
                                                setShowDatePicker(false);
                                                if (selectedDate) setDate(selectedDate);
                                            }}
                                        />
                                    )}
                                </>
                            )}

                            {/* Note */}
                            <Text style={[styles.label, { color: colors.subText }]}>Not (Opsiyonel)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                value={note}
                                onChangeText={setNote}
                                placeholder="Harcama hakkında bir not..."
                                placeholderTextColor={colors.subText}
                            />

                            {/* Portfolio Link */}
                            <View style={styles.portfolioLinkContainer}>
                                <View style={styles.row}>
                                    <Text style={[styles.label, { color: colors.text, flex: 1, marginTop: 0 }]}>Portföy ile İlişkilendir</Text>
                                    <Switch
                                        value={!!linkedPortfolioId}
                                        onValueChange={(val) => setLinkedPortfolioId(val ? portfolios[0]?.id : undefined)}
                                    />
                                </View>
                                {linkedPortfolioId && (
                                    <View style={styles.portfolioPicker}>
                                        {portfolios.map(p => (
                                            <TouchableOpacity
                                                key={p.id}
                                                style={[
                                                    styles.portfolioOption,
                                                    {
                                                        backgroundColor: linkedPortfolioId === p.id ? colors.primary : colors.background,
                                                        borderColor: linkedPortfolioId === p.id ? colors.primary : colors.border
                                                    }
                                                ]}
                                                onPress={() => setLinkedPortfolioId(p.id)}
                                            >
                                                <Text style={{ fontSize: 16, marginRight: 8 }}>{p.icon}</Text>
                                                <Text style={{
                                                    color: linkedPortfolioId === p.id ? '#FFF' : colors.text,
                                                    fontWeight: '600'
                                                }}>
                                                    {p.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAdd}>
                                <Text style={styles.buttonText}>Ekle</Text>
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
        justifyContent: 'flex-end',
    },
    keyboardView: {
        width: '100%',
        maxHeight: '90%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 17,
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
        marginTop: 6,
    },
    input: {
        height: 38,
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 6,
        fontSize: 14,
        borderWidth: 1,
    },
    typeToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        padding: 2,
        marginBottom: 8,
    },
    typeButton: {
        flex: 1,
        height: 34,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#666',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -3,
        marginBottom: 4,
    },
    categoryItem: {
        width: (width - 54) / 6,
        margin: 3,
        aspectRatio: 1,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
        borderWidth: 1,
    },
    categoryName: {
        fontSize: 7,
        fontWeight: '600',
        marginTop: 1,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    portfolioLinkContainer: {
        marginTop: 4,
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.03)',
        marginBottom: 10,
    },
    portfolioPicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4,
    },
    portfolioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginRight: 6,
        marginBottom: 6,
        borderWidth: 1,
    },
    addButton: {
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
