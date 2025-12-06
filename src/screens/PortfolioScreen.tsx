import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { MarketDataService } from '../services/marketData';
import { PortfolioItem } from '../types';
import { PortfolioSwitcher } from '../components/PortfolioSwitcher';
import { useNavigation } from '@react-navigation/native';

export const PortfolioScreen = () => {
    const { portfolio, deleteAsset, updateAsset, cashBalance } = usePortfolio();
    const { colors, fontScale } = useTheme();
    const navigation = useNavigation();
    const [refreshing, setRefreshing] = useState(false);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [dailyChanges, setDailyChanges] = useState<Record<string, number>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [displayCurrency, setDisplayCurrency] = useState<'TRY' | 'USD'>('TRY');
    const [usdRate, setUsdRate] = useState(1);

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editCost, setEditCost] = useState('');
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-refresh prices every 5 minutes
    useEffect(() => {
        fetchPrices(); // Initial fetch

        refreshIntervalRef.current = setInterval(() => {
            fetchPrices();
        }, 5 * 60 * 1000); // Refresh every 5 minutes (reduced API calls)

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [portfolio.length]); // Re-setup when portfolio changes

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPrices();
        setRefreshing(false);
    };

    const fetchPrices = async () => {
        setIsRefreshing(true);
        const newPrices: Record<string, number> = {};
        const newDailyChanges: Record<string, number> = {};
        const newErrors: Record<string, string> = {};

        // Fetch USD/TRY rate first
        const rateData = await MarketDataService.getYahooPrice('TRY=X');
        if (rateData && rateData.currentPrice) {
            setUsdRate(rateData.currentPrice);
        }

        // Fetch all prices in parallel using batch API
        const priceResults = await MarketDataService.fetchMultiplePrices(portfolio);

        // Process results
        for (const item of portfolio) {
            const priceData = priceResults[item.instrumentId];
            if (priceData) {
                if ((priceData as any).error) {
                    newErrors[item.instrumentId] = (priceData as any).error;
                } else if (priceData.currentPrice) {
                    newPrices[item.instrumentId] = priceData.currentPrice;
                    newDailyChanges[item.instrumentId] = (priceData as any).change24h || 0;
                }
            }
        }

        setPrices(newPrices);
        setDailyChanges(newDailyChanges);
        setErrors(newErrors);
        setIsRefreshing(false);
    };

    // Removed auto-fetch to prevent rate limiting
    // Users can manually refresh prices using the refresh button

    const handleLongPress = (item: PortfolioItem) => {
        Alert.alert(
            "Seçenekler",
            `${item.instrumentId} için işlem seçin:`,
            [
                { text: "İptal", style: "cancel" },
                { text: "Düzenle", onPress: () => openEditModal(item) },
                { text: "Sil", style: "destructive", onPress: () => confirmDelete(item) }
            ]
        );
    };

    const confirmDelete = (item: PortfolioItem) => {
        Alert.alert(
            "Varlığı Sil",
            `${item.instrumentId} portföyden silinecek. Bu işlem geri alınamaz.`,
            [
                { text: "İptal", style: "cancel" },
                { text: "Sil", style: "destructive", onPress: () => deleteAsset(item.id) }
            ]
        );
    };

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

    const toggleCategory = (category: string) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    // Group items by category
    const categoryValues: Record<string, number> = {};
    portfolio.forEach(item => {
        const price = prices[item.instrumentId] || 0;
        let value = item.amount * price;

        // BES Value Calculation
        if (item.type === 'bes') {
            value = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
        }

        let category = 'Diğer';
        const id = item.instrumentId.toUpperCase();
        if (item.type === 'bes') category = 'BES';
        else if (item.type === 'fund') category = 'Fon';
        else if (item.type === 'gold') category = 'Altın';
        else if (item.type === 'crypto') category = 'Kripto';

        else if (item.type === 'stock') {
            if (item.currency === 'USD') category = 'ABD ETF';
            else category = 'Hisse (BIST)';
        }
        else if (id.includes('GOLD') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) category = 'Altın';
        else if (id.includes('SILVER') || id.includes('GUMUS')) category = 'Gümüş';
        else if (id.endsWith('.IS')) category = 'Hisse (BIST)';
        else if (id.includes('USD') && !id.includes('BTC') && !id.includes('ETH')) category = 'Döviz';
        else if (id.includes('EUR')) category = 'Döviz';
        else if (id.startsWith('BES')) category = 'BES';
        else category = 'Kripto';

        // Refine Fund/Stock/Crypto if type was not set (legacy items)
        if (!item.type) {
            if (id.length === 3 && !['BTC', 'ETH', 'SOL', 'XRP', 'USD', 'EUR', 'GBP'].includes(id)) category = 'Fon';
            // Fallback for US ETFs if type is missing but currency is USD
            if (item.currency === 'USD' && !['BTC', 'ETH', 'SOL', 'AVAX', 'USDT', 'USDC'].includes(id)) category = 'ABD ETF';
        }

        // Explicit override for known US ETFs
        if (['SCHG', 'VOO', 'QQQ', 'SPY', 'VTI', 'SCHD', 'JEPI', 'ARKK'].includes(id)) {
            category = 'ABD ETF';
        }

        // --- Currency Conversion for Category Totals ---
        let displayValue = value;
        if (displayCurrency === 'USD' && item.currency === 'TRY') {
            displayValue = value / usdRate;
        } else if (displayCurrency === 'TRY' && item.currency === 'USD') {
            displayValue = value * usdRate;
        }

        categoryValues[category] = (categoryValues[category] || 0) + displayValue;
    });

    // Add Cash (Cash is TRY)
    let displayCash = cashBalance;
    if (displayCurrency === 'USD') {
        displayCash = cashBalance / usdRate;
    }
    categoryValues['Yedek Akçe'] = displayCash;

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Altın': return 'rgba(255, 215, 0, 0.1)'; // Gold tint
            case 'Gümüş': return 'rgba(192, 192, 192, 0.15)'; // Silver tint
            case 'Döviz': return 'rgba(52, 199, 89, 0.1)'; // Green tint
            case 'Hisse (BIST)': return 'rgba(0, 122, 255, 0.1)'; // Blue tint
            case 'Kripto': return 'rgba(175, 82, 222, 0.1)'; // Purple tint
            case 'BES': return 'rgba(255, 149, 0, 0.1)'; // Orange tint
            case 'Fon': return 'rgba(255, 45, 85, 0.1)'; // Red/Pink tint
            case 'ABD ETF': return 'rgba(0, 122, 255, 0.15)'; // Darker Blue tint
            default: return colors.cardBackground;
        }
    };

    const renderItem = ({ item }: { item: PortfolioItem }) => {
        const currentPrice = prices[item.instrumentId] || 0;
        const changePercent = dailyChanges[item.instrumentId] || 0;

        // --- Currency Conversion Logic ---
        let displayPrice = currentPrice;
        let displayValue = item.amount * currentPrice;
        let displayCost = item.amount * item.averageCost;
        let displayCurrencySymbol = item.currency;

        // If user wants USD but item is TRY
        if (displayCurrency === 'USD' && item.currency === 'TRY') {
            displayPrice = currentPrice / usdRate;
            displayValue = (item.amount * currentPrice) / usdRate;
            // CRITICAL FIX: originalCostUsd is TOTAL cost, not per-unit
            // If we have originalCostUsd (TOTAL cost in USD at purchase time), use it directly
            // Otherwise, convert current averageCost with current rate (less accurate)
            if (item.originalCostUsd) {
                displayCost = item.originalCostUsd; // Already total cost
            } else {
                // Fallback: convert TRY cost to USD using current rate
                displayCost = (item.amount * item.averageCost) / usdRate;
            }
            displayCurrencySymbol = 'USD';
        }
        // If user wants TRY but item is USD
        else if (displayCurrency === 'TRY' && item.currency === 'USD') {
            displayPrice = currentPrice * usdRate;
            displayValue = (item.amount * currentPrice) * usdRate;
            // CRITICAL FIX: originalCostTry is TOTAL cost, not per-unit
            // If we have originalCostTry (TOTAL cost in TRY at purchase time), use it directly
            // Otherwise, convert current averageCost with current rate (less accurate)
            if (item.originalCostTry) {
                displayCost = item.originalCostTry; // Already total cost
            } else {
                // Fallback: convert USD cost to TRY using current rate
                displayCost = (item.amount * item.averageCost) * usdRate;
            }
            displayCurrencySymbol = 'TRY';
        }

        const profitLoss = displayValue - displayCost;
        const profitLossPercent = displayCost > 0 ? (profitLoss / displayCost) * 100 : 0;
        const isProfit = profitLoss >= 0;
        const dailyProfitAmount = displayValue * (changePercent / 100);

        // BES Special Calculation
        if (item.type === 'bes' && item.besPrincipal) {
            // BES Value = Principal + State Contrib + Yields
            let besValue = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
            let besPrincipal = item.besPrincipal || 0;
            let besProfit = (item.besPrincipalYield || 0) + (item.besStateContribYield || 0) + (item.besStateContrib || 0);
            let besStateTotal = (item.besStateContrib || 0) + (item.besStateContribYield || 0);

            // Convert BES values if USD is selected
            if (displayCurrency === 'USD') {
                besValue = besValue / usdRate;
                besPrincipal = besPrincipal / usdRate;
                besProfit = besProfit / usdRate;
                besStateTotal = besStateTotal / usdRate;
            }

            return (
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: getCategoryColor('BES'), borderColor: colors.border }]}
                    onPress={() => (navigation as any).navigate('SellAsset', { id: item.id })}
                    onLongPress={() => handleLongPress(item)}
                >
                    <View style={styles.row}>
                        <Text style={[styles.symbol, { color: colors.text }]}>{item.instrumentId}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.value, { color: colors.text }]}>
                                {formatCurrency(besValue, displayCurrency)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.row}>
                        <Text style={[styles.details, { color: colors.subText }]}>
                            Ana Para: {formatCurrency(besPrincipal, displayCurrency)}
                        </Text>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.pl, { color: '#34C759' }]}>
                                +{formatCurrency(besProfit, displayCurrency)}
                            </Text>
                            <Text style={{ fontSize: 10, color: colors.subText, marginTop: 1 }}>
                                Devlet: {formatCurrency(besStateTotal, displayCurrency)}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        let category = 'Diğer';
        const id = item.instrumentId.toUpperCase();

        if (item.type === 'bes') category = 'BES';
        else if (item.type === 'fund') category = 'Fon';
        else if (item.type === 'gold') category = 'Altın';
        else if (item.type === 'crypto') category = 'Kripto';

        else if (item.type === 'stock') {
            if (item.currency === 'USD') category = 'ABD ETF';
            else category = 'Hisse (BIST)';
        }
        else if (id.includes('GOLD') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) category = 'Altın';
        else if (id.includes('SILVER') || id.includes('GUMUS')) category = 'Gümüş';
        else if (id.endsWith('.IS')) category = 'Hisse (BIST)';

        // Explicit override for known US ETFs
        if (['SCHG', 'VOO', 'QQQ', 'SPY', 'VTI', 'SCHD', 'JEPI', 'ARKK'].includes(id)) {
            category = 'ABD ETF';
        }
        else if (id.startsWith('BES')) category = 'BES';
        else if (id.length === 3 && !['BTC', 'ETH', 'SOL', 'XRP', 'USD', 'EUR', 'GBP'].includes(id)) category = 'Fon'; // TEFAS Funds usually 3 chars
        else if (['VOO', 'QQQ', 'SPY', 'VTI', 'SCHD', 'JEPI', 'ARKK'].includes(id) || (item.currency === 'USD' && !['BTC', 'ETH', 'SOL', 'AVAX', 'USDT'].includes(id))) category = 'ABD ETF';
        else if (item.currency === 'USD') category = 'Döviz'; // Fallback for pure currency
        else category = 'Kripto';

        // Override for known crypto if logic fails and type is not set
        if (!item.type && ['BTC', 'ETH', 'SOL', 'AVAX', 'USDT', 'USDC', 'BNB'].includes(id)) category = 'Kripto';

        const cardBg = getCategoryColor(category);

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}
                onPress={() => (navigation as any).navigate('SellAsset', { id: item.id })}
                onLongPress={() => handleLongPress(item)}
            >
                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.symbol, { color: colors.text }]}>{item.instrumentId.toUpperCase()}</Text>
                            {errors[item.instrumentId] ? (
                                <View style={{ marginLeft: 6 }}>
                                    <Feather name="alert-circle" size={16} color={colors.warning || '#FF9500'} />
                                </View>
                            ) : (
                                <Text style={{ fontSize: 10, color: changePercent >= 0 ? colors.success : colors.danger, marginLeft: 6 }}>
                                    {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                                </Text>
                            )}
                        </View>
                        <Text style={[styles.details, { color: colors.subText, marginTop: 2 }]}>
                            {item.amount} @ {formatCurrency(displayPrice, displayCurrency)}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.value, { color: colors.text }]}>
                            {formatCurrency(displayValue, displayCurrency)}
                        </Text>
                        <Text style={[styles.pl, { color: isProfit ? '#34C759' : '#FF3B30', fontSize: 11, marginTop: 2 }]}>
                            {isProfit ? '+' : ''}{formatCurrency(profitLoss, displayCurrency)} ({profitLossPercent.toFixed(2)}%)
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const styles = createStyles(fontScale);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Refresh Button and Currency Toggle */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <TouchableOpacity
                        onPress={fetchPrices}
                        disabled={isRefreshing}
                        style={styles.refreshButton}
                    >
                        <Text style={{ color: isRefreshing ? colors.subText : colors.primary, fontSize: 14 }}>
                            {isRefreshing ? '...' : '🔄'}
                        </Text>
                    </TouchableOpacity>

                    <PortfolioSwitcher />

                    <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: colors.border }}>
                        <TouchableOpacity
                            onPress={() => setDisplayCurrency('TRY')}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                                borderRadius: 6,
                                backgroundColor: displayCurrency === 'TRY' ? colors.primary : 'transparent'
                            }}
                        >
                            <Text style={{
                                color: displayCurrency === 'TRY' ? '#fff' : colors.subText,
                                fontWeight: '600',
                                fontSize: 14
                            }}>₺</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setDisplayCurrency('USD')}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                                borderRadius: 6,
                                backgroundColor: displayCurrency === 'USD' ? colors.primary : 'transparent'
                            }}
                        >
                            <Text style={{
                                color: displayCurrency === 'USD' ? '#fff' : colors.subText,
                                fontWeight: '600',
                                fontSize: 14
                            }}>$</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
            >
                {Object.keys(categoryValues).map(category => {
                    const categoryItems = portfolio.filter(item => {
                        let itemCat = 'Diğer';
                        const id = item.instrumentId.toUpperCase();
                        if (item.type === 'bes') itemCat = 'BES';
                        else if (item.type === 'fund') itemCat = 'Fon';
                        else if (item.type === 'gold') itemCat = 'Altın';
                        else if (item.type === 'crypto') itemCat = 'Kripto';
                        else if (item.type === 'stock') {
                            if (item.currency === 'USD') itemCat = 'ABD ETF';
                            else itemCat = 'Hisse (BIST)';
                        }
                        else if (id.includes('GOLD') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) itemCat = 'Altın';
                        else if (id.includes('SILVER') || id.includes('GUMUS')) itemCat = 'Gümüş';
                        else if (id.endsWith('.IS')) itemCat = 'Hisse (BIST)';
                        else if (id.includes('USD') && !id.includes('BTC') && !id.includes('ETH')) itemCat = 'Döviz';
                        else if (id.startsWith('BES')) itemCat = 'BES';
                        else if (id.length === 3 && !['BTC', 'ETH', 'SOL', 'XRP', 'USD', 'EUR', 'GBP'].includes(id)) itemCat = 'Fon';
                        else itemCat = 'Kripto';

                        // Explicit override for known US ETFs
                        if (['SCHG', 'VOO', 'QQQ', 'SPY', 'VTI', 'SCHD', 'JEPI', 'ARKK'].includes(id)) {
                            itemCat = 'ABD ETF';
                        }

                        return itemCat === category;
                    });

                    if (categoryItems.length === 0 && category !== 'Yedek Akçe') return null;
                    if (category === 'Yedek Akçe' && categoryValues[category] <= 0) return null;

                    const isCollapsed = collapsedCategories[category];

                    return (
                        <View key={category} style={[styles.categoryContainer, { backgroundColor: colors.cardBackground }]}>
                            <TouchableOpacity onPress={() => toggleCategory(category)} style={styles.categoryHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.categoryTitle, { color: colors.text }]}>{category}</Text>
                                    <Text style={{ marginLeft: 8, fontSize: 12, color: colors.subText }}>{isCollapsed ? '▼' : '▲'}</Text>
                                </View>
                                <Text style={[styles.categoryTotal, { color: colors.subText }]}>
                                    {formatCurrency(categoryValues[category], displayCurrency)}
                                </Text>
                            </TouchableOpacity>
                            {!isCollapsed && (
                                category === 'Yedek Akçe' ? (
                                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginHorizontal: 0, marginBottom: 0 }]}>
                                        <View style={styles.row}>
                                            <Text style={[styles.symbol, { color: colors.text }]}>Nakit ({displayCurrency})</Text>
                                            <Text style={[styles.value, { color: colors.text }]}>{formatCurrency(categoryValues[category], displayCurrency)}</Text>
                                        </View>
                                        <View style={styles.row}>
                                            <Text style={[styles.details, { color: colors.subText }]}>Kullanılabilir Bakiye</Text>
                                        </View>
                                    </View>
                                ) : (
                                    categoryItems.map(item => (
                                        <View key={item.id}>
                                            {renderItem({ item })}
                                        </View>
                                    ))
                                )
                            )}
                        </View>
                    );
                })}
            </ScrollView>

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

