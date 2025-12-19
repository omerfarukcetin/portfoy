import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, SafeAreaView, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { MarketDataService } from '../services/marketData';
import { PortfolioItem } from '../types';
import { PortfolioSwitcher } from '../components/PortfolioSwitcher';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import { GradientCard } from '../components/GradientCard';
import { AssetRow } from '../components/AssetRow';
import { TickerIcon } from '../components/TickerIcon';

export const PortfolioScreen = () => {
    const { portfolio, deleteAsset, updateAsset, cashBalance, activePortfolio, cashItems } = usePortfolio();
    const { colors, fontScale } = useTheme();
    const { symbolCase } = useSettings();
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isLargeScreen = Platform.OS === 'web' && width >= 768;

    const [refreshing, setRefreshing] = useState(false);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [dailyChanges, setDailyChanges] = useState<Record<string, number>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [displayCurrency, setDisplayCurrency] = useState<'TRY' | 'USD'>('TRY');
    const [usdRate, setUsdRate] = useState(1);
    const [fundPrices, setFundPrices] = useState<Record<string, number>>({});

    // Edit### 5. Yeni Arayüz İyileştirmeleri (Feedback Revizyonu)
- ** Varlık Adı ve Değişim **: Portföy ekranında günlük % değişim, varlık adının hemen sağına küçük ve şık bir şekilde taşındı.
- ** Minimalist Görünüm **: Maliyet ve Kâr / Zarar bölümlerindeki arka plan kutuları kaldırılarak daha yalın ve temiz bir tasarıma geçildi.
- ** Sola Dayalı Yerleşim **: Tüm varlık bilgileri sola dayalı hale getirilerek okunabilirlik artırıldı.
- ** İşlemler Tablosu Sadeleştirme **: Tablo satırlarındaki harf ikonları kaldırıldı, sadece metin bazlı ve sola dayalı profesyonel görünüme geçildi.
        itingItem] = useState<PortfolioItem | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editCost, setEditCost] = useState('');
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const formatSymbol = (symbol: string) => {
        if (symbolCase === 'titlecase') return symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
        return symbol.toUpperCase();
    };

    // Auto-refresh prices every 5 minutes
    useEffect(() => {
        fetchPrices();
        refreshIntervalRef.current = setInterval(() => fetchPrices(), 5 * 60 * 1000);
        return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
    }, [portfolio.length]);

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

        const rateData = await MarketDataService.getYahooPrice('TRY=X');
        if (rateData?.currentPrice) setUsdRate(rateData.currentPrice);

        // Filter out custom assets - they don't need price fetching
        const regularItems = portfolio.filter(item => !item.customCurrentPrice);
        const priceResults = await MarketDataService.fetchMultiplePrices(regularItems);

        for (const item of portfolio) {
            // Skip custom assets - use their stored price
            if (item.customCurrentPrice) {
                newPrices[item.instrumentId] = item.customCurrentPrice;
                newDailyChanges[item.instrumentId] = 0;
                continue;
            }

            const priceData = priceResults[item.instrumentId];
            if (priceData) {
                if ((priceData as any).error) newErrors[item.instrumentId] = (priceData as any).error;
                else if (priceData.currentPrice) {
                    newPrices[item.instrumentId] = priceData.currentPrice;
                    newDailyChanges[item.instrumentId] = (priceData as any).change24h || 0;
                }
            }
        }

        setPrices(newPrices);
        setDailyChanges(newDailyChanges);
        setErrors(newErrors);

        // Fetch fund prices for PPF
        const fundItems = cashItems.filter(item => item.type === 'money_market_fund' && item.instrumentId);
        const newFundPrices: Record<string, number> = {};
        for (const item of fundItems) {
            try {
                const priceResult = await MarketDataService.getYahooPrice(item.instrumentId!);
                if (priceResult && priceResult.currentPrice) {
                    newFundPrices[item.instrumentId!] = priceResult.currentPrice;
                }
            } catch (error) {
                console.error('Error fetching fund price:', error);
            }
        }
        setFundPrices(newFundPrices);

        setIsRefreshing(false);
    };

    const handleLongPress = (item: PortfolioItem) => {
        Alert.alert("Seçenekler", `${item.instrumentId} için işlem seçin:`, [
            { text: "İptal", style: "cancel" },
            { text: "Düzenle", onPress: () => openEditModal(item) },
            { text: "Sil", style: "destructive", onPress: () => confirmDelete(item) }
        ]);
    };

    const confirmDelete = async (item: PortfolioItem) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`${item.instrumentId} silinecek. Emin misiniz?`)) {
                console.log('🔴 Portfolio: User confirmed delete for:', item.id);
                await deleteAsset(item.id);
            }
        } else {
            Alert.alert("Varlığı Sil", `${item.instrumentId} silinecek.`, [
                { text: "İptal", style: "cancel" },
                { text: "Sil", style: "destructive", onPress: () => deleteAsset(item.id) }
            ]);
        }
    };

    const openEditModal = (item: PortfolioItem) => {
        setEditingItem(item);
        if (item.type === 'bes') {
            // For BES: show cost (besPrincipal) and current value (besPrincipal + besPrincipalYield)
            setEditAmount((item.besPrincipal || 0).toString()); // This will be "Maliyet" for BES
            setEditCost(((item.besPrincipal || 0) + (item.besPrincipalYield || 0)).toString()); // This will be "Güncel Değer" for BES
        } else {
            setEditAmount(item.amount.toString());
            setEditCost(item.averageCost.toString());
        }
        setEditModalVisible(true);
    };

    const saveEdit = async () => {
        if (editingItem && editAmount && editCost) {
            const val1 = parseFloat(editAmount.replace(',', '.'));
            const val2 = parseFloat(editCost.replace(',', '.'));
            if (isNaN(val1) || isNaN(val2)) return Alert.alert("Hata", "Geçersiz değerler.");

            if (editingItem.type === 'bes') {
                // For BES: val1 = maliyet (besPrincipal), val2 = güncel değer
                // besPrincipalYield = güncel değer - maliyet
                const besPrincipal = val1;
                const besPrincipalYield = val2 - val1;
                await updateAsset(editingItem.id, 1, besPrincipal, undefined, undefined, { besPrincipal, besPrincipalYield });
            } else {
                await updateAsset(editingItem.id, val1, val2);
            }
            setEditModalVisible(false);
            setEditingItem(null);
        }
    };

    // --- Calculations & Grouping ---
    const categoryValues: Record<string, number> = {};
    const categoryPL: Record<string, { cost: number; pl: number }> = {};

    // Helper to determine category
    const getCategory = (item: PortfolioItem) => {
        const id = item.instrumentId.toUpperCase();
        // Check for custom category first
        if (item.customCategory) return item.customCategory;
        if (item.type === 'bes' || id.startsWith('BES')) return 'BES';
        if (item.type === 'fund' || (id.length === 3 && !['BTC', 'ETH', 'SOL', 'USD', 'EUR', 'GBP'].includes(id))) return 'Fon';
        // Silver detection
        if (item.type === 'silver' || id.includes('SILVER') || id.includes('GUMUS') || id.includes('GÜMÜŞ')) return 'Gümüş';
        if (item.type === 'gold' || id.includes('GOLD') || ['GRAM', 'CEYREK', 'TAM'].includes(id)) return 'Altın';
        if (item.type === 'crypto' || ['BTC', 'ETH', 'USDT'].includes(id)) return 'Kripto';
        if (['SCHG', 'VOO', 'QQQ', 'SPY', 'USD', 'ABD'].includes(id) || (item.currency === 'USD' && item.type === 'stock')) return 'ABD ETF';
        if (item.currency === 'USD' || id.includes('USD') || id.includes('EUR')) return 'Döviz';
        return 'Hisse (BIST)';
    };

    portfolio.forEach(item => {
        // Use customCurrentPrice for custom assets, otherwise use fetched price
        const price = item.customCurrentPrice || prices[item.instrumentId] || 0;
        let value = item.amount * price;
        let cost = item.amount * item.averageCost;

        if (item.type === 'bes') {
            value = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
            cost = item.besPrincipal || 0;
        }

        const category = getCategory(item);

        let displayValue = value;
        let displayCost = cost;

        // Use original cost in target currency for different P/L percentages
        if (displayCurrency === 'USD' && item.currency === 'TRY') {
            displayValue = value / usdRate;
            displayCost = item.originalCostUsd || (cost / usdRate);
        } else if (displayCurrency === 'TRY' && item.currency === 'USD') {
            displayValue = value * usdRate;
            displayCost = item.originalCostTry || (cost * usdRate);
        }

        categoryValues[category] = (categoryValues[category] || 0) + displayValue;
        if (!categoryPL[category]) categoryPL[category] = { cost: 0, pl: 0 };
        categoryPL[category].cost += displayCost;
        categoryPL[category].pl += (displayValue - displayCost);
    });

    let displayCash = cashBalance;
    if (displayCurrency === 'USD') displayCash = cashBalance / usdRate;
    categoryValues['Yedek Akçe'] = displayCash;

    // Calculate Yedek Akçe P/L from cashItems using live fund prices
    // Cash stays same (cost = value), but money_market_fund can have P/L based on live prices
    let yedekAkceCost = 0;
    let yedekAkceValue = 0;

    cashItems.forEach(item => {
        let itemCost = item.amount; // Default: cost = current value (for plain cash)
        let itemValue = item.amount;

        // For money market funds with units and instrumentId, use live prices
        if (item.type === 'money_market_fund' && item.units && item.averageCost && item.instrumentId) {
            itemCost = item.units * item.averageCost; // Original cost
            // Use live fund price if available
            const livePrice = fundPrices[item.instrumentId];
            if (livePrice) {
                itemValue = item.units * livePrice; // Live value
            } else {
                itemValue = item.amount; // Fallback to stored amount (which is cost)
            }
        }

        // Convert to display currency if needed
        if (displayCurrency === 'USD' && item.currency === 'TRY') {
            itemValue = itemValue / usdRate;
            itemCost = itemCost / usdRate;
        } else if (displayCurrency === 'TRY' && item.currency === 'USD') {
            itemValue = itemValue * usdRate;
            itemCost = itemCost * usdRate;
        }

        yedekAkceValue += itemValue;
        yedekAkceCost += itemCost;
    });

    // Update categoryValues with live Yedek Akçe value
    categoryValues['Yedek Akçe'] = yedekAkceValue;

    // Add Yedek Akçe to categoryPL
    if (yedekAkceCost > 0) {
        categoryPL['Yedek Akçe'] = {
            cost: yedekAkceCost,
            pl: yedekAkceValue - yedekAkceCost
        };
    }

    // Get all categories for tabs (defined after categoryValues and getCategory are available)
    const allCategories = ['Hisse (BIST)', 'Altın', 'Kripto', 'Fon', 'ABD ETF', 'BES', 'Yedek Akçe'].filter(cat =>
        categoryValues[cat] > 0 || portfolio.some(i => getCategory(i) === cat)
    );

    // --- Styling Helpers ---
    const getCategoryColors = (category: string): [string, string] => {
        switch (category) {
            case 'Altın': return ['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)'];
            case 'Gümüş': return ['rgba(192, 192, 192, 0.2)', 'rgba(192, 192, 192, 0.05)'];
            case 'Döviz': return ['rgba(52, 199, 89, 0.15)', 'rgba(52, 199, 89, 0.05)'];
            case 'Hisse (BIST)': return ['rgba(0, 122, 255, 0.15)', 'rgba(0, 122, 255, 0.05)'];
            case 'Kripto': return ['rgba(175, 82, 222, 0.15)', 'rgba(175, 82, 222, 0.05)'];
            case 'BES': return ['rgba(255, 149, 0, 0.15)', 'rgba(255, 149, 0, 0.05)'];
            case 'Fon': return ['rgba(255, 45, 85, 0.15)', 'rgba(255, 45, 85, 0.05)'];
            case 'ABD ETF': return ['rgba(10, 132, 255, 0.2)', 'rgba(10, 132, 255, 0.05)'];
            case 'Yedek Akçe': return ['rgba(142, 142, 147, 0.15)', 'rgba(142, 142, 147, 0.05)'];
            default: return ['rgba(142, 142, 147, 0.1)', 'rgba(142, 142, 147, 0.05)'];
        }
    };

    // Get category icon using emojis for reliable web rendering
    const getCategoryIcon = (category: string) => {
        const iconConfig = {
            'Altın': { emoji: '🥇', color: '#FFD700' },
            'Gümüş': { emoji: '🥈', color: '#C0C0C0' },
            'Döviz': { emoji: '💵', color: '#34C759' },
            'Hisse (BIST)': { emoji: '📈', color: '#007AFF' },
            'Kripto': { emoji: '₿', color: '#AF52DE' },
            'BES': { emoji: '🏛️', color: '#FF9500' },
            'Fon': { emoji: '📊', color: '#FF2D55' },
            'ABD ETF': { emoji: '🇺🇸', color: '#0A84FF' },
            'Yedek Akçe': { emoji: '💰', color: '#8E8E93' },
        }[category] || { emoji: '📦', color: '#8E8E93' };

        return (
            <View style={{ backgroundColor: iconConfig.color + '20', padding: 6, borderRadius: 8, minWidth: 28, alignItems: 'center' }}>
                <Text style={{ fontSize: 14 }}>{iconConfig.emoji}</Text>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground, paddingTop: Platform.OS === 'web' ? 20 : 10 }]}>
                <PortfolioSwitcher />
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={onRefresh} disabled={isRefreshing}>
                        <Text style={{ fontSize: 18 }}>{isRefreshing ? '⏳' : '🔄'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setDisplayCurrency(prev => prev === 'TRY' ? 'USD' : 'TRY')}
                        style={[styles.currencyButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                    >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>{displayCurrency}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Category Tabs */}
            <View style={{ height: 50, backgroundColor: colors.cardBackground, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, alignItems: 'center', paddingHorizontal: 16 }}
                >
                    {allCategories.map(cat => {
                        const isActive = selectedCategory === cat;
                        return (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setSelectedCategory(isActive ? null : cat)}
                                style={[
                                    styles.categoryTab,
                                    { backgroundColor: isActive ? colors.primary : colors.background, borderColor: isActive ? colors.primary : colors.border }
                                ]}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#fff' : colors.text }}>
                                    {cat.replace(' (BIST)', '')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {allCategories
                    .filter(cat => selectedCategory === null || selectedCategory === cat)
                    .map(category => {
                        if (category === 'Yedek Akçe' && categoryValues[category] <= 0) return null;
                        const items = portfolio.filter(i => getCategory(i) === category);
                        if (items.length === 0 && category !== 'Yedek Akçe') return null;

                        // Calculate category P/L
                        const currentCategoryPL = categoryPL[category]?.pl || 0;
                        const currentCategoryCost = categoryPL[category]?.cost || 0;
                        const categoryPLPercent = currentCategoryCost > 0 ? (currentCategoryPL / currentCategoryCost) * 100 : 0;
                        const isProfitable = currentCategoryPL >= 0;

                        return (
                            <View key={category} style={styles.categorySection}>
                                {/* Category Header */}
                                <View style={styles.categoryHeader}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={[styles.sectionTitle, { color: colors.subText }]}>{category}</Text>
                                            <Text style={[styles.sectionTotal, { color: colors.text }]}>
                                                {formatCurrency(categoryValues[category], displayCurrency)}
                                            </Text>
                                        </View>
                                        {currentCategoryCost > 0 && (
                                            <Text style={[styles.categoryPL, { color: isProfitable ? colors.success : colors.danger, marginTop: 4 }]}>
                                                {isProfitable ? '+' : ''}{formatCurrency(currentCategoryPL, displayCurrency)} ({isProfitable ? '+' : ''}{categoryPLPercent.toFixed(1)}%)
                                            </Text>
                                        )}
                                    </View>
                                </View>



                                {/* Asset Grid */}
                                {category === 'Yedek Akçe' ? (
                                    <View style={[styles.cardContainer, { backgroundColor: colors.cardBackground }]}>
                                        {cashItems.map((cashItem, index) => {
                                            // Calculate values for each cash item
                                            let itemCost = cashItem.amount;
                                            let itemValue = cashItem.amount;
                                            let itemProfit = 0;
                                            let itemProfitPercent = 0;
                                            let itemName = cashItem.name || 'Nakit';

                                            // PPF with live prices
                                            if (cashItem.type === 'money_market_fund' && cashItem.units && cashItem.averageCost && cashItem.instrumentId) {
                                                itemCost = cashItem.units * cashItem.averageCost;
                                                const livePrice = fundPrices[cashItem.instrumentId];
                                                if (livePrice) {
                                                    itemValue = cashItem.units * livePrice;
                                                } else {
                                                    itemValue = cashItem.amount;
                                                }
                                                itemProfit = itemValue - itemCost;
                                                itemProfitPercent = itemCost > 0 ? (itemProfit / itemCost) * 100 : 0;
                                            }

                                            // Convert to display currency
                                            if (displayCurrency === 'USD' && cashItem.currency === 'TRY') {
                                                itemValue = itemValue / usdRate;
                                                itemCost = itemCost / usdRate;
                                                itemProfit = itemProfit / usdRate;
                                            }

                                            const isPPF = cashItem.type === 'money_market_fund';
                                            const isItemProfit = itemProfit >= 0;
                                            const iconSymbol = isPPF ? '📈' : '💵';
                                            const livePrice = isPPF && cashItem.instrumentId ? fundPrices[cashItem.instrumentId] : 0;
                                            const unitPrice = livePrice || (cashItem.averageCost || 0);

                                            return (
                                                <React.Fragment key={cashItem.id}>
                                                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.subText }]} />}
                                                    <TouchableOpacity
                                                        style={styles.itemRow}
                                                        onPress={() => (navigation as any).navigate('CashManagement')}
                                                        activeOpacity={0.7}
                                                    >
                                                        <View style={styles.rowLeft}>
                                                            <View style={{ backgroundColor: isPPF ? '#34C75920' : '#FFD70020', padding: 8, borderRadius: 10, minWidth: 36, alignItems: 'center' }}>
                                                                <Text style={{ fontSize: 16 }}>{iconSymbol}</Text>
                                                            </View>
                                                            <View>
                                                                <Text style={[styles.symbol, { color: colors.text }]}>{itemName}</Text>
                                                                <Text style={[styles.name, { color: colors.subText }]}>
                                                                    {isPPF && cashItem.units
                                                                        ? `${formatCurrency(unitPrice, displayCurrency)} × ${cashItem.units.toFixed(2)} Adet`
                                                                        : cashItem.currency
                                                                    }
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        <View style={{ alignItems: 'flex-end' }}>
                                                            {isPPF && itemCost > 0 && Platform.OS === 'web' && (
                                                                <Text style={{ color: colors.subText, fontSize: 10, marginBottom: 2 }}>
                                                                    Maliyet: {formatCurrency(cashItem.averageCost || 0, displayCurrency)}
                                                                </Text>
                                                            )}
                                                            <Text style={[styles.value, { color: colors.text }]}>{formatCurrency(itemValue, displayCurrency)}</Text>
                                                            {isPPF && (
                                                                <View style={{ backgroundColor: isItemProfit ? colors.success + '15' : colors.danger + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 }}>
                                                                    <Text style={{ color: isItemProfit ? colors.success : colors.danger, fontSize: 11, fontWeight: '600' }}>
                                                                        {isItemProfit ? '+' : ''}{formatCurrency(itemProfit, displayCurrency)} ({isItemProfit ? '+' : ''}{itemProfitPercent.toFixed(1)}%)
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    </TouchableOpacity>
                                                </React.Fragment>
                                            );
                                        })}
                                        {cashItems.length === 0 && (
                                            <TouchableOpacity
                                                style={styles.itemRow}
                                                onPress={() => (navigation as any).navigate('CashManagement')}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.rowLeft}>
                                                    <View style={{ backgroundColor: '#FFD70020', padding: 8, borderRadius: 10, minWidth: 36, alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 16 }}>💰</Text>
                                                    </View>
                                                    <View>
                                                        <Text style={[styles.symbol, { color: colors.text }]}>Yedek Akçe Ekle</Text>
                                                        <Text style={[styles.name, { color: colors.subText }]}>Nakit veya PPF ekleyin</Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : (
                                    /* Regular assets grid */
                                    <View style={styles.assetGrid}>
                                        {items.map((item) => {
                                            const currentPrice = item.customCurrentPrice || prices[item.instrumentId] || 0;
                                            const changePercent = dailyChanges[item.instrumentId] || 0;
                                            let value = item.amount * currentPrice;
                                            let cost = item.amount * item.averageCost;

                                            if (item.type === 'bes') {
                                                value = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
                                                cost = item.besPrincipal || 0;
                                            }

                                            // Currency conversion
                                            if (displayCurrency === 'USD' && item.currency === 'TRY') {
                                                value = value / usdRate;
                                                cost = cost / usdRate;
                                            } else if (displayCurrency === 'TRY' && item.currency === 'USD') {
                                                value = value * usdRate;
                                                cost = cost * usdRate;
                                            }

                                            const profit = value - cost;
                                            const profitPercent = cost > 0 ? (profit / cost) * 100 : 0;
                                            const isProfit = profit >= 0;

                                            return (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={[styles.compactCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                                                    onPress={() => (navigation as any).navigate('AssetDetail', { id: item.id })}
                                                    onLongPress={() => handleLongPress(item)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                                                        <Text style={[styles.cardSymbol, { color: colors.text, marginBottom: 0 }]}>
                                                            {formatSymbol(item.instrumentId)}
                                                        </Text>
                                                        {changePercent !== 0 && (
                                                            <Text style={{ fontSize: 10, color: changePercent > 0 ? colors.success : colors.danger, fontWeight: '600' }}>
                                                                {changePercent > 0 ? '↑' : '↓'} %{Math.abs(changePercent).toFixed(2)}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <Text style={[styles.cardDetail, { color: colors.subText }]}>
                                                        {formatCurrency(currentPrice, item.currency || 'TRY')} × {item.amount.toFixed(item.amount < 10 ? 2 : 0)}
                                                    </Text>
                                                    <Text style={[styles.cardCost, { color: colors.subText, marginBottom: 4 }]}>
                                                        Maliyet: {formatCurrency(cost, displayCurrency)}
                                                    </Text>
                                                    <Text style={[styles.cardValue, { color: colors.text, marginBottom: 4 }]}>
                                                        {formatCurrency(value, displayCurrency)}
                                                    </Text>
                                                    <View style={styles.cardPL}>
                                                        <Text style={{ fontSize: 11, fontWeight: '600', color: isProfit ? colors.success : colors.danger }}>
                                                            {isProfit ? '+' : ''}{formatCurrency(profit, displayCurrency)} ({isProfit ? '+' : ''}{profitPercent.toFixed(1)}%)
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}
            </ScrollView>

            {/* Edit Modal */}
            <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.symbol, { textAlign: 'center', fontSize: 20, marginBottom: 16, color: colors.text }]}>
                            {editingItem?.instrumentId} Düzenle
                        </Text>

                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>
                            {editingItem?.type === 'bes' ? 'MALİYET (₺)' : 'MİKTAR'}
                        </Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={editAmount}
                            onChangeText={setEditAmount}
                            keyboardType="numeric"
                        />

                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>
                            {editingItem?.type === 'bes' ? 'GÜNCEL DEĞER (₺)' : 'ORTALAMA MALİYET'}
                        </Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={editCost}
                            onChangeText={setEditCost}
                            keyboardType="numeric"
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.button, { backgroundColor: colors.background }]} onPress={() => setEditModalVisible(false)}>
                                <Text style={{ color: colors.text, fontWeight: '600' }}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={saveEdit}>
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 15,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    scrollContent: { paddingBottom: 100, paddingHorizontal: Platform.OS === 'web' ? 16 : 12 },
    scrollContentWeb: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    sectionContainer: { marginTop: Platform.OS === 'web' ? 20 : 16 },
    sectionContainerWeb: {
        width: '32%', // 3 columns
        minWidth: 280,
        marginTop: 10,
    },
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, paddingHorizontal: 4
    },
    sectionTitle: { fontSize: Platform.OS === 'web' ? 13 : 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
    categoryPL: { fontSize: Platform.OS === 'web' ? 11 : 10, fontWeight: '600', marginTop: 2 },
    sectionTotal: { fontSize: Platform.OS === 'web' ? 14 : 12, fontWeight: '700' },

    // New Card Container Style (Modern look with border and shadow)
    cardContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },

    // Legacy / Shared Styles
    symbol: { fontSize: Platform.OS === 'web' ? 16 : 14, fontWeight: '700', marginBottom: 2 },
    name: { fontSize: Platform.OS === 'web' ? 13 : 11 },
    value: { fontSize: Platform.OS === 'web' ? 16 : 14, fontWeight: '700', textAlign: 'right' },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '85%', padding: 24, borderRadius: 20 },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 16 },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
    button: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    currencyButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },

    // Cash Row specific styles (mimicking AssetRow)
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Platform.OS === 'web' ? 14 : 12,
        paddingHorizontal: Platform.OS === 'web' ? 16 : 12
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    divider: {
        height: 1,
        width: '100%',
        opacity: 0.08,
        marginLeft: 60, // Indent divider to align with text start (iOS style)
    },
    plBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },

    // Category Tabs
    categoryTab: {
        paddingHorizontal: 16,
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 17,
        borderWidth: 1,
        minWidth: 80,
    },

    // Category Section
    categorySection: {
        marginTop: 20,
        paddingHorizontal: 4,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },

    // Asset Grid
    assetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },

    // Compact Card
    compactCard: {
        width: Platform.OS === 'web' ? '23%' : '48%',
        minWidth: 140,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    cardSymbol: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardDetail: {
        fontSize: 11,
        marginBottom: 2,
    },
    cardCost: {
        fontSize: 10,
        marginBottom: 6,
    },
    cardValue: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardPL: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
});
