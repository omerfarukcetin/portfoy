import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView, Dimensions, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePortfolio } from '../context/PortfolioContext';
import { PortfolioItem } from '../types';
import { MarketDataService } from '../services/marketData';
import { PieChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';

const screenWidth = Dimensions.get('window').width;

export const HomeScreen = () => {
    const { portfolio, realizedTrades, history, refreshPrices, totalRealizedProfitTry, totalRealizedProfitUsd, updateTotalValue, deleteAsset, cashBalance } = usePortfolio();
    const navigation = useNavigation();
    const [refreshing, setRefreshing] = useState(false);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [dailyChanges, setDailyChanges] = useState<Record<string, number>>({});
    const [usdRate, setUsdRate] = useState(0);
    const [goldPrice, setGoldPrice] = useState(0);
    const { colors, toggleTheme, theme } = useTheme();

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPrices();
        setRefreshing(false);
    };

    const fetchPrices = async () => {
        const newPrices: Record<string, number> = {};
        const newDailyChanges: Record<string, number> = {};

        // Fetch USD/TRY rate first
        const rateData = await MarketDataService.getYahooPrice('TRY=X');
        let currentRate = 0;
        if (rateData && rateData.currentPrice) {
            currentRate = rateData.currentPrice;
            setUsdRate(currentRate);
            newDailyChanges['USD'] = (rateData as any).changePercent || 0;
        }

        // Fetch Gold Price for Portfolio Value in Gold
        const goldData = await MarketDataService.getGoldPrice('gram');
        if (goldData && goldData.currentPrice) {
            setGoldPrice(goldData.currentPrice);
        }

        for (const item of portfolio) {
            let priceData;
            const id = item.instrumentId.toUpperCase();

            if (id.includes('GOLD_') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) {
                const subtypeMap: Record<string, any> = {
                    'GOLD_GRAM': 'gram', 'GRAM': 'gram',
                    'GOLD_QUARTER': 'quarter', 'CEYREK': 'quarter',
                    'GOLD_HALF': 'half', 'YARIM': 'half',
                    'GOLD_FULL': 'full', 'TAM': 'full',
                    'GOLD_ONS': 'ons', 'ONS': 'ons'
                };
                const subtype = subtypeMap[id];
                if (subtype) {
                    priceData = await MarketDataService.getGoldPrice(subtype);
                }
            } else if (id.includes('SILVER_') || id.includes('GUMUS_')) {
                const subtype = id.includes('ONS') ? 'ons' : 'gram';
                priceData = await MarketDataService.getSilverPrice(subtype);
            } else {
                priceData = await MarketDataService.getYahooPrice(item.instrumentId);
                if (!priceData || !priceData.currentPrice) {
                    const cryptoData = await MarketDataService.getCryptoPrice(item.instrumentId.toLowerCase());
                    if (cryptoData && cryptoData.currentPrice) {
                        priceData = cryptoData;
                    }
                }
            }

            if (priceData && priceData.currentPrice) {
                newPrices[item.instrumentId] = priceData.currentPrice;
                newDailyChanges[item.instrumentId] = (priceData as any).changePercent || 0;
            }
        }
        setPrices(newPrices);
        setDailyChanges(newDailyChanges);
    };

    useFocusEffect(
        useCallback(() => {
            fetchPrices();
        }, [])
    );

    useEffect(() => {
        fetchPrices();
    }, [portfolio]);

    // Calculate Totals and Update Context
    let totalPortfolioTry = 0;
    let totalPortfolioUsd = 0;
    const categoryValues: Record<string, number> = {};

    // Calculate Daily Profit based on held assets
    let dailyProfit = 0;

    portfolio.forEach(item => {
        let price = prices[item.instrumentId] || 0;
        const changePercent = dailyChanges[item.instrumentId] || 0;

        // If this is a crypto asset stored in TRY but price was fetched in USD, convert it
        if (item.type === 'crypto' && item.currency === 'TRY' && price > 0) {
            // Crypto prices from CoinGecko are in USD, convert to TRY
            price = price * (usdRate || 1);
        }

        const value = item.amount * price;

        let valueTry = 0;
        let valueUsd = 0;

        if (item.currency === 'USD') {
            valueUsd = value;
            valueTry = value * (usdRate || 1);
            dailyProfit += valueTry * (changePercent / 100);
        } else {
            valueTry = value;
            valueUsd = value / (usdRate || 1);
            dailyProfit += valueTry * (changePercent / 100);
        }

        totalPortfolioTry += valueTry;
        totalPortfolioUsd += valueUsd;

        let category = 'Diğer';
        const id = item.instrumentId.toUpperCase();
        if (id.includes('GOLD') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) category = 'Altın';
        else if (id.includes('SILVER') || id.includes('GUMUS')) category = 'Gümüş';
        else if (id.endsWith('.IS')) category = 'Hisse (BIST)';
        else if (id.includes('USD') && !id.includes('BTC') && !id.includes('ETH')) category = 'Döviz';
        else if (id.includes('EUR')) category = 'Döviz';
        else if (id.startsWith('BES')) category = 'BES';
        else category = 'Kripto';

        categoryValues[category] = (categoryValues[category] || 0) + valueTry;
    });

    // Add Cash to Total
    totalPortfolioTry += cashBalance;
    totalPortfolioUsd += cashBalance / (usdRate || 1);
    categoryValues['Yedek Akçe'] = cashBalance;

    useEffect(() => {
        if (totalPortfolioTry > 0) {
            updateTotalValue(totalPortfolioTry, totalPortfolioUsd);
        }
    }, [totalPortfolioTry, totalPortfolioUsd]);

    const handleDelete = (item: PortfolioItem) => {
        Alert.alert(
            "Varlığı Sil",
            `${item.instrumentId} portföyden silinecek.Bu işlem geri alınamaz.`,
            [
                { text: "İptal", style: "cancel" },
                { text: "Sil", style: "destructive", onPress: () => deleteAsset(item.id) }
            ]
        );
    };

    const renderItem = ({ item }: { item: PortfolioItem }) => {
        let currentPrice = prices[item.instrumentId] || 0;

        // If this is a crypto asset stored in TRY but price was fetched in USD, convert it
        if (item.type === 'crypto' && item.currency === 'TRY' && currentPrice > 0) {
            currentPrice = currentPrice * (usdRate || 1);
        }

        const changePercent = dailyChanges[item.instrumentId] || 0;
        const currentValue = item.amount * currentPrice;
        const costBasis = item.amount * item.averageCost;
        const profitLoss = currentValue - costBasis;
        const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;
        const isProfit = profitLoss >= 0;

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => (navigation as any).navigate('SellAsset', { id: item.id })}
                onLongPress={() => handleDelete(item)}
            >
                <View style={styles.row}>
                    <Text style={[styles.symbol, { color: colors.text }]}>{item.instrumentId}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.value, { color: colors.text }]}>
                            {formatCurrency(currentValue, item.currency === 'USD' ? 'USD' : 'TRY')}
                        </Text>
                        <Text style={{ fontSize: 12, color: changePercent >= 0 ? colors.success : colors.danger }}>
                            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}% (Günlük)
                        </Text>
                    </View>
                </View>
                <View style={styles.row}>
                    <Text style={[styles.details, { color: colors.subText }]}>
                        {item.amount} @ {formatCurrency(currentPrice, item.currency === 'USD' ? 'USD' : 'TRY')}
                    </Text>
                    <Text style={[styles.pl, { color: isProfit ? '#34C759' : '#FF3B30' }]}>
                        {isProfit ? '+' : ''}{formatCurrency(profitLoss, item.currency === 'USD' ? 'USD' : 'TRY')} ({profitLossPercent.toFixed(2)}%)
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const pieData = Object.keys(categoryValues).map((key, index) => ({
        name: key,
        population: categoryValues[key],
        color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'][index % 7],
        legendFontColor: colors.subText,
        legendFontSize: 12
    }));

    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

    const toggleCategory = (category: string) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    // Daily Profit Percent (Total Portfolio)
    const dailyProfitPercent = totalPortfolioTry > 0 ? (dailyProfit / totalPortfolioTry) * 100 : 0;

    // Portfolio in Gram Gold
    const portfolioInGramGold = goldPrice > 0 ? totalPortfolioTry / goldPrice : 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
            >
                <View style={[styles.header, { backgroundColor: colors.cardBackground, shadowColor: colors.text }]}>
                    <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
                        <Text style={{ fontSize: 24 }}>{theme === 'light' ? '🌙' : '☀️'}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.subText }]}>TOPLAM VARLIK</Text>
                    <Text style={[styles.headerValue, { color: colors.text }]}>{formatCurrency(totalPortfolioTry, 'TRY')}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Text style={[styles.subValue, { color: colors.subText, marginRight: 12 }]}>{formatCurrency(totalPortfolioUsd, 'USD')}</Text>
                        <Text style={[styles.subValue, { color: '#FFD700' }]}>{portfolioInGramGold.toFixed(2)} gr Altın</Text>
                    </View>

                    <TouchableOpacity
                        style={{ marginTop: 10, padding: 8, backgroundColor: colors.background, borderRadius: 8 }}
                        onPress={() => (navigation as any).navigate('Analytics')}
                    >
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Analiz ve Raporlar ➔</Text>
                    </TouchableOpacity>

                    <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Toplam K/Z</Text>
                            <Text style={[styles.summaryValue, { color: totalRealizedProfitTry >= 0 ? colors.success : colors.danger }]}>
                                {totalRealizedProfitTry >= 0 ? '+' : ''}{formatCurrency(totalRealizedProfitTry, 'TRY')}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Günlük Değişim</Text>
                            <Text style={[styles.summaryValue, { color: dailyProfit >= 0 ? colors.success : colors.danger }]}>
                                {dailyProfit >= 0 ? '+' : ''}{formatCurrency(dailyProfit, 'TRY')} (%{dailyProfitPercent.toFixed(2)})
                            </Text>
                        </View>
                    </View>
                </View>

                {portfolio.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Portföy Dağılımı</Text>
                        <PieChart
                            data={pieData}
                            width={screenWidth - 40}
                            height={220}
                            chartConfig={{
                                color: (opacity = 1) => colors.text,
                                backgroundColor: 'transparent',
                                backgroundGradientFrom: 'transparent',
                                backgroundGradientTo: 'transparent',
                                decimalPlaces: 2,
                                labelColor: (opacity = 1) => colors.text,
                            }}
                            accessor={"population"}
                            backgroundColor={"transparent"}
                            paddingLeft={"15"}
                            center={[10, 0]}
                        />
                    </>
                )}

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Varlıklarım</Text>
                {/* Categorized List */}
                {Object.keys(categoryValues).map(category => {
                    const categoryItems = portfolio.filter(item => {
                        let itemCat = 'Diğer';
                        const id = item.instrumentId.toUpperCase();
                        if (id.includes('GOLD') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) itemCat = 'Altın';
                        else if (id.includes('SILVER') || id.includes('GUMUS')) itemCat = 'Gümüş';
                        else if (id.endsWith('.IS')) itemCat = 'Hisse (BIST)';
                        else if (id.includes('USD') && !id.includes('BTC') && !id.includes('ETH')) itemCat = 'Döviz';
                        else if (id.includes('EUR')) itemCat = 'Döviz';
                        else if (id.startsWith('BES')) itemCat = 'BES';
                        else itemCat = 'Kripto';
                        return itemCat === category;
                    });

                    if (categoryItems.length === 0 && category !== 'Yedek Akçe') return null;
                    if (category === 'Yedek Akçe' && categoryValues[category] <= 0) return null;

                    const isCollapsed = collapsedCategories[category];

                    return (
                        <View key={category} style={[styles.categoryContainer, { backgroundColor: colors.cardBackground, shadowColor: colors.text }]}>
                            <TouchableOpacity onPress={() => toggleCategory(category)} style={styles.categoryHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.categoryTitle, { color: colors.text }]}>{category}</Text>
                                    <Text style={{ marginLeft: 8, fontSize: 12, color: colors.subText }}>{isCollapsed ? '▼' : '▲'}</Text>
                                </View>
                                <Text style={[styles.categoryTotal, { color: colors.subText }]}>
                                    {formatCurrency(categoryValues[category], 'TRY')}
                                </Text>
                            </TouchableOpacity>
                            {!isCollapsed && (
                                category === 'Yedek Akçe' ? (
                                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginHorizontal: 0, marginBottom: 0 }]}>
                                        <View style={styles.row}>
                                            <Text style={[styles.symbol, { color: colors.text }]}>Nakit (TL)</Text>
                                            <Text style={[styles.value, { color: colors.text }]}>{formatCurrency(categoryValues[category], 'TRY')}</Text>
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

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => (navigation as any).navigate('AddInstrument')}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    header: {
        paddingTop: 80, // Increased padding
        paddingBottom: 30,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5,
        alignItems: 'center',
        marginBottom: 20,
    },
    themeToggle: {
        position: 'absolute',
        right: 20,
        top: 50,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        fontWeight: '600',
    },
    headerValue: {
        fontSize: 40,
        fontWeight: '800',
        letterSpacing: -1,
    },
    subValue: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 20,
        marginBottom: 10,
        marginTop: 10,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 20,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    symbol: {
        fontSize: 18,
        fontWeight: '700',
    },
    value: {
        fontSize: 18,
        fontWeight: '700',
    },
    details: {
        fontSize: 13,
        fontWeight: '500',
    },
    pl: {
        fontSize: 14,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    fabText: {
        fontSize: 32,
        color: '#fff',
        marginTop: -4,
        fontWeight: '300',
    },
    categoryContainer: {
        marginBottom: 16,
        marginHorizontal: 20,
        borderRadius: 16,
        padding: 10,
        elevation: 2,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginBottom: 10,
        marginTop: 5,
    },
    categoryTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    categoryTotal: {
        fontSize: 16,
        fontWeight: '600',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 15,
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '700',
    },
});
