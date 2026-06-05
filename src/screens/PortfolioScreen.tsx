import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';

import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { PortfolioItem } from '../types';
import { PortfolioSwitcher } from '../components/PortfolioSwitcher';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';
import { AssetRow } from '../components/AssetRow';
import { Pencil, Trash2, Target, Layers3, WalletCards, Briefcase } from 'lucide-react-native';
import { SellAssetModal } from '../components/SellAssetModal';
import { SwipeListView } from 'react-native-swipe-list-view';
import { PortfolioCategoryTabs } from '../components/portfolio/PortfolioCategoryTabs';

const getCategoryColor = (category: string) => {
    switch (category) {
        case 'Hisse (BIST)': return '#007AFF';
        case 'Hisse (ABD)': return '#FF9500';
        case 'Fon': return '#34C759';
        case 'Kripto': return '#5856D6';
        case 'Altın/Gümüş': return '#FFD700';
        case 'Yedek Akçe': return '#FF2D55';
        case 'BES': return '#AF52DE';
        default: return '#8E8E93';
    }
};

export const PortfolioScreen = () => {
    const { width } = useWindowDimensions();
    const isMobileLayout = Platform.OS !== 'web' || width < 768;
    const {
        portfolio,
        deleteAsset,
        updateAsset,
        cashBalance,
        activePortfolio,
        cashItems,
        prices: contextPrices,
        dailyChanges: contextDailyChanges,
        fundPrices,
        currentUsdRate: contextUsdRate,
        lastPricesUpdate,
        refreshAllPrices,
        updatePortfolioTarget
    } = usePortfolio();
    const { colors, fontScale } = useTheme();
    const { symbolCase } = useSettings();
    const navigation = useNavigation();
    const isLargeScreen = Platform.OS === 'web' && width >= 768;

    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [displayCurrency, setDisplayCurrency] = useState<'TRY' | 'USD'>('TRY');

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editCost, setEditCost] = useState('');

    // BES specific edit states
    const [besPrincipal, setBesPrincipal] = useState('');
    const [besYield, setBesYield] = useState('');
    const [besStateContrib, setBesStateContrib] = useState('');
    const [besStateYield, setBesStateYield] = useState('');
    const [targetModalVisible, setTargetModalVisible] = useState(false);
    const [targetAmount, setTargetAmount] = useState('');

    // Sell Modal State
    const [sellModalVisible, setSellModalVisible] = useState(false);
    const [sellingItem, setSellingItem] = useState<PortfolioItem | null>(null);

    const formatSymbol = (symbol: string) => {
        if (symbolCase === 'titlecase') return symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
        return symbol.toUpperCase();
    };

    const prices = contextPrices;
    const dailyChanges = contextDailyChanges;
    const usdRate = contextUsdRate;

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshAllPrices();
        setRefreshing(false);
    };


    const handleLongPress = (item: PortfolioItem) => {
        setEditingItem(item);
        if (item.type === 'bes') {
            // BES uses 4 components
            setBesPrincipal((item.besPrincipal || 0).toString());
            setBesYield((item.besPrincipalYield || 0).toString());
            setBesStateContrib((item.besStateContrib || 0).toString());
            setBesStateYield((item.besStateContribYield || 0).toString());

            // Also set legacy fields just in case
            setEditAmount((item.besPrincipal || 0).toString());
            setEditCost(((item.besPrincipal || 0) + (item.besPrincipalYield || 0)).toString());
        } else {
            setEditAmount(item.amount.toString());
            setEditCost(item.averageCost.toString());
        }
        setEditModalVisible(true);
    };

    const confirmDelete = async (item: PortfolioItem) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`${item.instrumentId} silinecek. Emin misiniz?`)) {
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
            // BES uses 4 components
            setBesPrincipal((item.besPrincipal || 0).toString());
            setBesYield((item.besPrincipalYield || 0).toString());
            setBesStateContrib((item.besStateContrib || 0).toString());
            setBesStateYield((item.besStateContribYield || 0).toString());

            // Also set legacy fields just in case
            setEditAmount((item.besPrincipal || 0).toString());
            setEditCost(((item.besPrincipal || 0) + (item.besPrincipalYield || 0)).toString());
        } else {
            setEditAmount(item.amount.toString());
            setEditCost(item.averageCost.toString());
        }
        setEditModalVisible(true);
    };

    const saveEdit = async () => {
        if (!editingItem) return;

        if (editingItem.type === 'bes') {
            const p = parseFloat(besPrincipal.replace(',', '.'));
            const y = parseFloat(besYield.replace(',', '.'));
            const sc = parseFloat(besStateContrib.replace(',', '.'));
            const sy = parseFloat(besStateYield.replace(',', '.'));

            if (isNaN(p) || isNaN(y) || isNaN(sc) || isNaN(sy)) {
                return Alert.alert("Hata", "Geçersiz değerler.");
            }

            await updateAsset(editingItem.id, 1, p, undefined, undefined, {
                besPrincipal: p,
                besPrincipalYield: y,
                besStateContrib: sc,
                besStateContribYield: sy
            });
        } else {
            const val1 = parseFloat(editAmount.replace(',', '.'));
            const val2 = parseFloat(editCost.replace(',', '.'));
            if (isNaN(val1) || isNaN(val2)) return Alert.alert("Hata", "Geçersiz değerler.");
            await updateAsset(editingItem.id, val1, val2);
        }
        setEditModalVisible(false);
        setEditingItem(null);
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
        if (item.type === 'forex' || ['USD', 'EUR', 'GBP', 'RUB', 'CHF', 'CAD', 'AUD', 'JPY'].includes(id)) return 'Döviz';
        if (item.type === 'fund' || (id.length === 3 && !['BTC', 'ETH', 'SOL', 'USD', 'EUR', 'GBP'].includes(id))) return 'Fon';
        // Silver detection
        if (item.type === 'silver' || id.includes('SILVER') || id.includes('GUMUS') || id.includes('GÜMÜŞ')) return 'Gümüş';
        if (item.type === 'gold' || id.includes('GOLD') || ['GRAM', 'CEYREK', 'TAM'].includes(id)) return 'Altın';
        if (item.type === 'crypto' || ['BTC', 'ETH', 'USDT'].includes(id)) return 'Kripto';
        if (['SCHG', 'VOO', 'QQQ', 'SPY', 'ABD'].includes(id) || (item.currency === 'USD' && item.type === 'stock')) return 'ABD ETF';
        if (item.currency === 'USD' || id.includes('USD') || id.includes('EUR')) return 'Döviz';
        return 'Hisse (BIST)';
    };

    portfolio.forEach(item => {
        // Use customCurrentPrice for custom assets, otherwise use fetched price
        let price = item.customCurrentPrice || prices[item.instrumentId] || 0;

        // CRITICAL FIX: If crypto is kept in TRY but price is fetched in USD (common for MarketDataService)
        if (item.type === 'crypto' && item.currency === 'TRY' && price > 0) {
            price = price * usdRate;
        }

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
    const allCategories = ['Hisse (BIST)', 'Altın', 'Gümüş', 'Kripto', 'Fon', 'ABD ETF', 'Döviz', 'BES', 'Yedek Akçe'].filter(cat =>
        categoryValues[cat] > 0 || portfolio.some(i => getCategory(i) === cat)
    );

    // Portfolio Target Calculations
    const currentTotal = Object.values(categoryValues).reduce((sum, val) => sum + val, 0);
    const targetValue = activePortfolio?.targetValueTry || 0;
    const targetPercent = targetValue > 0 ? (currentTotal / targetValue) * 100 : 0;

    const handleSaveTarget = async () => {
        const val = parseFloat(targetAmount.replace(',', '.'));
        if (isNaN(val) || val <= 0) return Alert.alert("Hata", "Geçersiz hedef değeri.");
        await updatePortfolioTarget(val, displayCurrency);
        setTargetModalVisible(false);
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
            <View style={{ backgroundColor: iconConfig.color + '18', padding: 8, borderRadius: 12, minWidth: 34, alignItems: 'center' }}>
                <Text style={{ fontSize: 14 }}>{iconConfig.emoji}</Text>
            </View>
        );
    };

    const itemCount = portfolio.length + cashItems.length;
    const lastUpdatedText = lastPricesUpdate
        ? new Date(lastPricesUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : 'Bekleniyor';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 20 : 10 }]}>
                <View style={styles.headerTopRow}>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.headerLabel, { color: colors.subText }]}>PORTFÖY</Text>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            {activePortfolio?.name || 'Portföyüm'}
                        </Text>
                        <Text style={[styles.headerMeta, { color: colors.subText }]}>
                            Son fiyat güncellemesi: {lastUpdatedText}
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={onRefresh} disabled={refreshing} style={[styles.headerIconButton, { backgroundColor: colors.cardBackground }]}>
                            <Text style={{ fontSize: 16 }}>{refreshing ? '⏳' : '🔄'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setDisplayCurrency(prev => prev === 'TRY' ? 'USD' : 'TRY')}
                            style={[styles.currencyButton, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>{displayCurrency}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <PortfolioSwitcher />
            </View>

            {/* Category Tabs */}
            <PortfolioCategoryTabs
                categories={allCategories}
                selectedCategory={selectedCategory}
                colors={colors}
                onSelect={setSelectedCategory}
            />
            <View>
                <SellAssetModal
                    visible={sellModalVisible}
                    item={sellingItem}
                    onClose={() => {
                        setSellModalVisible(false);
                        setSellingItem(null);
                    }}
                />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={styles.heroTop}>
                        <View>
                            <Text style={[styles.heroLabel, { color: colors.subText }]}>TOPLAM DEĞER</Text>
                            <Text style={[styles.heroValue, { color: colors.text }]}>{formatCurrency(currentTotal, displayCurrency)}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setTargetModalVisible(true)}
                            style={[styles.heroAction, { backgroundColor: colors.primary + '12' }]}
                        >
                            <Target size={16} color={colors.primary} />
                            <Text style={[styles.heroActionText, { color: colors.primary }]}>
                                {targetValue > 0 ? 'Hedefi Düzenle' : 'Hedef Ekle'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.heroStatsRow}>
                        <View style={[styles.heroStat, { backgroundColor: colors.background }]}>
                            <Layers3 size={16} color={colors.primary} />
                            <Text style={[styles.heroStatValue, { color: colors.text }]}>{allCategories.length}</Text>
                            <Text style={[styles.heroStatLabel, { color: colors.subText }]}>Kategori</Text>
                        </View>
                        <View style={[styles.heroStat, { backgroundColor: colors.background }]}>
                            <Briefcase size={16} color={colors.primary} />
                            <Text style={[styles.heroStatValue, { color: colors.text }]}>{itemCount}</Text>
                            <Text style={[styles.heroStatLabel, { color: colors.subText }]}>Kayıt</Text>
                        </View>
                        <View style={[styles.heroStat, { backgroundColor: colors.background }]}>
                            <WalletCards size={16} color={colors.primary} />
                            <Text style={[styles.heroStatValue, { color: colors.text }]}>{formatCurrency(categoryValues['Yedek Akçe'] || 0, displayCurrency)}</Text>
                            <Text style={[styles.heroStatLabel, { color: colors.subText }]}>Yedek Akçe</Text>
                        </View>
                    </View>

                    {targetValue > 0 ? (
                        <View style={styles.targetInlineBlock}>
                            <View style={styles.targetHeader}>
                                <Text style={[styles.targetLabel, { color: colors.subText }]}>HEDEF İLERLEMESİ</Text>
                                <Text style={[styles.targetValue, { color: colors.text }]}>
                                    {formatCurrency(currentTotal, displayCurrency)} / {formatCurrency(targetValue, displayCurrency)}
                                </Text>
                            </View>
                            <View style={[styles.progressBarBg, { backgroundColor: colors.inputBackground }]}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        {
                                            backgroundColor: colors.primary,
                                            width: `${Math.min(targetPercent, 100)}%`
                                        }
                                    ]}
                                />
                            </View>
                            <View style={styles.targetFooter}>
                                <Text style={[styles.targetPercent, { color: colors.primary }]}>{targetPercent.toFixed(1)}%</Text>
                                <Text style={[styles.targetHint, { color: colors.subText }]}>Hedefe kalan: {formatCurrency(Math.max(targetValue - currentTotal, 0), displayCurrency)}</Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={[styles.heroHint, { color: colors.subText }]}>
                            Minimal bir takip için kategori filtresini kullanabilir, dilersen bu portföye hedef değer de ekleyebilirsin.
                        </Text>
                    )}
                </View>

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
                                <View style={[styles.categoryHeaderCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                    <View style={styles.categoryHeaderMain}>
                                        {getCategoryIcon(category)}
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.sectionTitle, { color: colors.text }]}>{category}</Text>
                                            <Text style={[styles.categoryMeta, { color: colors.subText }]}>
                                                {category === 'Yedek Akçe' ? `${cashItems.length} kayıt` : `${items.length} varlık`}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.categoryHeaderRight}>
                                        <Text style={[styles.sectionTotal, { color: colors.text }]}>
                                            {formatCurrency(categoryValues[category], displayCurrency)}
                                        </Text>
                                        {currentCategoryCost > 0 && (
                                            <View style={[styles.categoryChangeBadge, { backgroundColor: isProfitable ? colors.success + '12' : colors.danger + '12' }]}>
                                                <Text style={{ color: isProfitable ? colors.success : colors.danger, fontSize: 12, fontWeight: '700' }}>
                                                    {isProfitable ? '+' : ''}{categoryPLPercent.toFixed(1)}%
                                                </Text>
                                            </View>
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
                                            const livePrice = cashItem.instrumentId ? fundPrices[cashItem.instrumentId] : undefined;
                                            const fundDailyChange = cashItem.instrumentId ? (dailyChanges[cashItem.instrumentId] || 0) : 0;

                                            // For money market funds with units and instrumentId, use live prices
                                            if (cashItem.type === 'money_market_fund' && cashItem.units && cashItem.averageCost && cashItem.instrumentId) {
                                                itemCost = cashItem.units * cashItem.averageCost;
                                                if (livePrice) {
                                                    itemValue = cashItem.units * livePrice;
                                                }
                                            }

                                            // Convert to display currency
                                            if (displayCurrency === 'USD' && cashItem.currency === 'TRY') {
                                                itemValue = itemValue / usdRate;
                                                itemCost = itemCost / usdRate;
                                            } else if (displayCurrency === 'TRY' && cashItem.currency === 'USD') {
                                                itemValue = itemValue * usdRate;
                                                itemCost = itemCost * usdRate;
                                            }

                                            itemProfit = itemValue - itemCost;
                                            let itemProfitPercent = itemCost > 0 ? (itemProfit / itemCost) * 100 : 0;
                                            let isItemProfit = itemProfit >= 0;
                                            let itemName = cashItem.name || 'Nakit';
                                            const isPPF = cashItem.type === 'money_market_fund';
                                            const iconSymbol = cashItem.instrumentId ? cashItem.instrumentId.substring(0, 3) : 'TRY';

                                            const RowWrapper = isPPF ? TouchableOpacity : View;

                                            return (
                                                <RowWrapper
                                                    key={index}
                                                    style={[styles.itemRow, { borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border + '26' }]}
                                                    {...(isPPF && {
                                                        onPress: () => (navigation as any).navigate('AssetDetail', { id: cashItem.id }),
                                                        activeOpacity: 0.7
                                                    })}
                                                >
                                                    <View style={styles.leftContainer}>
                                                        {isPPF ? (
                                                            <View style={[styles.cashIcon, { backgroundColor: colors.primary + '14' }]}>
                                                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subText }}>{iconSymbol}</Text>
                                                            </View>
                                                        ) : (
                                                            <View style={[styles.cashIcon, { backgroundColor: colors.border + '30' }]}>
                                                                <Text style={{ fontSize: 16 }}>💰</Text>
                                                            </View>
                                                        )}
                                                            <View style={styles.textContainer}>
                                                                <Text style={[styles.symbol, { color: colors.text, fontSize: 13 }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>{itemName}</Text>
                                                                <Text style={[styles.amount, { color: colors.subText, fontSize: 11 }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>
                                                                    {isPPF
                                                                        ? `${formatCurrency(livePrice || cashItem.averageCost || (cashItem.amount / (cashItem.units || 1)), cashItem.currency)} × ${(cashItem.units || 0).toLocaleString('tr-TR')}`
                                                                        : formatCurrency(cashItem.amount, cashItem.currency)}
                                                                </Text>
                                                                {isPPF && (
                                                                    <Text
                                                                        style={{
                                                                            color: fundDailyChange >= 0 ? colors.success : colors.danger,
                                                                            fontSize: 11,
                                                                            fontWeight: '700',
                                                                            marginTop: 2
                                                                        }}
                                                                        numberOfLines={1}
                                                                        ellipsizeMode="tail"
                                                                        adjustsFontSizeToFit
                                                                    >
                                                                        {fundDailyChange >= 0 ? '+' : ''}{fundDailyChange.toFixed(2)}% günlük
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                    <View style={styles.rightContainer}>
                                                        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(itemValue, displayCurrency)}</Text>
                                                        {isPPF && (
                                                            <View style={[styles.plContainer, { backgroundColor: isItemProfit ? colors.success + '15' : colors.danger + '15' }]}>
                                                                <Text style={[styles.plText, { color: isItemProfit ? colors.success : colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                                                                    {isItemProfit ? '+' : ''}{formatCurrency(itemProfit, displayCurrency)} ({isItemProfit ? '+' : ''}{itemProfitPercent.toFixed(1)}%)
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </RowWrapper>
                                            );
                                        })}
                                        {cashItems.length === 0 && (
                                            <TouchableOpacity
                                                style={styles.itemRow}
                                                onPress={() => (navigation as any).navigate('CashManagement')}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.leftContainer}>
                                                    <View style={[styles.cashIcon, { backgroundColor: colors.primary + '14' }]}>
                                                        <Text style={{ fontSize: 16 }}>💰</Text>
                                                    </View>
                                                    <View style={styles.textContainer}>
                                                        <Text style={[styles.symbol, { color: colors.text, fontSize: 13 }]} numberOfLines={1} ellipsizeMode="tail">Yedek Akçe Ekle</Text>
                                                        <Text style={[styles.amount, { color: colors.subText, fontSize: 11 }]} numberOfLines={1} ellipsizeMode="tail">Nakit veya PPF ekleyin</Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : !isMobileLayout ? (
                                    <View style={[styles.cardContainer, { backgroundColor: colors.cardBackground }]}>
                                        {items.map((item) => (
                                            <AssetRow
                                                key={item.id}
                                                item={item}
                                                currentPrice={prices[item.instrumentId] || 0}
                                                changePercent={dailyChanges[item.instrumentId] || 0}
                                                displayCurrency={displayCurrency}
                                                usdRate={usdRate}
                                                onPress={() => (navigation as any).navigate('AssetDetail', { id: item.id })}
                                                onLongPress={() => handleLongPress(item)}
                                                color={getCategoryColor(category)}
                                            />
                                        ))}
                                    </View>
                                ) : (
                                    <SwipeListView
                                        data={items}
                                        renderItem={(data) => (
                                            <View style={[styles.cardContainer, { backgroundColor: colors.cardBackground, marginBottom: 6 }]}>
                                                <AssetRow
                                                    item={data.item}
                                                    currentPrice={contextPrices[data.item.instrumentId] || 0}
                                                    changePercent={contextDailyChanges[data.item.instrumentId] || 0}
                                                    displayCurrency={displayCurrency}
                                                    usdRate={contextUsdRate}
                                                    onPress={() => (navigation as any).navigate('AssetDetail', { id: data.item.id })}
                                                    onLongPress={() => handleLongPress(data.item)}
                                                    color={getCategoryColor(category)}
                                                />
                                            </View>
                                        )}
                                        renderHiddenItem={(data, rowMap) => (
                                            <View style={styles.rowBack}>
                                                <TouchableOpacity
                                                    style={[styles.backRightBtn, { backgroundColor: colors.success + '15' }]}
                                                    onPress={() => {
                                                        rowMap[data.item.id].closeRow();
                                                        setSellingItem(data.item);
                                                        setSellModalVisible(true);
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
                                                    <Pencil size={18} color={colors.primary} />
                                                    <Text style={[styles.backTextWhite, { color: colors.primary }]}>Düzenle</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.backRightBtn, { backgroundColor: colors.danger + '15' }]}
                                                    onPress={() => {
                                                        rowMap[data.item.id].closeRow();
                                                        confirmDelete(data.item);
                                                    }}
                                                >
                                                    <Trash2 size={18} color={colors.danger} />
                                                    <Text style={[styles.backTextWhite, { color: colors.danger }]}>Sil</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        keyExtractor={(item) => item.id}
                                        rightOpenValue={-210}
                                        disableRightSwipe
                                        useFlatList={false}
                                        closeOnRowBeginSwipe={true}
                                        directionalLockEnabled={true}
                                    />
                                )}
                            </View>
                        );
                    })}
            </ScrollView>

            {/* Edit Modal */}
            < Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.symbol, { textAlign: 'center', fontSize: 20, marginBottom: 16, color: colors.text }]}>
                            {editingItem?.instrumentId} Düzenle
                        </Text>

                        {editingItem?.type === 'bes' ? (
                            <>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>ANA PARA (₺)</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={besPrincipal}
                                            onChangeText={setBesPrincipal}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>ANA PARA GETİRİSİ (₺)</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={besYield}
                                            onChangeText={setBesYield}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>DEVLET KATKISI (₺)</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={besStateContrib}
                                            onChangeText={setBesStateContrib}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>KATKI GETİRİSİ (₺)</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={besStateYield}
                                            onChangeText={setBesStateYield}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>MİKTAR</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={editAmount}
                                    onChangeText={setEditAmount}
                                    keyboardType="numeric"
                                />

                                <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>ORTALAMA MALİYET</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={editCost}
                                    onChangeText={setEditCost}
                                    keyboardType="numeric"
                                />
                            </>
                        )}

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
            </Modal >

            {/* Target Modal */}
            < Modal visible={targetModalVisible} animationType="slide" transparent onRequestClose={() => setTargetModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.symbol, { textAlign: 'center', fontSize: 20, marginBottom: 16, color: colors.text }]}>
                            Portföy Hedefi Belirle
                        </Text>
                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: colors.subText }]}>
                            HEDEF TUTAR ({displayCurrency})
                        </Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={targetAmount}
                            onChangeText={setTargetAmount}
                            placeholder={`Örn: 1000000`}
                            placeholderTextColor={colors.subText}
                            keyboardType="numeric"
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.button, { backgroundColor: colors.background }]} onPress={() => setTargetModalVisible(false)}>
                                <Text style={{ color: colors.text, fontWeight: '600' }}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleSaveTarget}>
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal >
        </View >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: Platform.OS === 'ios' ? 44 : 24,
        paddingBottom: 12,
        paddingHorizontal: 16,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 12,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerIconButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: { paddingBottom: 100, paddingHorizontal: Platform.OS === 'web' ? 16 : 12, paddingTop: 10 },
    sectionTitle: { fontSize: Platform.OS === 'web' ? 13 : 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
    sectionTotal: { fontSize: Platform.OS === 'web' ? 14 : 12, fontWeight: '700' },

    // New Card Container Style (Modern look with border and shadow)
    cardContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 24,
        elevation: 3,
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
    rowBack: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 6,
        borderRadius: 16,
        overflow: 'hidden',
        height: '100%',
    },
    backRightBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 70,
        height: '100%',
    },
    backTextWhite: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
    },
    currencyButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1.5,
    },
    rightContainer: {
        alignItems: 'flex-end',
        flex: 1,
        marginLeft: 8,
    },
    textContainer: {
        flex: 1,
    },
    amount: {
        fontSize: Platform.OS === 'web' ? 13 : 11,
    },
    plContainer: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },
    plText: {
        fontSize: 11,
        fontWeight: '600',
    },
    // Category Section
    categorySection: {
        marginTop: 18,
        paddingHorizontal: 2,
    },
    categoryHeaderCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    categoryHeaderMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    categoryHeaderRight: {
        alignItems: 'flex-end',
        marginLeft: 12,
    },
    categoryMeta: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    categoryChangeBadge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 6,
    },

    headerInfo: {
        flex: 1,
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.6,
    },
    headerMeta: {
        fontSize: 12,
        fontWeight: '500',
        opacity: 0.8,
        marginTop: 4,
    },
    heroCard: {
        borderWidth: 1,
        borderRadius: 24,
        padding: 18,
        marginBottom: 18,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
    },
    heroLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 6,
    },
    heroValue: {
        fontSize: Platform.OS === 'web' ? 34 : 28,
        fontWeight: '800',
        letterSpacing: -1,
    },
    heroAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
    },
    heroActionText: {
        fontSize: 12,
        fontWeight: '800',
    },
    heroStatsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    heroStat: {
        flex: 1,
        minHeight: 78,
        borderRadius: 16,
        padding: 12,
        justifyContent: 'space-between',
    },
    heroStatValue: {
        fontSize: 15,
        fontWeight: '800',
    },
    heroStatLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    heroHint: {
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '500',
    },
    targetInlineBlock: {
        marginTop: 2,
    },
    targetContainer: {
        padding: 16,
        borderBottomWidth: 1,
    },
    targetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    targetLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    targetValue: {
        fontSize: 12,
        fontWeight: '600',
    },
    progressBarBg: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    targetFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    targetHint: {
        fontSize: 12,
        fontWeight: '500',
    },
    targetPercent: {
        fontSize: 14,
        fontWeight: '800',
    },
    setTargetDraft: {
        margin: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    cashIcon: {
        padding: 8,
        borderRadius: 12,
        minWidth: 42,
        alignItems: 'center',
    },
});
