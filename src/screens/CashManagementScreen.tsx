import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { Feather } from '@expo/vector-icons';
import { CashItem } from '../types';

export const CashManagementScreen = () => {
    const { cashItems, cashBalance, addCashItem, updateCashItem, deleteCashItem } = usePortfolio();
    const { colors } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<CashItem | null>(null);
    const [formData, setFormData] = useState({
        type: 'cash' as 'cash' | 'money_market_fund' | 'deposit',
        name: '',
        amount: '',
        interestRate: '',
        currency: 'TRY' as 'TRY' | 'USD'
    });

    const openAddModal = () => {
        setEditingItem(null);
        setFormData({
            type: 'cash',
            name: '',
            amount: '',
            interestRate: '',
            currency: 'TRY'
        });
        setModalVisible(true);
    };

    const openEditModal = (item: CashItem) => {
        setEditingItem(item);
        setFormData({
            type: item.type,
            name: item.name,
            amount: item.amount.toString(),
            interestRate: item.interestRate?.toString() || '',
            currency: item.currency
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Hata', 'Geçerli bir miktar girin');
            return;
        }

        if (!formData.name.trim()) {
            Alert.alert('Hata', 'İsim boş olamaz');
            return;
        }

        if (editingItem) {
            // Update existing
            await updateCashItem(editingItem.id, amount);
        } else {
            // Add new
            const newItem: Omit<CashItem, 'id'> = {
                type: formData.type,
                name: formData.name,
                amount: amount,
                currency: formData.currency,
                interestRate: formData.interestRate ? parseFloat(formData.interestRate) : undefined
            };
            await addCashItem(newItem);
        }

        setModalVisible(false);
    };

    const handleDelete = (item: CashItem) => {
        Alert.alert(
            'Sil',
            `${item.name} silinecek. Emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: () => deleteCashItem(item.id)
                }
            ]
        );
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'cash': return 'Nakit';
            case 'money_market_fund': return 'Para Piyasası Fonu';
            case 'deposit': return 'Mevduat';
            default: return type;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'cash': return 'dollar-sign';
            case 'money_market_fund': return 'trending-up';
            case 'deposit': return 'percent';
            default: return 'dollar-sign';
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Yedek Akçe</Text>
                <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
                    <Feather name="plus" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Total Balance */}
            <View style={[styles.totalCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.totalLabel, { color: colors.subText }]}>Toplam Bakiye</Text>
                <Text style={[styles.totalAmount, { color: colors.text }]}>{formatCurrency(cashBalance, 'TRY')}</Text>
            </View>

            {/* Cash Items List */}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {cashItems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Feather name="inbox" size={64} color={colors.subText} />
                        <Text style={[styles.emptyText, { color: colors.subText }]}>
                            Henüz yedek akçe eklemediniz
                        </Text>
                        <TouchableOpacity
                            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                            onPress={openAddModal}
                        >
                            <Text style={styles.emptyButtonText}>İlk Kaydı Ekle</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    cashItems.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.itemCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                            onPress={() => openEditModal(item)}
                        >
                            <View style={styles.itemHeader}>
                                <View style={styles.itemTitleRow}>
                                    <Feather name={getTypeIcon(item.type) as any} size={20} color={colors.primary} />
                                    <View style={{ marginLeft: 12, flex: 1 }}>
                                        <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                                        <Text style={[styles.itemType, { color: colors.subText }]}>
                                            {getTypeLabel(item.type)}
                                            {item.interestRate && ` • %${item.interestRate} faiz`}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
                                    <Feather name="trash-2" size={18} color={colors.danger} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.itemFooter}>
                                <Text style={[styles.itemAmount, { color: colors.text }]}>
                                    {formatCurrency(item.amount, item.currency)}
                                </Text>
                                <Text style={[styles.itemCurrency, { color: colors.subText }]}>
                                    {item.currency}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {editingItem ? 'Düzenle' : 'Yeni Ekle'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={24} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            {/* Type Selection */}
                            {!editingItem && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>Tür</Text>
                                    <View style={styles.typeButtons}>
                                        {[
                                            { value: 'cash', label: 'Nakit' },
                                            { value: 'money_market_fund', label: 'Para Piyasası' },
                                            { value: 'deposit', label: 'Mevduat' }
                                        ].map(type => (
                                            <TouchableOpacity
                                                key={type.value}
                                                style={[
                                                    styles.typeButton,
                                                    { borderColor: colors.border },
                                                    formData.type === type.value && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                ]}
                                                onPress={() => setFormData({ ...formData, type: type.value as any })}
                                            >
                                                <Text style={[
                                                    styles.typeButtonText,
                                                    { color: formData.type === type.value ? '#fff' : colors.text }
                                                ]}>
                                                    {type.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Name */}
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>İsim</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                    placeholder="Örn: Vakıfbank Mevduat"
                                    placeholderTextColor={colors.subText}
                                    editable={!editingItem}
                                />
                            </View>

                            {/* Amount */}
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.text }]}>Miktar</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                    value={formData.amount}
                                    onChangeText={(text) => setFormData({ ...formData, amount: text })}
                                    placeholder="0.00"
                                    placeholderTextColor={colors.subText}
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* Currency */}
                            {!editingItem && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>Para Birimi</Text>
                                    <View style={styles.currencyButtons}>
                                        {['TRY', 'USD'].map(curr => (
                                            <TouchableOpacity
                                                key={curr}
                                                style={[
                                                    styles.currencyButton,
                                                    { borderColor: colors.border },
                                                    formData.currency === curr && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                ]}
                                                onPress={() => setFormData({ ...formData, currency: curr as any })}
                                            >
                                                <Text style={[
                                                    styles.currencyButtonText,
                                                    { color: formData.currency === curr ? '#fff' : colors.text }
                                                ]}>
                                                    {curr === 'TRY' ? '₺' : '$'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Interest Rate (for deposits) */}
                            {formData.type === 'deposit' && !editingItem && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>Faiz Oranı (Yıllık %)</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={formData.interestRate}
                                        onChangeText={(text) => setFormData({ ...formData, interestRate: text })}
                                        placeholder="Örn: 45.5"
                                        placeholderTextColor={colors.subText}
                                        keyboardType="numeric"
                                    />
                                </View>
                            )}
                        </ScrollView>

                        {/* Buttons */}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: colors.border }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.text }]}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                                onPress={handleSave}
                            >
                                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalCard: {
        margin: 20,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 15,
        marginBottom: 8,
    },
    totalAmount: {
        fontSize: 36,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 20,
        paddingTop: 0,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        marginTop: 20,
        marginBottom: 30,
    },
    emptyButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    itemCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    itemTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    itemName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    itemType: {
        fontSize: 14,
    },
    deleteButton: {
        padding: 4,
    },
    itemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    itemAmount: {
        fontSize: 24,
        fontWeight: '700',
    },
    itemCurrency: {
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
    },
    typeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    typeButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    currencyButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    currencyButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    currencyButtonText: {
        fontSize: 20,
        fontWeight: '700',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    modalButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 18,
        fontWeight: '600',
    },
});
