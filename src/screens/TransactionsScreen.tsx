import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { PortfolioItem } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { SwipeListView } from 'react-native-swipe-list-view';
import { TickerIcon } from '../components/TickerIcon';
import { MarketDataService } from '../services/marketData';

export const TransactionsScreen = () => {
    const { realizedTrades, portfolio, updateAsset, deleteAsset } = usePortfolio();
    const { colors, fonts } = useTheme();
    const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editCost, setEditCost] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editHistoricalRate, setEditHistoricalRate] = useState('');
    const [isLoadingRate, setIsLoadingRate] = useState(false);

    // Fetch historical rate when date changes
    useEffect(() => {
        const fetchRate = async () => {
            if (editDate.length === 10) {
                const date = new Date(editDate).getTime();
                if (!isNaN(date)) {
                    setIsLoadingRate(true);
                    const rate = await MarketDataService.getHistoricalRate(date);
                    if (rate) {
                        setEditHistoricalRate(rate.toFixed(4));
                    }
                    setIsLoadingRate(false);
                }
            }
        };
        fetchRate();
    }, [editDate]);

    const openEditModal = (item: PortfolioItem) => {
        setEditingItem(item);
        setEditAmount(item.amount.toString());
        setEditCost(item.averageCost.toString());
        // Format date as YYYY-MM-DD
        const dateObj = new Date(item.dateAdded || Date.now());
        setEditDate(dateObj.toISOString().split('T')[0]);
        setEditHistoricalRate('');
        setEditModalVisible(true);
    };

    const saveEdit = async () => {
        if (editingItem && editAmount && editCost) {
            const amount = parseFloat(editAmount.replace(',', '.'));
            const cost = parseFloat(editCost.replace(',', '.'));
            const rate = editHistoricalRate ? parseFloat(editHistoricalRate.replace(',', '.')) : undefined;
            const date = editDate ? new Date(editDate).getTime() : undefined;

            if (isNaN(amount) || isNaN(cost)) {
                Alert.alert("Hata", "Geçersiz değerler.");
                return;
            }

            await updateAsset(editingItem.id, amount, cost, date, rate);
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

        // Determine icon color based on type
        const getIconColor = (item: PortfolioItem) => {
            if (item.type === 'gold') return '#FFD700';
            if (item.type === 'crypto') return '#AF52DE';
            if (item.type === 'stock') return '#007AFF';
            if (item.type === 'fund') return '#FF2D55';
            if (item.type === 'bes') return '#FF9500';
            return '#8E8E93';
        };

        return (
            <View style={[styles.cardContainer, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.itemRow}>
                    {/* Left: Icon + Symbol */}
                    <View style={styles.leftContainer}>
                        <TickerIcon
                            symbol={item.customName ? item.customName.substring(0, 3).toUpperCase() : item.instrumentId}
                            color={getIconColor(item)}
                            size={40}
                        />
                        <View style={styles.textContainer}>
                            <Text style={[styles.symbol, { color: colors.text }]}>{item.customName || item.instrumentId}</Text>
                            <Text style={[styles.details, { color: colors.subText }]}>
                                Maliyet: {formatCurrency(item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                            </Text>
                        </View>
                    </View>

                    {/* Right: Amount + Total */}
                    <View style={styles.rightContainer}>
                        <Text style={[styles.value, { color: colors.text }]}>
                            {item.amount} Adet
                        </Text>
                        <Text style={[styles.total, { color: colors.subText }]}>
                            {formatCurrency(item.amount * item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                        </Text>
                    </View>

                    {/* Web Action Buttons */}
                    {isLargeScreen && (
                        <View style={{ flexDirection: 'row', gap: 12, marginLeft: 20 }}>
                            <TouchableOpacity onPress={() => openEditModal(item)} style={{ padding: 4 }}>
                                <Ionicons name="create-outline" size={20} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 4 }}>
                                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                            </TouchableOpacity>
                        </View>
                    )}
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
                        disableRightSwipe={isLargeScreen}
                        contentContainerStyle={styles.scrollContent}
                    />
                )
            ) : (
                // CLOSED POSITIONS (History) with Category Summary
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {realizedTrades.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: colors.subText, marginTop: 20 }}>Henüz işlem yok.</Text>
                    ) : (
                        <>
                            {/* Category Summary */}
                            {(() => {
                                const categoryTotals: { [key: string]: { profitTry: number; count: number } } = {};
                                let totalProfitTry = 0;

                                realizedTrades.forEach(trade => {
                                    const cat = trade.type || 'other';
                                    if (!categoryTotals[cat]) {
                                        categoryTotals[cat] = { profitTry: 0, count: 0 };
                                    }
                                    categoryTotals[cat].profitTry += trade.profitTry;
                                    categoryTotals[cat].count += 1;
                                    totalProfitTry += trade.profitTry;
                                });

                                const getCategoryName = (type: string) => {
                                    switch (type) {
                                        case 'stock': return '📈 Hisse';
                                        case 'crypto': return '₿ Kripto';
                                        case 'fund': return '📊 Fon';
                                        case 'gold': return '🥇 Altın';
                                        case 'bes': return '🏦 BES';
                                        case 'custom': return '📁 Diğer';
                                        default: return '📁 Diğer';
                                    }
                                };

                                return (
                                    <View style={{ marginBottom: 20 }}>
                                        {/* Total Summary Card */}
                                        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border, padding: 16 }]}>
                                            <Text style={{ color: colors.subText, fontSize: 13, marginBottom: 4 }}>Toplam Gerçekleşen K/Z</Text>
                                            <Text style={{ color: totalProfitTry >= 0 ? colors.success : colors.danger, fontSize: 24, fontWeight: '700' }}>
                                                {totalProfitTry >= 0 ? '+' : ''}{formatCurrency(totalProfitTry, 'TRY')}
                                            </Text>
                                        </View>

                                        {/* Category Breakdown */}
                                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 16, marginBottom: 10 }}>Kategori Bazlı</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                            {Object.entries(categoryTotals).map(([cat, data]) => (
                                                <View key={cat} style={{ backgroundColor: colors.cardBackground, borderRadius: 12, padding: 12, minWidth: '47%', flex: 1, borderWidth: 1, borderColor: colors.border }}>
                                                    <Text style={{ color: colors.subText, fontSize: 12 }}>{getCategoryName(cat)}</Text>
                                                    <Text style={{ color: data.profitTry >= 0 ? colors.success : colors.danger, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                                                        {data.profitTry >= 0 ? '+' : ''}{formatCurrency(data.profitTry, 'TRY')}
                                                    </Text>
                                                    <Text style={{ color: colors.subText, fontSize: 11, marginTop: 2 }}>{data.count} işlem</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })()}

                            {/* Trade List */}
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>İşlem Geçmişi</Text>
                            {realizedTrades.slice().reverse().map(trade => {
                                const cost = trade.buyPrice * trade.amount;
                                const profitPercent = cost > 0 ? (trade.profitTry / cost) * 100 : 0;

                                return (
                                    <View key={trade.id} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                        <View style={styles.row}>
                                            <Text style={[styles.symbol, { color: colors.text }]}>{trade.instrumentId} (SATIŞ)</Text>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={[styles.value, { color: trade.profitTry >= 0 ? colors.success : colors.danger }]}>
                                                    {trade.profitTry >= 0 ? '+' : ''}{formatCurrency(trade.profitTry, 'TRY')}
                                                </Text>
                                                <Text style={{ color: trade.profitTry >= 0 ? colors.success : colors.danger, fontSize: 12, fontWeight: '600' }}>
                                                    ({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%)
                                                </Text>
                                            </View>
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
                                );
                            })}
                        </>
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

                        <Text style={[styles.label, { color: colors.text }]}>İşlem Tarihi (YYYY-MM-DD)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editDate}
                            onChangeText={setEditDate}
                            placeholder="2024-01-15"
                            placeholderTextColor={colors.subText}
                        />

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={[styles.label, { color: colors.text, marginBottom: 0, flex: 1 }]}>
                                USD/TRY Kuru (o günkü)
                            </Text>
                            {isLoadingRate && <ActivityIndicator size="small" color={colors.primary} />}
                        </View>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editHistoricalRate}
                            onChangeText={setEditHistoricalRate}
                            keyboardType="numeric"
                            placeholder="Otomatik yüklenecek"
                            placeholderTextColor={colors.subText}
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
    // Modern card container (iOS style)
    cardContainer: {
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    textContainer: {
        justifyContent: 'center',
    },
    rightContainer: {
        alignItems: 'flex-end',
    },
    // Legacy card (can be removed later)
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
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    value: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    total: {
        fontSize: 13,
        fontWeight: '500',
    },
    details: {
        fontSize: 13,
        fontWeight: '500',
    },
    rowBack: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingRight: 15,
        marginBottom: 12,
        borderRadius: 16,
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
