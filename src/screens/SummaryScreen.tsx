import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { PortfolioSwitcher } from '../components/PortfolioSwitcher';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';
import { MarketDataService } from '../services/marketData';
import { formatCurrency } from '../utils/formatting';
import { DonutChart } from '../components/DonutChart';
import { PortfolioChart } from '../components/PortfolioChart';

const screenWidth = Dimensions.get('window').width;
const insightCardWidth = (screenWidth - 58) / 3;

const Card = ({ children, style, onPress, borderColor }: { children: React.ReactNode, style?: any, onPress?: () => void, borderColor?: string }) => {
    const Container = onPress ? TouchableOpacity : View;
    return (
        <Container onPress={onPress} style={[styles.card, { borderColor: borderColor }, style]}>
            {children}
        </Container>
    );
};

export const SummaryScreen = () => {
    const navigation = useNavigation();
    const { colors, fontScale } = useTheme();
    const { portfolio, totalRealizedProfitTry, totalRealizedProfitUsd, updateTotalValue, cashBalance } = usePortfolio();
    const { marketSummaryVisible, selectedMarketInstruments, portfolioChartVisible } = useSettings();
    const [refreshing, setRefreshing] = useState(false);
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [dailyChanges, setDailyChanges] = useState<Record<string, number>>({});
    const [usdRate, setUsdRate] = useState(0);

    // Persist portfolio values to prevent flash during navigation
    const [totalPortfolioTry, setTotalPortfolioTry] = useState(0);
    const [totalPortfolioUsd, setTotalPortfolioUsd] = useState(0);
    const [totalCostBasisTry, setTotalCostBasisTry] = useState(0);
    const [dailyProfit, setDailyProfit] = useState(0);

    const [goldPrice, setGoldPrice] = useState(0);
    const [silverPrice, setSilverPrice] = useState(0);
    const [bistData, setBistData] = useState<{ price: number, change: number } | null>(null);
    const [btcPrice, setBtcPrice] = useState({ price: 0, change: 0 });
    const [ethPrice, setEthPrice] = useState({ price: 0, change: 0 });
    const [isHidden, setIsHidden] = useState(false);
    const [marketReportVisible, setMarketReportVisible] = useState(false);
    const [marketReportData, setMarketReportData] = useState<any>(null);
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-refresh prices every 30 seconds
    useEffect(() => {
        fetchPrices();
        fetchMarketData();

        refreshIntervalRef.current = setInterval(() => {
            fetchPrices();
            fetchMarketData();
        }, 5 * 60 * 1000); // Auto-refresh every 5 minutes (reduced API calls)

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [portfolio.length]);

    const fetchMarketReport = async () => {
        setMarketReportData(null);
        const [bist, usd, gold, btc] = await Promise.all([
            MarketDataService.getYahooPrice('XU100.IS'),
            MarketDataService.getYahooPrice('TRY=X'),
            MarketDataService.getGoldPrice('gram'),
            MarketDataService.getCryptoPrice('bitcoin'),
        ]);

        setMarketReportData({
            bist: { price: bist?.currentPrice || 0, change: bist?.change24h || 0 },
            usd: { price: usd?.currentPrice || 0, change: usd?.change24h || 0 },
            gold: { price: gold?.currentPrice || 0, change: gold?.change24h || 0 },
            btc: { price: btc?.currentPrice || 0, change: btc?.change24h || 0 },
        });
    };

    const fetchMarketData = async () => {
        try {
            // Fetch USD/TRY
            const usdData = await MarketDataService.getYahooPrice('TRY=X');
            if (usdData && usdData.currentPrice) setUsdRate(usdData.currentPrice);

            // Fetch Gold (Gram TL)
            const goldData = await MarketDataService.getGoldPrice('gram');
            if (goldData && goldData.currentPrice) setGoldPrice(goldData.currentPrice);

            // Fetch Silver (Gram TL)
            const silverData = await MarketDataService.getSilverPrice('gram');
            if (silverData && silverData.currentPrice) setSilverPrice(silverData.currentPrice);

            // Fetch BIST 100
            const bist = await MarketDataService.getYahooPrice('XU100.IS');
            if (bist && bist.currentPrice) {
                setBistData({
                    price: bist.currentPrice,
                    change: (bist as any).change24h || 0
                });
            }

            // Fetch BTC
            const btc = await MarketDataService.getCryptoPrice('bitcoin');
            if (btc && btc.currentPrice) {
                setBtcPrice({
                    price: btc.currentPrice,
                    change: (btc as any).change24h || 0
                });
            }

            // Fetch ETH
            const eth = await MarketDataService.getCryptoPrice('ethereum');
            if (eth && eth.currentPrice) {
                setEthPrice({
                    price: eth.currentPrice,
                    change: (eth as any).change24h || 0
                });
            }

        } catch (error) {
            console.error('Error fetching market data:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPrices();
        await fetchMarketData(); // Call new market data fetch
        setRefreshing(false);
    };

    const fetchPrices = async () => {
        const newPrices: Record<string, number> = {};
        const newDailyChanges: Record<string, number> = {};

        // Fetch USD/TRY rate
        const rateData = await MarketDataService.getYahooPrice('TRY=X');
        if (rateData && rateData.currentPrice) {
            newDailyChanges['USD'] = (rateData as any).change24h || 0;
        }

        // Fetch all prices in parallel using batch API
        const priceResults = await MarketDataService.fetchMultiplePrices(portfolio);

        // Process results
        for (const item of portfolio) {
            const priceData = priceResults[item.instrumentId];
            if (priceData && priceData.currentPrice) {
                newPrices[item.instrumentId] = priceData.currentPrice;
                newDailyChanges[item.instrumentId] = (priceData as any).change24h || 0;
            }
        }

        setPrices(newPrices);
        setDailyChanges(newDailyChanges);
    };

    // Immediate load on mount
    useEffect(() => {
        fetchPrices();
        fetchMarketData();
    }, []);

    // Auto-refresh prices every 5 minutes
    useEffect(() => {
        refreshIntervalRef.current = setInterval(() => {
            fetchPrices();
        }, 5 * 60 * 1000);

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, []);

    // Calculate Totals and update state
    useEffect(() => {
        console.log('📊 Calculating totals:', {
            pricesCount: Object.keys(prices).length,
            portfolioCount: portfolio.length,
            cashBalance,
            usdRate
        });

        // Don't calculate if prices haven't loaded yet (but allow if portfolio is empty)
        if (Object.keys(prices).length === 0 && portfolio.length > 0) {
            console.log('⏳ Waiting for prices to load...');
            return;
        }

        let calcTotalTry = 0;
        let calcTotalUsd = 0;
        let calcCostBasisTry = 0;
        let calcDailyProfit = 0;

        portfolio.forEach(item => {
            let price = prices[item.instrumentId] || 0;
            const changePercent = dailyChanges[item.instrumentId] || 0;

            // If this is a crypto asset stored in TRY but price was fetched in USD, convert it
            if (item.type === 'crypto' && item.currency === 'TRY' && price > 0) {
                price = price * (usdRate || 1);
            }

            let value = item.amount * price;

            // BES Value Calculation
            if (item.type === 'bes') {
                value = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
            }

            let valueTry = 0;
            let valueUsd = 0;
            let costTry = 0;

            if (item.currency === 'USD') {
                valueUsd = value;
                valueTry = value * (usdRate || 1);
                costTry = item.amount * item.averageCost * (usdRate || 1);
                calcDailyProfit += valueTry * (changePercent / 100);
            } else {
                valueTry = value;
                valueUsd = value / (usdRate || 1);
                costTry = item.amount * item.averageCost;
                calcDailyProfit += valueTry * (changePercent / 100);
            }

            calcTotalTry += valueTry;
            calcTotalUsd += valueUsd;
            calcCostBasisTry += costTry;
        });

        // Add Cash
        calcTotalTry += cashBalance;
        calcTotalUsd += cashBalance / (usdRate || 1);

        // Update state
        setTotalPortfolioTry(calcTotalTry);
        setTotalPortfolioUsd(calcTotalUsd);
        setTotalCostBasisTry(calcCostBasisTry);
        setDailyProfit(calcDailyProfit);
    }, [portfolio, prices, dailyChanges, usdRate, cashBalance]);

    // Category calculations (still computed on render)
    const categoryValues: Record<string, number> = {};
    let bestPerformer = { id: '', change: -Infinity };
    let worstPerformer = { id: '', change: Infinity };

    portfolio.forEach(item => {
        let price = prices[item.instrumentId] || 0;
        const changePercent = dailyChanges[item.instrumentId] || 0;

        if (item.type === 'crypto' && item.currency === 'TRY' && price > 0) {
            price = price * (usdRate || 1);
        }

        let value = item.amount * price;
        if (item.type === 'bes') {
            value = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
        }

        if (changePercent > bestPerformer.change) bestPerformer = { id: item.instrumentId, change: changePercent };
        if (changePercent < worstPerformer.change) worstPerformer = { id: item.instrumentId, change: changePercent };

        let valueTry = 0;
        if (item.currency === 'USD') {
            valueTry = value * (usdRate || 1);
        } else {
            valueTry = value;
        }

        let category = 'Diğer';
        const id = item.instrumentId.toUpperCase();

        // Crypto - check by type or known IDs
        if (item.type === 'crypto' || ['BTC', 'ETH', 'SOL', 'AVAX', 'USDT', 'USDC', 'BNB', 'WLD', 'WORLDCOIN-WLD'].includes(id)) {
            category = 'Kripto';
        }
        // Gold
        else if (id.includes('GOLD') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) {
            category = 'Altın';
        }
        // Silver
        else if (id.includes('SILVER') || id.includes('GUMUS')) {
            category = 'Gümüş';
        }
        // BIST stocks
        else if (id.endsWith('.IS')) {
            category = 'Hisse (BIST)';
        }
        // BES
        else if (id.startsWith('BES')) {
            category = 'BES';
        }
        // Funds
        else if (item.type === 'fund' || (id.length === 3 && !['BTC', 'ETH', 'SOL', 'XRP', 'USD', 'EUR', 'GBP'].includes(id))) {
            category = 'Fon';
        }
        // US ETFs
        else if (['VOO', 'QQQ', 'SPY', 'VTI', 'SCHD', 'JEPI', 'ARKK', 'SCHG'].includes(id)) {
            category = 'ABD ETF';
        }
        // Other USD assets
        else if (item.currency === 'USD') {
            category = 'Döviz';
        }

        categoryValues[category] = (categoryValues[category] || 0) + valueTry;
    });

    // Add Cash to categories
    categoryValues['Yedek Akçe'] = cashBalance;

    const totalUnrealizedProfitTry = totalPortfolioTry - cashBalance - totalCostBasisTry;
    const totalUnrealizedProfitPercent = totalCostBasisTry > 0 ? (totalUnrealizedProfitTry / totalCostBasisTry) * 100 : 0;

    useEffect(() => {
        if (totalPortfolioTry > 0) {
            updateTotalValue(totalPortfolioTry, totalPortfolioUsd);
        }
    }, [totalPortfolioTry, totalPortfolioUsd]);

    const pieData = Object.keys(categoryValues).map((key, index) => ({
        name: key,
        population: categoryValues[key],
        color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'][index % 7],
        legendFontColor: colors.subText,
        legendFontSize: 12
    }));

    const dailyProfitPercent = totalPortfolioTry > 0 ? (dailyProfit / totalPortfolioTry) * 100 : 0;
    const portfolioInGramGold = goldPrice > 0 ? totalPortfolioTry / goldPrice : 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
            >
                {/* Header Section */}
                <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                    <View style={styles.balanceContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                            <View style={{ marginRight: 8 }}>
                                <PortfolioSwitcher />
                            </View>
                            <Text style={[styles.balanceLabel, { color: colors.subText }]}>Toplam Varlık</Text>
                            <TouchableOpacity onPress={() => setIsHidden(!isHidden)} style={[styles.iconButton, { backgroundColor: colors.cardBackground, marginLeft: 8 }]}>
                                <Feather name={isHidden ? "eye-off" : "eye"} size={18} color={colors.subText} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                            <Text style={[styles.mainBalance, { color: colors.text, fontSize: 32 }]}>
                                {isHidden ? '••••••' : formatCurrency(totalPortfolioTry, 'TRY')}
                            </Text>
                            <Text style={{ color: colors.subText, marginHorizontal: 8, fontSize: 16 }}>|</Text>
                            <Text style={[styles.subBalance, { color: colors.subText, fontSize: 16 }]}>
                                {isHidden ? '••••' : formatCurrency(totalPortfolioUsd, 'USD')}
                            </Text>
                            <Text style={{ color: colors.subText, marginHorizontal: 8, fontSize: 16 }}>|</Text>
                            <Text style={[styles.subBalance, { color: '#B8860B', fontSize: 16 }]}>
                                {isHidden ? '••••' : `${portfolioInGramGold.toFixed(2)} gr`}
                            </Text>
                        </View>
                    </View>

                    {/* Stats Grid */}
                    <View style={styles.statsGrid}>
                        <View style={[styles.statItem, { backgroundColor: colors.cardBackground }]}>
                            <Text style={[styles.statLabel, { color: colors.subText }]}>Toplam K/Z</Text>
                            <View style={styles.statValueRow}>
                                <Text style={[styles.statValue, { color: totalUnrealizedProfitTry >= 0 ? colors.success : colors.danger }]}>
                                    {isHidden ? '•••' : `${totalUnrealizedProfitTry >= 0 ? '+' : ''}${formatCurrency(totalUnrealizedProfitTry, 'TRY')} `}
                                </Text>
                            </View>
                            <Text style={[styles.statPercent, { color: totalUnrealizedProfitPercent >= 0 ? colors.success : colors.danger }]}>
                                {isHidden ? '•••' : `% ${totalUnrealizedProfitPercent.toFixed(2)} `}
                            </Text>
                        </View>

                        <View style={[styles.statItem, { backgroundColor: colors.cardBackground }]}>
                            <Text style={[styles.statLabel, { color: colors.subText }]}>Günlük</Text>
                            <View style={styles.statValueRow}>
                                <Text style={[styles.statValue, { color: dailyProfit >= 0 ? colors.success : colors.danger }]}>
                                    {isHidden ? '•••' : `${dailyProfit >= 0 ? '+' : ''}${formatCurrency(dailyProfit, 'TRY')} `}
                                </Text>
                            </View>
                            <Text style={[styles.statPercent, { color: dailyProfit >= 0 ? colors.success : colors.danger }]}>
                                {isHidden ? '•••' : `% ${dailyProfitPercent.toFixed(2)} `}
                            </Text>
                        </View>

                        <View style={[styles.statItem, { backgroundColor: colors.cardBackground }]}>
                            <Text style={[styles.statLabel, { color: colors.subText }]}>Gerçekleşen</Text>
                            <View style={styles.statValueRow}>
                                <Text style={[styles.statValue, { color: totalRealizedProfitTry >= 0 ? colors.success : colors.danger }]}>
                                    {isHidden ? '•••' : `${totalRealizedProfitTry >= 0 ? '+' : ''}${formatCurrency(totalRealizedProfitTry, 'TRY')} `}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Portfolio Growth Chart */}
                {portfolioChartVisible && <PortfolioChart />}

                {/* Insights Row - 3 Columns */}
                <View style={styles.insightsRow}>
                    <Card
                        style={[styles.insightCard, { backgroundColor: colors.cardBackground, marginRight: 6 }]}
                        borderColor={colors.success}
                    >
                        <View style={styles.insightHeader}>
                            <Feather name="trending-up" size={14} color={colors.success} />
                            <Text style={[styles.insightTitle, { color: colors.success }]}>En İyi</Text>
                        </View>
                        <Text style={[styles.insightText, { color: colors.text }]} numberOfLines={2}>
                            {bestPerformer.id ? `${bestPerformer.id}: +${bestPerformer.change.toFixed(2)}%` : '-'}
                        </Text>
                    </Card>

                    <Card
                        style={[styles.insightCard, { backgroundColor: colors.cardBackground, marginRight: 6 }]}
                        borderColor={colors.danger}
                    >
                        <View style={styles.insightHeader}>
                            <Feather name="trending-down" size={14} color={colors.danger} />
                            <Text style={[styles.insightTitle, { color: colors.danger }]}>En Kötü</Text>
                        </View>
                        <Text style={[styles.insightText, { color: colors.text }]} numberOfLines={2}>
                            {worstPerformer.id ? `${worstPerformer.id}: ${worstPerformer.change.toFixed(2)}%` : '-'}
                        </Text>
                    </Card>

                    <Card
                        style={[styles.insightCard, { backgroundColor: colors.cardBackground }]}
                        borderColor={colors.primary}
                        onPress={() => setMarketReportVisible(true)}
                    >
                        <View style={styles.insightHeader}>
                            <Feather name="bar-chart-2" size={14} color={colors.primary} />
                            <Text style={[styles.insightTitle, { color: colors.primary }]}>Piyasa Özeti</Text>
                        </View>
                        <Text style={[styles.insightText, { color: colors.text }]} numberOfLines={2}>
                            Günlük raporu görüntüle
                        </Text>
                    </Card>
                </View>

                {/* Market Ticker */}
                {
                    marketSummaryVisible && (
                        <View style={[styles.section, { marginTop: 8 }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Piyasa Özeti</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tickerScroll}>
                                {[
                                    { id: 'USD/TRY', label: 'USD/TRY', value: usdRate, change: dailyChanges['USD'] || 0, currency: 'TRY' },
                                    { id: 'Gram Altın', label: 'Gram Altın', value: goldPrice, change: 0.5, currency: 'TRY' },
                                    { id: 'BIST 100', label: 'BIST 100', value: bistData?.price, change: bistData?.change || 0, currency: 'TRY' },
                                    { id: 'Gram Gümüş', label: 'Gram Gümüş', value: silverPrice, change: 0, currency: 'TRY' },
                                    { id: 'BTC', label: 'Bitcoin', value: btcPrice?.price, change: btcPrice?.change || 0, currency: 'USD' },
                                    { id: 'ETH', label: 'Ethereum', value: ethPrice?.price, change: ethPrice?.change || 0, currency: 'USD' },
                                ]
                                    .filter(item => selectedMarketInstruments.includes(item.id))
                                    .map((item, index) => (
                                        <Card key={index} style={[styles.tickerCard, { backgroundColor: colors.cardBackground, padding: 8, width: insightCardWidth, alignItems: 'center', justifyContent: 'center' }]} borderColor={colors.border}>
                                            <Text style={[styles.tickerLabel, { color: colors.subText, fontSize: 11, marginBottom: 2 }]}>{item.label}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={[styles.tickerValue, { color: colors.text, fontSize: 13, marginBottom: 0 }]}>
                                                    {item.value ? formatCurrency(item.value, item.currency as any).replace('₺', '').replace('$', '') : '-'}
                                                </Text>
                                                <View style={styles.tickerChangeRow}>
                                                    <Feather
                                                        name={item.change >= 0 ? "arrow-up-right" : "arrow-down-right"}
                                                        size={12}
                                                        color={item.change >= 0 ? colors.success : colors.danger}
                                                    />
                                                    <Text style={[styles.tickerChange, { color: item.change >= 0 ? colors.success : colors.danger, fontSize: 11 }]}>
                                                        %{Math.abs(item.change).toFixed(2)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </Card>
                                    ))}
                            </ScrollView >
                        </View >
                    )
                }

                {/* Portfolio Distribution */}
                {
                    portfolio.length > 0 && (
                        <View style={[styles.section, { marginTop: 8 }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 16 * fontScale }]}>Portföy Dağılımı</Text>

                            {/* Donut Chart - Compact */}
                            <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 12 }}>
                                <DonutChart
                                    data={pieData.map(item => ({
                                        name: item.name,
                                        value: item.population,
                                        color: item.color
                                    }))}
                                    size={180}
                                    strokeWidth={32}
                                    centerText={formatCurrency(totalPortfolioTry, 'TRY').replace('₺', '').trim()}
                                    centerSubtext="₺"
                                    colors={colors}
                                />
                            </View>

                            {/* Legend - 2 Column Grid */}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 8 }}>
                                {pieData.map((item, index) => {
                                    const total = pieData.reduce((sum, d) => sum + d.population, 0);
                                    const percentage = total > 0 ? ((item.population / total) * 100).toFixed(1) : '0.0';

                                    return (
                                        <View
                                            key={index}
                                            style={{
                                                width: '48%',
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: colors.cardBackground,
                                                padding: 8,
                                                borderRadius: 8,
                                                borderLeftWidth: 3,
                                                borderLeftColor: item.color,
                                            }}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 12 * fontScale, color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                            </View>
                                            <Text style={{ fontSize: 13 * fontScale, color: item.color, fontWeight: '700', marginLeft: 4 }}>
                                                %{percentage}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )
                }

                {/* Cash Management - At Bottom */}
                <View style={[styles.insightsRow, { marginTop: 16, marginBottom: 20 }]}>
                    <Card
                        style={[styles.insightCard, { backgroundColor: colors.cardBackground, width: '100%', paddingVertical: 14 }]}
                        borderColor={colors.primary}
                        onPress={() => (navigation as any).navigate('CashManagement')}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <View style={[styles.insightHeader, { marginBottom: 6 }]}>
                                    <Feather name="dollar-sign" size={16} color={colors.primary} />
                                    <Text style={[styles.insightTitle, { color: colors.primary, fontSize: 14 * fontScale }]}>Yedek Akçe</Text>
                                </View>
                                <Text style={[styles.insightText, { color: colors.text, fontWeight: '700', fontSize: 20 * fontScale }]}>
                                    {formatCurrency(cashBalance, 'TRY')}
                                </Text>
                            </View>
                            <Feather name="chevron-right" size={24} color={colors.subText} />
                        </View>
                    </Card>
                </View>
            </ScrollView >

            {/* FAB */}
            < TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => (navigation as any).navigate('AddInstrument')}
            >
                <Feather name="plus" size={24} color="#fff" />
            </TouchableOpacity >

            {/* Critical Updates Modal */}
            < Modal
                visible={marketReportVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setMarketReportVisible(false)}
                onShow={() => fetchMarketReport()}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Günlük Piyasa Raporu</Text>
                            <TouchableOpacity onPress={() => setMarketReportVisible(false)}>
                                <Feather name="x" size={24} color={colors.subText} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.modalDate, { color: colors.subText }]}>
                            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>

                        <ScrollView style={styles.modalBody}>
                            {marketReportData ? (
                                <>
                                    <View style={styles.modalSection}>
                                        <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Piyasa Özeti</Text>
                                        {[
                                            { label: 'BIST 100', data: marketReportData.bist },
                                            { label: 'Dolar/TL', data: marketReportData.usd },
                                            { label: 'Gram Altın', data: marketReportData.gold },
                                            { label: 'Bitcoin', data: marketReportData.btc },
                                        ].map((item, idx) => (
                                            <View key={idx} style={[styles.marketRow, { borderBottomColor: colors.border }]}>
                                                <Text style={[styles.marketLabel, { color: colors.text }]}>{item.label}</Text>
                                                <View style={styles.marketValueContainer}>
                                                    <Text style={[styles.marketValue, { color: colors.text }]}>
                                                        {item.label === 'Bitcoin' ? '$' : ''}
                                                        {formatCurrency(item.data.price, 'TRY').replace('₺', '')}
                                                    </Text>
                                                    <Text style={[styles.marketChange, { color: item.data.change >= 0 ? colors.success : colors.danger }]}>
                                                        {item.data.change >= 0 ? '+' : ''}%{item.data.change.toFixed(2)}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>

                                    <View style={styles.modalSection}>
                                        <View style={styles.noteHeader}>
                                            <Feather name="info" size={16} color={colors.subText} />
                                            <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Piyasa Notları</Text>
                                        </View>
                                        <Text style={[styles.noteText, { color: colors.text }]}>
                                            {marketReportData.bist.change < -1 ? 'BIST 100 endeksinde satış baskısı gözlemleniyor.' :
                                                marketReportData.bist.change > 1 ? 'BIST 100 endeksi günü pozitif seyirle sürdürüyor.' :
                                                    'BIST 100 endeksi yatay seyrediyor.'}
                                            {'\n\n'}
                                            {marketReportData.usd.change > 0.5 ? 'Döviz kurlarında yukarı yönlü hareketlilik var.' : 'Döviz kurları sakin seyrediyor.'}
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal >
        </View >
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
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: -0.5,
    },
    iconButton: {
        padding: 8,
        borderRadius: 20,
    },
    balanceContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    balanceLabel: {
        fontSize: 15,
        marginBottom: 8,
        fontWeight: '500',
    },
    mainBalance: {
        fontSize: 40,
        fontWeight: '700',
        letterSpacing: -1,
        marginBottom: 12,
    },
    subBalanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
    subBalance: {
        fontSize: 15,
        fontWeight: '500',
    },
    divider: {
        width: 1,
        height: 12,
        marginHorizontal: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    statItem: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 13,
        marginBottom: 4,
        fontWeight: '500',
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 17,
        fontWeight: '600',
    },
    statPercent: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    insightsRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 12,
        marginBottom: 8,
    },
    insightCard: {
        flex: 1,
        padding: 12,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    insightTitle: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    insightText: {
        fontSize: 11,
        lineHeight: 14,
        textAlign: 'center',
    },
    starName: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },
    starChange: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    section: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 20,
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    tickerScroll: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    tickerCard: {
        width: 120,
        padding: 12,
        marginRight: 12,
        borderWidth: 1,
    },
    tickerLabel: {
        fontSize: 12,
        marginBottom: 8,
        fontWeight: '500',
    },
    tickerValue: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    tickerChangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    tickerChange: {
        fontSize: 12,
        fontWeight: '500',
    },
    card: {
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        height: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    modalDate: {
        fontSize: 13,
        marginBottom: 24,
    },
    modalBody: {
        flex: 1,
    },
    modalSection: {
        marginBottom: 24,
    },
    modalSectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 12,
    },
    marketRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    marketLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    marketValueContainer: {
        alignItems: 'flex-end',
    },
    marketValue: {
        fontSize: 15,
        fontWeight: '600',
    },
    marketChange: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    noteText: {
        fontSize: 14,
        lineHeight: 22,
    },
});
