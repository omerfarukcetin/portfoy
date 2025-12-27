import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, SafeAreaView, useWindowDimensions } from 'react-native';

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
import { ExcelService } from '../services/excelService';
import { PieChart, Download, Pencil, Trash2 } from 'lucide-react-native';
import { TickerIcon } from '../components/TickerIcon';
import { SellAssetModal } from '../components/SellAssetModal';
import { SwipeListView, SwipeRow } from 'react-native-swipe-list-view';

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

const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'Hisse (BIST)': return 'trending-up';
        case 'Hisse (ABD)': return 'globe';
        case 'Fon': return 'pie-chart';
        case 'Kripto': return 'activity';
        case 'Altın/Gümüş': return 'layers';
        case 'Yedek Akçe': return 'database';
        case 'Emtia': return 'truck';
        case 'BES': return 'shield';
        default: return 'folder';
    }
};

export const PortfolioScreen = () => {
    const {
        portfolio,
        deleteAsset,
        updateAsset,
        cashBalance,
        activePortfolio,
        cashItems,
        prices: contextPrices,
        dailyChanges: contextDailyChanges,
        currentUsdRate: contextUsdRate,
        lastPricesUpdate,
        refreshAllPrices,
        updatePortfolioTarget
    } = usePortfolio();
    const { colors, fontScale } = useTheme();
    const { symbolCase } = useSettings();
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isLargeScreen = Platform.OS === 'web' && width >= 768;

    const [refreshing, setRefreshing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [displayCurrency, setDisplayCurrency] = useState<'TRY' | 'USD'>('TRY');
    const [fundPrices, setFundPrices] = useState<Record<string, number>>({});

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
    const [refreshIntrevalRef] = useState(null);
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const [targetModalVisible, setTargetModalVisible] = useState(false);
    const [targetAmount, setTargetAmount] = useState('');

    // Sell Modal State
    const [sellModalVisible, setSellModalVisible] = useState(false);
    const [sellingItem, setSellingItem] = useState<PortfolioItem | null>(null);

    const formatSymbol = (symbol: string) => {
        if (symbolCase === 'titlecase') return symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
        return symbol.toUpperCase();
    };

    // Auto-refresh fund prices specifically
    useEffect(() => {
        fetchPrices();
    }, [portfolio.length]);

    const prices = contextPrices;
    const dailyChanges = contextDailyChanges;
    const usdRate = contextUsdRate;

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            refreshAllPrices(),
            fetchPrices() // for fund prices
        ]);
        setRefreshing(false);
    };

    const fetchPrices = async () => {
        // This primarily handles Money Market Fund prices for PPF now
        const fundItems = cashItems.filter(item => item.type === 'money_market_fund' && item.instrumentId);
        if (fundItems.length === 0) return;

        const newFundPrices: Record<string, number> = {};
        for (const item of fundItems) {
            try {
                // Using getTefasPrice if available or Yahoo
                const priceResult = await MarketDataService.getTefasPrice(item.instrumentId!);
                if (priceResult && priceResult.currentPrice) {
                    newFundPrices[item.instrumentId!] = priceResult.currentPrice;
                }
            } catch (error) {
                console.error('Error fetching fund price:', error);
            }
        }
        setFundPrices(newFundPrices);
    };

    const handleExport = async () => {
        const activePortfolioName = activePortfolio?.name || 'Varliklarim';
        const success = await ExcelService.exportPortfolioToExcel(
            portfolio,
            contextPrices,
            contextUsdRate,
            activePortfolioName
        );

        if (success) {
            if (Platform.OS === 'web') {
                Alert.alert("Başarılı", "Excel dosyası indirildi.");
            }
        } else {
            Alert.alert("Hata", "Excel dökümü oluşturulurken bir hata oluştu.");
        }
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
                    <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
                        <Text style={{ fontSize: 18 }}>{refreshing ? '⏳' : '🔄'}</Text>
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

                <SellAssetModal
                    visible={sellModalVisible}
                    item={sellingItem}
                    onClose={() => {
                        setSellModalVisible(false);
                        setSellingItem(null);
                    }}
                />
            </View>

            {/* Portfolio Target Progress */}
            {targetValue > 0 && (
                <View style={[styles.targetContainer, { borderBottomColor: colors.border }]}>
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
                        <TouchableOpacity onPress={() => {
                            setTargetAmount(targetValue.toString());
                            setTargetModalVisible(true);
                        }}>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Hedefi Güncelle</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {targetValue === 0 && (
                <TouchableOpacity
                    style={[styles.setTargetDraft, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                    onPress={() => setTargetModalVisible(true)}
                >
                    <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>+ Portföy Hedefi Belirle</Text>
                </TouchableOpacity>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {/* Global Actions */}
                <View style={{ paddingHorizontal: 4, marginBottom: 16 }}>
                    <TouchableOpacity
                        style={[styles.downloadButton, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}
                        onPress={handleExport}
                    >
                        <Download size={16} color={colors.success} strokeWidth={2.5} />
                        <Text style={[styles.downloadButtonText, { color: colors.success, fontSize: 13, fontWeight: '700' }]}>PORTFÖYÜ EXCEL OLARAK İNDİR</Text>
                    </TouchableOpacity>
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
                                <View style={styles.categoryHeader}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: getCategoryColor(category) }} />
                                            <Text style={[styles.sectionTitle, { color: colors.text }]}>{category.toUpperCase()}</Text>
                                            <Text style={[styles.sectionTotal, { color: colors.text, fontSize: 16 }]}>
                                                {formatCurrency(categoryValues[category], displayCurrency)}
                                            </Text>
                                            {currentCategoryCost > 0 && (
                                                <Text style={{ color: isProfitable ? colors.success : colors.danger, fontSize: 13, fontWeight: '700' }}>
                                                    {isProfitable ? '+' : ''}{formatCurrency(currentCategoryPL, displayCurrency)} ({isProfitable ? '+' : ''}{categoryPLPercent.toFixed(1)}%)
                                                </Text>
                                            )}
                                        </View>
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

                                            // For money market funds with units and instrumentId, use live prices
                                            if (cashItem.type === 'money_market_fund' && cashItem.units && cashItem.averageCost && cashItem.instrumentId) {
                                                itemCost = cashItem.units * cashItem.averageCost;
                                                const livePrice = fundPrices[cashItem.instrumentId];
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

                                            return (
                                                <View key={index} style={[styles.itemRow, { borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border + '30' }]}>
                                                    <View style={styles.leftContainer}>
                                                        {isPPF ? (
                                                            <View style={{ backgroundColor: '#8E8E9320', padding: 8, borderRadius: 10, minWidth: 40, alignItems: 'center' }}>
                                                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subText }}>{iconSymbol}</Text>
                                                            </View>
                                                        ) : (
                                                            <View style={{ backgroundColor: '#8E8E9320', padding: 8, borderRadius: 10, minWidth: 40, alignItems: 'center' }}>
                                                                <Text style={{ fontSize: 16 }}>💰</Text>
                                                            </View>
                                                        )}
                                                        <View style={styles.textContainer}>
                                                            <Text style={[styles.symbol, { color: colors.text, fontSize: 13 }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>{itemName}</Text>
                                                            <Text style={[styles.amount, { color: colors.subText, fontSize: 11 }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>
                                                                {isPPF ? `${formatCurrency(cashItem.amount / (cashItem.units || 1), cashItem.currency)} × ${(cashItem.units || 0).toLocaleString('tr-TR')}` : formatCurrency(cashItem.amount, cashItem.currency)}
                                                            </Text>
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
                                                </View>
                                            );
                                        })}
                                        {cashItems.length === 0 && (
                                            <TouchableOpacity
                                                style={styles.itemRow}
                                                onPress={() => (navigation as any).navigate('CashManagement')}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.leftContainer}>
                                                    <View style={{ backgroundColor: '#FFD70020', padding: 8, borderRadius: 10, minWidth: 40, alignItems: 'center' }}>
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
                                ) : Platform.OS === 'web' ? (
                                    <View style={[styles.cardContainer, { backgroundColor: colors.cardBackground }]}>
                                        {items.map((item) => (
                                            <AssetRow
                                                key={item.id}
                                                item={item}
                                                currentPrice={prices[item.instrumentId] || 0}
                                                changePercent={dailyChanges[item.instrumentId] || 0}
                                                displayCurrency={displayCurrency}
                                                usdRate={usdRate}
                                                onPress={() => (navigation as any).navigate('AssetDetail', { assetId: item.id })}
                                                onLongPress={() => handleLongPress(item)}
                                                color={getCategoryColor(category)}
                                            />
                                        ))}
                                    </View>
                                ) : (
                                    <SwipeListView
                                        data={items}
                                        renderItem={(data) => (
                                            <View style={[styles.cardContainer, { backgroundColor: colors.cardBackground, marginBottom: 8 }]}>
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
                                        rightOpenValue={-210}
                                        disableRightSwipe
                                        useFlatList={false}
                                        keyExtractor={(item) => item.id}
                                        scrollEnabled={false}
                                    />
                                )}
                            </View>
                        );
                    })}
            </ScrollView >

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
        paddingTop: Platform.OS === 'ios' ? 45 : 25,
        paddingBottom: 12,
        paddingHorizontal: 15,
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
    rowBack: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 8,
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
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    downloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    downloadButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    currencyButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
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
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
    },
    lastUpdated: {
        fontSize: 11,
        fontWeight: '500',
        opacity: 0.8,
        marginTop: 2,
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
});
