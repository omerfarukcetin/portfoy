import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/formatting';
import { PortfolioItem } from '../types';
import { Pencil, Trash2, Search } from 'lucide-react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import { TickerIcon } from '../components/TickerIcon';
import { MarketDataService } from '../services/marketData';
import { ShareableTradeCard, ShareableTradeCardHandle } from '../components/ShareableTradeCard';
import { Share2 } from 'lucide-react-native';

// Helper component for Asset Initials Icon
const AssetInitials = ({ name, color, size = 32 }: { name: string, color: string, size?: number }) => {
    const initials = name.substring(0, 2).toUpperCase();
    return (
        <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color + '20',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: color + '40'
        }}>
            <Text style={{ color: color, fontSize: size * 0.4, fontWeight: '700' }}>{initials}</Text>
        </View>
    );
};

export const TransactionsScreen = () => {
    const { realizedTrades, portfolio, updateAsset, deleteAsset, deleteRealizedTrade, currentUsdRate } = usePortfolio();
    const { colors, fonts } = useTheme();
    const { t } = useLanguage();
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isMobileLayout = Platform.OS !== 'web' || width < 768;
    const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter and Sort Closed Positions
    const filteredAndSortedClosedTrades = React.useMemo(() => {
        let filtered = realizedTrades;
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filtered = realizedTrades.filter(trade =>
                trade.instrumentId.toLowerCase().includes(query)
            );
        }
        // Sort by date descending (newest first)
        return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [realizedTrades, searchQuery]);

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editCost, setEditCost] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editHistoricalRate, setEditHistoricalRate] = useState('');
    const [isLoadingRate, setIsLoadingRate] = useState(false);

    // Shareable Trade Ref Management
    const shareRefs = React.useRef<{ [key: string]: ShareableTradeCardHandle | null }>({});

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
                if (Platform.OS === 'web') {
                    window.alert('Hata: Geçersiz değerler.');
                } else {
                    Alert.alert('Hata', 'Geçersiz değerler.');
                }
                return;
            }

            await updateAsset(editingItem.id, amount, cost, date, rate);
            setEditModalVisible(false);
            setEditingItem(null);
        }
    };

    const handleDelete = async (item: PortfolioItem) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`${item.instrumentId} silinecek. Emin misiniz?`)) {
                console.log('🔴 User confirmed delete for:', item.id);
                await deleteAsset(item.id);
            }
        } else {
            Alert.alert(
                'Varlığı Sil',
                `${item.instrumentId} silinecek. Emin misiniz?`,
                [
                    { text: 'İptal', style: 'cancel' },
                    { text: 'Sil', style: 'destructive', onPress: () => deleteAsset(item.id) }
                ]
            );
        }
    };

    const handleDeleteRealized = async (id: string, name: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`${name} işlemi silinecek. Emin misiniz?`)) {
                await deleteRealizedTrade(id);
            }
        } else {
            Alert.alert(
                'İşlemi Sil',
                `${name} işlemi silinecek. Emin misiniz?`,
                [
                    { text: 'İptal', style: 'cancel' },
                    { text: 'Sil', style: 'destructive', onPress: () => deleteRealizedTrade(id) }
                ]
            );
        }
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
            <TouchableOpacity
                activeOpacity={1}
                onPress={() => (navigation as any).navigate('AssetDetail', { id: item.id })}
                style={[styles.cardContainer, { backgroundColor: colors.cardBackground }]}
            >
                <View style={styles.itemRow}>
                    {/* Left: Icon + Symbol */}
                    <View style={styles.leftContainer}>
                        <TickerIcon
                            symbol={item.customName ? item.customName.substring(0, 3).toUpperCase() : item.instrumentId}
                            color={getIconColor(item)}
                            size={36}
                        />
                        <View style={styles.textContainer}>
                            <Text style={[styles.symbol, { color: colors.text, fontSize: 15 }]} numberOfLines={1} ellipsizeMode="tail">{item.customName || item.instrumentId}</Text>
                            <Text style={[styles.details, { color: colors.subText, fontSize: 11 }]} numberOfLines={1} ellipsizeMode="tail">
                                Maliyet: {formatCurrency(item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                            </Text>
                        </View>
                    </View>

                    {/* Right: Amount + Total */}
                    <View style={styles.rightContainer}>
                        <Text style={[styles.value, { color: colors.text, fontSize: 15 }]} numberOfLines={1} adjustsFontSizeToFit>
                            {item.amount.toLocaleString('tr-TR')}
                        </Text>
                        <Text style={[styles.total, { color: colors.subText, fontSize: 11 }]} numberOfLines={1} adjustsFontSizeToFit>
                            {formatCurrency(item.amount * item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                        </Text>
                    </View>

                </View>
            </TouchableOpacity>
        );
    };

    const renderRealizedItem = (data: { item: any }) => {
        const trade = data.item;

        // Correctly calculate cost basis in TRY regardless of original currency
        // For USD trades: buyPrice is in USD, convert to TRY using historical or current rate
        const usdRateForTrade = trade.historicalRate || currentUsdRate || 35;
        const costInTry = trade.currency === 'USD'
            ? trade.buyPrice * trade.amount * usdRateForTrade
            : trade.buyPrice * trade.amount;
        const profitPercent = costInTry > 0 ? (trade.profitTry / costInTry) * 100 : 0;
        const isProfit = trade.profitTry >= 0;

        return (
            <View style={[styles.cardContainer, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.itemRow}>
                    <View style={styles.leftContainer}>
                        <TickerIcon
                            symbol={trade.instrumentId.substring(0, 3)}
                            color="#8E8E93"
                            size={36}
                        />
                        <View style={styles.textContainer}>
                            <Text style={[styles.symbol, { color: colors.text, fontSize: 15 }]} numberOfLines={1} ellipsizeMode="tail">{trade.instrumentId}</Text>
                            <Text style={[styles.details, { color: colors.subText, fontSize: 11 }]} numberOfLines={1} ellipsizeMode="tail">
                                {trade.amount.toLocaleString('tr-TR')} @ {formatCurrency(trade.sellPrice, trade.currency)}
                            </Text>
                            <Text style={{ color: colors.subText, fontSize: 10, marginTop: 1 }}>
                                {new Date(trade.date).toLocaleDateString()}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.rightContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.value, { color: isProfit ? colors.success : colors.danger, fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit>
                                {isProfit ? '+' : ''}{formatCurrency(trade.profitTry, 'TRY')}
                            </Text>
                            {Platform.OS === 'web' && (
                                <TouchableOpacity
                                    style={{ marginLeft: 8 }}
                                    onPress={() => shareRefs.current[trade.id]?.captureImage()}
                                >
                                    <Share2 size={16} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={[styles.plBadge, { backgroundColor: isProfit ? colors.success + '15' : colors.danger + '15' }]}>
                            <Text style={{ color: isProfit ? colors.success : colors.danger, fontSize: 10, fontWeight: '700' }}>
                                {isProfit ? '+' : ''}{profitPercent.toFixed(1)}%
                            </Text>
                        </View>
                        {/* Hidden Shareable Component for capture */}
                        <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', left: -10000 }}>
                            <ShareableTradeCard
                                ref={el => { shareRefs.current[trade.id] = el; }}
                                symbol={trade.instrumentId}
                                profitPercent={profitPercent}
                                date={trade.date.toString()}
                            />
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderRealizedHiddenItem = (data: { item: any }, rowMap: any) => (
        <View style={styles.rowBack}>
            <TouchableOpacity
                style={[styles.backRightBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={() => {
                    rowMap[data.item.id].closeRow();
                    shareRefs.current[data.item.id]?.captureImage();
                }}
            >
                <Share2 size={24} color={colors.primary} />
                <Text style={[styles.backTextWhite, { color: colors.primary }]}>Paylaş</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.backRightBtn, { backgroundColor: colors.danger + '15' }]}
                onPress={() => {
                    rowMap[data.item.id].closeRow();
                    handleDeleteRealized(data.item.id, data.item.instrumentId);
                }}
            >
                <Trash2 size={24} color={colors.danger} />
                <Text style={[styles.backTextWhite, { color: colors.danger }]}>Sil</Text>
            </TouchableOpacity>
        </View>
    );

    const renderHiddenItem = (data: { item: PortfolioItem }, rowMap: any) => (
        <View style={styles.rowBack}>
            <TouchableOpacity
                style={[styles.backRightBtn, { backgroundColor: colors.success + '15' }]}
                onPress={() => {
                    rowMap[data.item.id].closeRow();
                    // Navigate to AssetDetail which has Sell modal or handle sell here
                    (navigation as any).navigate('AssetDetail', { id: data.item.id, openSell: true });
                }}
            >
                <Text style={{ color: colors.success, fontSize: 10, fontWeight: '800' }}>SAT</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.backRightBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={() => {
                    rowMap[data.item.id].closeRow();
                    openEditModal(data.item);
                }}
            >
                <Pencil size={20} color={colors.primary} />
                <Text style={[styles.backTextWhite, { color: colors.primary }]}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.backRightBtn, { backgroundColor: colors.danger + '15' }]}
                onPress={() => {
                    rowMap[data.item.id].closeRow();
                    handleDelete(data.item);
                }}
            >
                <Trash2 size={20} color={colors.danger} />
                <Text style={[styles.backTextWhite, { color: colors.danger }]}>Sil</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('transactions.title')}</Text>
            </View>

            {/* Tab Control */}
            <View style={[styles.tabContainer, { backgroundColor: colors.cardBackground }]}>
                <TouchableOpacity
                    style={[styles.tab, { backgroundColor: activeTab === 'open' ? colors.primary : colors.inputBackground }]}
                    onPress={() => setActiveTab('open')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'open' ? '#fff' : colors.subText }]}>{t('transactions.openPositions')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, { backgroundColor: activeTab === 'closed' ? colors.primary : colors.inputBackground }]}
                    onPress={() => setActiveTab('closed')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'closed' ? '#fff' : colors.subText }]}>{t('transactions.closedPositions')}</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'open' ? (
                // OPEN POSITIONS
                portfolio.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ textAlign: 'center', color: colors.subText }}>{t('transactions.noOpenTrades')}</Text>
                    </View>
                ) : !isMobileLayout ? (
                    // WEB: MODERN TABLE LAYOUT
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={[styles.tableCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            {/* Table Header */}
                            <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.columnHeader, { flex: 2 }]}>VARLIK ADI ↑</Text>
                                <Text style={[styles.columnHeader, { flex: 1.5 }]}>ADET ↑↓</Text>
                                <Text style={[styles.columnHeader, { flex: 1.5 }]}>MALİYET ↑↓</Text>
                                <Text style={[styles.columnHeader, { flex: 1.5 }]}>TOPLAM DEĞER ↑↓</Text>
                                <Text style={[styles.columnHeader, { flex: 1, textAlign: 'center' }]}>DÜZENLE</Text>
                                <Text style={[styles.columnHeader, { flex: 1, textAlign: 'center' }]}>SİL</Text>
                            </View>

                            {/* Table Rows */}
                            {portfolio.map((item) => {
                                const getIconColor = (item: PortfolioItem) => {
                                    if (item.type === 'gold') return '#FFD700';
                                    if (item.type === 'crypto') return '#AF52DE';
                                    if (item.type === 'stock') return '#007AFF';
                                    if (item.type === 'fund') return '#FF2D55';
                                    if (item.type === 'bes') return '#FF9500';
                                    return '#8E8E93';
                                };

                                return (
                                    <View key={item.id} style={[styles.tableRow, { borderBottomColor: colors.border + '40' }]}>
                                        {/* Asset Name */}
                                        <View style={[styles.tableCell, { flex: 2, alignItems: 'flex-start' }]}>
                                            <Text style={[styles.tableText, { fontWeight: '700', color: colors.text }]}>
                                                {item.customName || item.instrumentId}
                                            </Text>
                                        </View>

                                        {/* Quantity */}
                                        <Text style={[styles.tableText, { flex: 1.5, color: colors.subText }]}>
                                            {item.amount}
                                        </Text>

                                        {/* Cost */}
                                        <Text style={[styles.tableText, { flex: 1.5, color: colors.subText }]}>
                                            {formatCurrency(item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                                        </Text>

                                        {/* Total Value */}
                                        <Text style={[styles.tableText, { flex: 1.5, color: colors.text, fontWeight: '600' }]}>
                                            {formatCurrency(item.amount * item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                                        </Text>

                                        {/* Edit Action */}
                                        <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                                                onPress={() => openEditModal(item)}
                                            >
                                                <Text style={{ color: colors.subText, fontSize: 12, fontWeight: '600' }}>Düzenle</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Delete Action */}
                                        <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                                                onPress={() => handleDelete(item)}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Sil</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                ) : (
                    // MOBILE: SWIPE LIST VIEW
                    <SwipeListView
                        data={portfolio}
                        renderItem={renderItem}
                        renderHiddenItem={renderHiddenItem}
                        keyExtractor={(item) => item.id}
                        rightOpenValue={-210}
                        disableRightSwipe
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
                            {/* Search Bar */}
                            <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
                                <Search size={20} color={colors.subText} />
                                <TextInput
                                    style={{ flex: 1, height: 44, color: colors.text, marginLeft: 8 }}
                                    placeholder="Hisse veya fon adına göre ara..."
                                    placeholderTextColor={colors.subText}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            {/* Category Summary */}
                            {(() => {
                                const categoryTotals: { [key: string]: { profitTry: number; count: number } } = {};
                                let totalProfitTry = 0;

                                filteredAndSortedClosedTrades.forEach(trade => {
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
                                                <View key={cat} style={{ backgroundColor: colors.cardBackground, borderRadius: 12, padding: 10, minWidth: '47%', flex: 1, borderWidth: 1, borderColor: colors.border }}>
                                                    <Text style={{ color: colors.subText, fontSize: 11 }}>{getCategoryName(cat)}</Text>
                                                    <Text style={{ color: data.profitTry >= 0 ? colors.success : colors.danger, fontSize: 15, fontWeight: '700', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                                                        {data.profitTry >= 0 ? '+' : ''}{formatCurrency(data.profitTry, 'TRY')}
                                                    </Text>
                                                    <Text style={{ color: colors.subText, fontSize: 10, marginTop: 1 }}>{data.count} işlem</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })()}

                            {/* Trade List */}
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>İşlem Geçmişi</Text>

                            {!isMobileLayout ? (
                                <View style={[styles.tableCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                    {/* Table Header */}
                                    <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                                        <Text style={[styles.columnHeader, { flex: 2 }]}>VARLIK ADI</Text>
                                        <Text style={[styles.columnHeader, { flex: 1.5 }]}>ADET</Text>
                                        <Text style={[styles.columnHeader, { flex: 1.5 }]}>SATIŞ FİYATI</Text>
                                        <Text style={[styles.columnHeader, { flex: 1.5 }]}>KÂR / ZARAR</Text>
                                        <Text style={[styles.columnHeader, { flex: 1.2, textAlign: 'right' }]}>TARİH</Text>
                                        <Text style={[styles.columnHeader, { flex: 0.5, textAlign: 'center' }]}></Text>
                                    </View>

                                    {/* Table Rows */}
                                    {filteredAndSortedClosedTrades.map(trade => {
                                        const usdRateForTrade = trade.historicalRate || currentUsdRate || 35;
                                        const cost = trade.currency === 'USD'
                                            ? trade.buyPrice * trade.amount * usdRateForTrade
                                            : trade.buyPrice * trade.amount;
                                        const profitPercent = cost > 0 ? (trade.profitTry / cost) * 100 : 0;
                                        const getIconColor = (type: string) => {
                                            switch (type) {
                                                case 'gold': return '#FFD700';
                                                case 'crypto': return '#AF52DE';
                                                case 'stock': return '#007AFF';
                                                case 'fund': return '#FF2D55';
                                                case 'bes': return '#FF9500';
                                                default: return '#8E8E93';
                                            }
                                        };

                                        return (
                                            <View key={trade.id} style={[styles.tableRow, { borderBottomColor: colors.border + '40' }]}>
                                                {/* Asset Name */}
                                                <View style={[styles.tableCell, { flex: 2, alignItems: 'flex-start' }]}>
                                                    <View>
                                                        <Text style={[styles.tableText, { fontWeight: '700', color: colors.text }]}>
                                                            {trade.instrumentId}
                                                        </Text>
                                                        <Text style={{ color: colors.subText, fontSize: 10, fontWeight: '600' }}>SATIŞ</Text>
                                                    </View>
                                                </View>

                                                {/* Quantity */}
                                                <Text style={[styles.tableText, { flex: 1.5, color: colors.subText }]}>
                                                    {trade.amount}
                                                </Text>

                                                {/* Sell Price */}
                                                <Text style={[styles.tableText, { flex: 1.5, color: colors.subText }]}>
                                                    {formatCurrency(trade.sellPrice, trade.currency)}
                                                </Text>

                                                {/* Profit/Loss */}
                                                <View style={[styles.tableCell, { flex: 1.5 }]}>
                                                    <Text style={[styles.tableText, { color: trade.profitTry >= 0 ? colors.success : colors.danger, fontWeight: '700' }]}>
                                                        {trade.profitTry >= 0 ? '+' : ''}{formatCurrency(trade.profitTry, 'TRY')}
                                                    </Text>
                                                    <Text style={{ color: trade.profitTry >= 0 ? colors.success : colors.danger, fontSize: 11, fontWeight: '600' }}>
                                                        ({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%)
                                                    </Text>
                                                </View>

                                                {/* Date */}
                                                <Text style={[styles.tableText, { flex: 1.2, color: colors.subText, textAlign: 'right', fontSize: 12 }]}>
                                                    {new Date(trade.date).toLocaleDateString()}
                                                </Text>

                                                {/* Share Action */}
                                                <TouchableOpacity
                                                    style={{ flex: 0.5, alignItems: 'center', marginLeft: 8 }}
                                                    onPress={() => shareRefs.current[trade.id]?.captureImage()}
                                                >
                                                    <Share2 size={16} color={colors.primary} />
                                                </TouchableOpacity>

                                                {/* Delete Action */}
                                                <TouchableOpacity
                                                    style={{ flex: 0.5, alignItems: 'center', marginLeft: 8 }}
                                                    onPress={() => handleDeleteRealized(trade.id, trade.instrumentId)}
                                                >
                                                    <Trash2 size={16} color={colors.danger} />
                                                </TouchableOpacity>

                                                {/* Hidden Shareable Component for capture */}
                                                <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', left: -10000 }}>
                                                    <ShareableTradeCard
                                                        ref={el => { shareRefs.current[trade.id] = el; }}
                                                        symbol={trade.instrumentId}
                                                        profitPercent={profitPercent}
                                                        date={trade.date.toString()}
                                                    />
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <SwipeListView
                                    data={filteredAndSortedClosedTrades}
                                    renderItem={renderRealizedItem}
                                    renderHiddenItem={renderRealizedHiddenItem}
                                    keyExtractor={(item) => item.id}
                                    rightOpenValue={-75}
                                    disableRightSwipe
                                    contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}
                                />
                            )}
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
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingBottom: 15,
        paddingHorizontal: 15,
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
        justifyContent: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
    },
    scrollContent: {
        paddingBottom: 100,
        paddingTop: 10,
        paddingHorizontal: 12,
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
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1.5,
    },
    textContainer: {
        justifyContent: 'center',
        flex: 1,
    },
    rightContainer: {
        alignItems: 'flex-end',
        flex: 1,
        marginLeft: 8,
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
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    value: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    total: {
        fontSize: 11,
        fontWeight: '500',
    },
    details: {
        fontSize: 11,
        fontWeight: '500',
    },
    plBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },
    rowBack: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.02)', // Subtle background
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        height: Platform.OS === 'web' ? 80 : 70, // Match visible row height
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
        width: Platform.OS === 'web' ? 400 : '85%',
        padding: 24,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
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

    // Web Table Styles
    tableCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 20,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    columnHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        // hover effect would be added in CSS if it was web-only, 
        // but here we use base style
    },
    tableCell: {
        justifyContent: 'center',
    },
    tableText: {
        fontSize: 14,
    },
    actionBtn: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    }
});
