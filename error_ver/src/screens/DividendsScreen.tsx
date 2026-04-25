import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/formatting';
import { Dividend } from '../types';
import { Pencil, Trash2, Plus, DollarSign, Calendar, Target, Briefcase, TrendingUp } from 'lucide-react-native';
import { SwipeListView } from 'react-native-swipe-list-view';

export const DividendsScreen = () => {
    const { dividends, totalDividendsTry, totalDividendsUsd, addDividend, updateDividend, deleteDividend, currentUsdRate } = usePortfolio();
    const { colors, fonts } = useTheme();
    const { t } = useLanguage();
    const { width } = useWindowDimensions();
    const isMobileLayout = Platform.OS !== 'web' || width < 768;

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<Dividend | null>(null);
    const [formData, setFormData] = useState({
        instrumentId: '',
        amount: '',
        netAmount: '',
        currency: 'TRY' as 'TRY' | 'USD',
        date: new Date().toISOString().split('T')[0],
        sharesAtDate: ''
    });

    const openAddModal = () => {
        setEditingItem(null);
        setFormData({
            instrumentId: '',
            amount: '',
            netAmount: '',
            currency: 'TRY',
            date: new Date().toISOString().split('T')[0],
            sharesAtDate: ''
        });
        setModalVisible(true);
    };

    const openEditModal = (item: Dividend) => {
        setEditingItem(item);
        setFormData({
            instrumentId: item.instrumentId,
            amount: item.amount.toString(),
            netAmount: item.netAmount?.toString() || '',
            currency: item.currency,
            date: new Date(item.date).toISOString().split('T')[0],
            sharesAtDate: item.sharesAtDate?.toString() || ''
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formData.instrumentId || !formData.amount) {
            const msg = 'Lütfen sembol ve brüt tutar alanlarını doldurun.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('Hata', msg);
            return;
        }

        const dividendData = {
            instrumentId: formData.instrumentId.toUpperCase(),
            amount: parseFloat(formData.amount.replace(',', '.')),
            netAmount: formData.netAmount ? parseFloat(formData.netAmount.replace(',', '.')) : undefined,
            currency: formData.currency,
            date: new Date(formData.date).getTime(),
            sharesAtDate: formData.sharesAtDate ? parseFloat(formData.sharesAtDate.replace(',', '.')) : undefined
        };

        try {
            if (editingItem) {
                await updateDividend(editingItem.id, dividendData);
            } else {
                await addDividend(dividendData);
            }
            setModalVisible(false);
        } catch (error) {
            console.error('Error saving dividend:', error);
        }
    };

    const handleDelete = (id: string) => {
        const confirmDelete = () => deleteDividend(id);

        if (Platform.OS === 'web') {
            if (window.confirm('Bu temettü kaydını silmek istediğinize emin misiniz?')) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                'Kaydı Sil',
                'Bu temettü kaydını silmek istediğinize emin misiniz?',
                [
                    { text: 'Vazgeç', style: 'cancel' },
                    { text: 'Sil', style: 'destructive', onPress: confirmDelete }
                ]
            );
        }
    };

    const renderItem = ({ item }: { item: Dividend }) => (
        <View style={isMobileLayout ? null : styles.desktopRow}>
            <TouchableOpacity
                activeOpacity={1}
                style={[styles.itemCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, flex: isMobileLayout ? undefined : 1 }]}
                onPress={() => openEditModal(item)}
            >
                <View style={styles.itemHeader}>
                    <View style={styles.itemTitleRow}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                            <TrendingUp size={20} color={colors.primary} />
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={[styles.itemName, { color: colors.text }]}>{item.instrumentId}</Text>
                            <Text style={[styles.itemDate, { color: colors.subText }]}>
                                {new Date(item.date).toLocaleDateString('tr-TR')}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.itemAmount, { color: colors.success }]}>
                                +{formatCurrency(item.amount, item.currency)}
                            </Text>
                            {item.netAmount && (
                                <Text style={[styles.itemNetAmount, { color: colors.subText }]}>
                                    Net: {formatCurrency(item.netAmount, item.currency)}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>

            {!isMobileLayout && (
                <View style={styles.desktopActions}>
                    <TouchableOpacity
                        style={[styles.desktopActionBtn, { backgroundColor: colors.primary + '15' }]}
                        onPress={() => openEditModal(item)}
                    >
                        <Pencil size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.desktopActionBtn, { backgroundColor: colors.danger + '15' }]}
                        onPress={() => handleDelete(item.id)}
                    >
                        <Trash2 size={18} color={colors.danger} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.text }]}>Temettüler</Text>
                    <Text style={[styles.subtitle, { color: colors.subText }]}>Pasif gelir takibi</Text>
                </View>
                <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={openAddModal}
                >
                    <Plus size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: colors.subText }]}>Toplam Temettü (₺)</Text>
                    <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totalDividendsTry, 'TRY')}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.summaryLabel, { color: colors.subText }]}>Toplam Temettü ($)</Text>
                    <Text style={[styles.summaryValue, { color: colors.success }]}>${totalDividendsUsd.toFixed(2)}</Text>
                </View>
            </View>

            <SwipeListView
                data={dividends.sort((a, b) => b.date - a.date)}
                renderItem={renderItem}
                renderHiddenItem={(data, rowMap) => (
                    <View style={styles.rowBack}>
                        <TouchableOpacity
                            style={[styles.backRightBtn, { backgroundColor: colors.danger + '15', right: 0 }]}
                            onPress={() => {
                                rowMap[data.item.id].closeRow();
                                handleDelete(data.item.id);
                            }}
                        >
                            <Trash2 size={24} color={colors.danger} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.backRightBtn, { backgroundColor: colors.primary + '15', right: 70 }]}
                            onPress={() => {
                                rowMap[data.item.id].closeRow();
                                openEditModal(data.item);
                            }}
                        >
                            <Pencil size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                )}
                rightOpenValue={isMobileLayout ? -140 : 0}
                disableRightSwipe
                disableLeftSwipe={!isMobileLayout}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <DollarSign size={48} color={colors.border} />
                        <Text style={[styles.emptyText, { color: colors.subText }]}>Henüz temettü kaydı bulunmuyor.</Text>
                    </View>
                }
            />

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {editingItem ? 'Temettü Düzenle' : 'Yeni Temettü Ekle'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Plus size={24} color={colors.text} style={{ transform: [{ rotate: '45deg' }] }} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.form}>
                            <Text style={[styles.label, { color: colors.text }]}>Hisse Sembolü (Örn: THYAO)</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={formData.instrumentId}
                                onChangeText={(val) => setFormData({ ...formData, instrumentId: val })}
                                placeholder="THYAO"
                                placeholderTextColor={colors.subText}
                                autoCapitalize="characters"
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Brüt Tutar</Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                        value={formData.amount}
                                        onChangeText={(val) => setFormData({ ...formData, amount: val })}
                                        placeholder="0.00"
                                        placeholderTextColor={colors.subText}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ width: 100 }}>
                                    <Text style={[styles.label, { color: colors.text }]}>Kur</Text>
                                    <View style={styles.currencyToggle}>
                                        <TouchableOpacity
                                            style={[styles.currencyBtn, formData.currency === 'TRY' && { backgroundColor: colors.primary }]}
                                            onPress={() => setFormData({ ...formData, currency: 'TRY' })}
                                        >
                                            <Text style={[styles.currencyBtnText, formData.currency === 'TRY' && { color: '#FFF' }]}>₺</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.currencyBtn, formData.currency === 'USD' && { backgroundColor: colors.primary }]}
                                            onPress={() => setFormData({ ...formData, currency: 'USD' })}
                                        >
                                            <Text style={[styles.currencyBtnText, formData.currency === 'USD' && { color: '#FFF' }]}>$</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.label, { color: colors.text }]}>Net Tutar (Opsiyonel)</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={formData.netAmount}
                                onChangeText={(val) => setFormData({ ...formData, netAmount: val })}
                                placeholder="0.00"
                                placeholderTextColor={colors.subText}
                                keyboardType="numeric"
                            />

                            <Text style={[styles.label, { color: colors.text }]}>Ödeme Tarihi</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={formData.date}
                                onChangeText={(val) => setFormData({ ...formData, date: val })}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.subText}
                            />

                            <Text style={[styles.label, { color: colors.text }]}>Pay Adedi (Opsiyonel)</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                value={formData.sharesAtDate}
                                onChangeText={(val) => setFormData({ ...formData, sharesAtDate: val })}
                                placeholder="100"
                                placeholderTextColor={colors.subText}
                                keyboardType="numeric"
                            />

                            <TouchableOpacity
                                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                onPress={handleSave}
                            >
                                <Text style={styles.saveButtonText}>Kaydet</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
    },
    subtitle: {
        fontSize: 14,
        marginTop: 2,
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    summaryContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '800',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    itemCard: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    itemHeader: {
        flexDirection: 'row',
    },
    itemTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemName: {
        fontSize: 16,
        fontWeight: '700',
    },
    itemDate: {
        fontSize: 12,
        marginTop: 2,
    },
    itemAmount: {
        fontSize: 16,
        fontWeight: '800',
    },
    itemNetAmount: {
        fontSize: 11,
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    rowBack: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        marginHorizontal: 0,
    },
    backRightBtn: {
        alignItems: 'center',
        bottom: 0,
        justifyContent: 'center',
        position: 'absolute',
        top: 0,
        width: 70,
        borderRadius: 16,
    },
    desktopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    desktopActions: {
        flexDirection: 'row',
        gap: 8,
        height: 70,
    },
    desktopActionBtn: {
        width: 48,
        height: '100%',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: 20,
        fontWeight: '800',
    },
    form: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    row: {
        flexDirection: 'row',
    },
    currencyToggle: {
        flexDirection: 'row',
        height: 50,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 12,
        overflow: 'hidden',
    },
    currencyBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    currencyBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#666',
    },
    saveButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
        marginBottom: 40,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
});
