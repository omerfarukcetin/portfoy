import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { PortfolioItem } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { SwipeListView } from 'react-native-swipe-list-view';

export const TransactionsScreen = () => {
    const { realizedTrades, portfolio, updateAsset, deleteAsset } = usePortfolio();
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editCost, setEditCost] = useState('');

    const openEditModal = (item: PortfolioItem) => {
        setEditingItem(item);
        setEditAmount(item.amount.toString());
        setEditCost(item.averageCost.toString());
        setEditModalVisible(true);
    };

    const saveEdit = async () => {
        if (editingItem && editAmount && editCost) {
            const amount = parseFloat(editAmount.replace(',', '.'));
            const cost = parseFloat(editCost.replace(',', '.'));

            if (isNaN(amount) || isNaN(cost)) {
                Alert.alert("Hata", "Geçersiz değerler.");
                return;
            }

            await updateAsset(editingItem.id, amount, cost);
            setEditModalVisible(false);
            setEditingItem(null);
        }
    };

    const handleDelete = (item: PortfolioItem) => {
        Alert.alert(
            "Varlığı Sil",
            `${item.instrumentId} silinecek. Emin misiniz?`,
            [
                { text: "İptal", style: "cancel" },
                { text: "Sil", style: "destructive", onPress: () => deleteAsset(item.id) }
            ]
        );
    };

    const renderItem = (data: { item: PortfolioItem }) => {
        const item = data.item;
        return (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={styles.row}>
                    <Text style={[styles.symbol, { color: colors.text }]}>{item.instrumentId}</Text>
                    <Text style={[styles.value, { color: colors.text }]}>
                        {item.amount} Adet
                    </Text>
                </View>
                <View style={[styles.row, { marginTop: 5 }]}>
                    <Text style={[styles.details, { color: colors.subText }]}>
                        Maliyet: {formatCurrency(item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                    </Text>
                    <Text style={[styles.details, { color: colors.subText }]}>
                        Toplam: {formatCurrency(item.amount * item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                    </Text>
                </View>
            </View>
        );
    };

    const renderHiddenItem = (data: { item: PortfolioItem }, rowMap: any) => (
        <View style={styles.rowBack}>
            <TouchableOpacity
                style={[styles.backRightBtn, styles.backRightBtnLeft, { backgroundColor: colors.primary }]}
                onPress={() => {
                    rowMap[data.item.id].closeRow();
                    openEditModal(data.item);
                }}
            >
                <Ionicons name="create-outline" size={24} color="#fff" />
                <Text style={styles.backTextWhite}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.backRightBtn, styles.backRightBtnRight, { backgroundColor: colors.danger }]}
                onPress={() => {
                    rowMap[data.item.id].closeRow();
                    handleDelete(data.item);
                }}
            >
                <Ionicons name="trash-outline" size={24} color="#fff" />
                <Text style={styles.backTextWhite}>Sil</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>İşlemler</Text>
            </View>

            {/* Tab Control */}
            <View style={[styles.tabContainer, { backgroundColor: colors.cardBackground }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'open' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                    onPress={() => setActiveTab('open')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'open' ? colors.primary : colors.subText }]}>Açık İşlemler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'closed' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                    onPress={() => setActiveTab('closed')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'closed' ? colors.primary : colors.subText }]}>Kapalı İşlemler</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'open' ? (
                // OPEN POSITIONS (Current Portfolio) with SwipeListView
                portfolio.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ textAlign: 'center', color: colors.subText }}>Açık işlem yok.</Text>
                    </View>
                ) : (
                    <SwipeListView
                        data={portfolio}
                        renderItem={renderItem}
                        renderHiddenItem={renderHiddenItem}
                        keyExtractor={(item) => item.id}
                        rightOpenValue={-150}
                        disableRightSwipe
                        contentContainerStyle={styles.scrollContent}
                    />
                )
            ) : (
                // CLOSED POSITIONS (History)
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {realizedTrades.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: colors.subText, marginTop: 20 }}>Henüz işlem yok.</Text>
                    ) : (
                        realizedTrades.slice().reverse().map(trade => (
                            <View key={trade.id} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <View style={styles.row}>
                                    <Text style={[styles.symbol, { color: colors.text }]}>{trade.instrumentId} (SATIŞ)</Text>
                                    <Text style={[styles.value, { color: trade.profitTry >= 0 ? colors.success : colors.danger }]}>
                                        {trade.profitTry >= 0 ? '+' : ''}{formatCurrency(trade.profitTry, 'TRY')}
                                    </Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={[styles.details, { color: colors.subText }]}>
                                        {trade.amount} @ {formatCurrency(trade.sellPrice, trade.currency)}
                                    </Text>
                                    <Text style={[styles.details, { color: colors.subText }]}>
                                        {new Date(trade.date).toLocaleDateString()}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Edit Modal */}
            <Modal
                visible={editModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Varlığı Düzenle</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.subText }]}>{editingItem?.instrumentId}</Text>

                        <Text style={[styles.label, { color: colors.text }]}>Miktar</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editAmount}
                            onChangeText={setEditAmount}
                            keyboardType="numeric"
                        />

                        <Text style={[styles.label, { color: colors.text }]}>Ortalama Maliyet</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editCost}
                            onChangeText={setEditCost}
                            keyboardType="numeric"
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setEditModalVisible(false)}>
                                <Text style={styles.buttonText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]} onPress={saveEdit}>
                                <Text style={[styles.buttonText, { color: '#fff' }]}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
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
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
    },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    tab: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    scrollContent: {
        paddingBottom: 100,
        paddingTop: 20,
        paddingHorizontal: 15,
    },
    card: {
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    symbol: {
        fontSize: 15,
        fontWeight: '700',
    },
    value: {
        fontSize: 15,
        fontWeight: '700',
    },
    details: {
        fontSize: 12,
        fontWeight: '500',
    },
    rowBack: {
        alignItems: 'center',
        backgroundColor: '#DDD',
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingRight: 15,
        marginBottom: 8,
        borderRadius: 12,
    },
    backRightBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 75,
        height: '100%',
    },
    backRightBtnLeft: {
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
    },
    backRightBtnRight: {
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
    },
    backTextWhite: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        width: '80%',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 5,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        marginBottom: 5,
        fontWeight: '600',
    },
    input: {
        height: 40,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        marginBottom: 15,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#ccc',
    },
    saveButton: {
        // backgroundColor set dynamically
    },
    buttonText: {
        fontWeight: '600',
    },
});