const createStyles = (fontScale: number) => StyleSheet.create({
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
        fontSize: 28 * fontScale,
        fontWeight: '700',
    },
    scrollContent: {
        paddingBottom: 100,
        paddingTop: 20,
    },
    categoryContainer: {
        marginBottom: 10,
        marginHorizontal: 15,
        borderRadius: 12,
        padding: 10,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 5,
        marginBottom: 5,
    },
    categoryTitle: {
        fontSize: 18 * fontScale,
        fontWeight: '700',
    },
    categoryTotal: {
        fontSize: 16 * fontScale,
        fontWeight: '600',
    },
    card: {
        borderRadius: 12,
        padding: 12,
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
        fontSize: 18 * fontScale,  // Standardized
        fontWeight: '700',
    },
    value: {
        fontSize: 18 * fontScale,  // Standardized
        fontWeight: '700',
    },
    details: {
        fontSize: 14 * fontScale,  // Standardized
        fontWeight: '500',
    },
    pl: {
        fontSize: 14 * fontScale,  // Standardized
        fontWeight: '600',
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
        fontSize: 20 * fontScale,
        fontWeight: '700',
        marginBottom: 5,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 16 * fontScale,
        textAlign: 'center',
        marginBottom: 20,
    },
    label: {
        fontSize: 14 * fontScale,
        marginBottom: 5,
        fontWeight: '600',
    },
    name: {
        fontSize: 14 * fontScale,  // Standardized to match Portfolio
    },
    price: {
        fontSize: 18 * fontScale,  // Standardized
        fontWeight: '600',
        marginBottom: 4,
    },
    change: {
        fontSize: 14 * fontScale,  // Standardized to match Portfolio
        fontWeight: '500',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    refreshButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        marginLeft: 10,
    },
    currencyToggle: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        marginRight: 5,
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
