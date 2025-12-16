import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
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
import { generateRecommendations, Recommendation } from '../services/advisorService';
import { Skeleton } from '../components/Skeleton';
import { NewsFeed } from '../components/NewsFeed';
import { GradientCard } from '../components/GradientCard';


const screenWidth = Dimensions.get('window').width;
const insightCardWidth = (screenWidth - 58) / 3;

// Responsive breakpoints
const TABLET_WIDTH = 768;
const DESKTOP_WIDTH = 1024;

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
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= TABLET_WIDTH;

    const { colors, fontScale, fonts, heroFontSize, theme } = useTheme();
    const {
        portfolio,
        cashItems,
        cashBalance,
        history,
        updateTotalValue,
        totalRealizedProfitTry,
        totalRealizedProfitUsd
    } = usePortfolio();
    const { marketSummaryVisible, selectedMarketInstruments, portfolioChartVisible, cashThreshold } = useSettings();
    const [refreshing, setRefreshing] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
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
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Render UI first, then load data progressively
    useEffect(() => {
        // Fetch prices immediately (critical for portfolio display)
        fetchPrices();

        // Defer market summary data to load after UI renders
        const marketDataTimer = setTimeout(() => {
            fetchMarketData();
        }, 100);

        refreshIntervalRef.current = setInterval(() => {
            fetchPrices();
            fetchMarketData();
        }, 5 * 60 * 1000); // Auto-refresh every 5 minutes

        return () => {
            clearTimeout(marketDataTimer);
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [portfolio.length]);

    const fetchMarketReport = async () => {
        setMarketReportData(null);
        setRecommendations([]);

        const [bist, usd, gold, btc] = await Promise.all([
            MarketDataService.getYahooPrice('XU100.IS'),
            MarketDataService.getYahooPrice('TRY=X'),
            MarketDataService.getGoldPrice('gram'),
            MarketDataService.getCryptoPrice('bitcoin'),
        ]);

        const currentUsdRate = usd?.currentPrice || usdRate || 30;

        setMarketReportData({
            bist: { price: bist?.currentPrice || 0, change: bist?.change24h || 0 },
            usd: { price: currentUsdRate, change: usd?.change24h || 0 },
            gold: { price: gold?.currentPrice || 0, change: gold?.change24h || 0 },
            btc: { price: btc?.currentPrice || 0, change: btc?.change24h || 0 },
        });

        // Generate personalized recommendations
        const recs = generateRecommendations(
            portfolio,
            prices,
            dailyChanges,
            cashBalance,
            currentUsdRate,
            history,
            cashThreshold
        );
        setRecommendations(recs);
    };

    const fetchMarketData = async () => {
        try {
            // Fetch all market data in parallel for faster loading
            const [usdData, goldData, silverData, bist, btc, eth] = await Promise.all([
                MarketDataService.getYahooPrice('TRY=X'),
                MarketDataService.getGoldPrice('gram'),
                MarketDataService.getSilverPrice('gram'),
                MarketDataService.getYahooPrice('XU100.IS'),
                MarketDataService.getCryptoPrice('bitcoin'),
                MarketDataService.getCryptoPrice('ethereum'),
            ]);

            // Set all values at once
            if (usdData?.currentPrice) setUsdRate(usdData.currentPrice);
            if (goldData?.currentPrice) setGoldPrice(goldData.currentPrice);
            if (silverData?.currentPrice) setSilverPrice(silverData.currentPrice);
            if (bist?.currentPrice) setBistData({ price: bist.currentPrice, change: (bist as any).change24h || 0 });
            if (btc?.currentPrice) setBtcPrice({ price: btc.currentPrice, change: (btc as any).change24h || 0 });
            if (eth?.currentPrice) setEthPrice({ price: eth.currentPrice, change: (eth as any).change24h || 0 });

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
        setIsInitialLoading(false);
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
            // Use customCurrentPrice for custom assets, otherwise use fetched price
            let price = item.customCurrentPrice || prices[item.instrumentId] || 0;
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

    // Sync calculated totals with Context (for History Tracking)
    useEffect(() => {
        if (totalPortfolioTry > 0) {
            // Debounce updates to prevent excessive storage writes/renders
            const timer = setTimeout(() => {
                updateTotalValue(totalPortfolioTry, totalPortfolioUsd);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [totalPortfolioTry, totalPortfolioUsd]);

    // Generate news keywords from portfolio
    const newsKeywords = React.useMemo(() => {
        // If portfolio has items, prioritize them. Otherwise fallback to general market terms.
        const baseKeywords = portfolio.length > 0 ? ['Borsa İstanbul'] : ['Borsa İstanbul', 'Ekonomi', 'Altın', 'Dolar'];

        // Add top 5 assets (increased from 3 to cover more of user's portfolio)
        const topAssets = [...portfolio]
            .slice(0, 5)
            .map(item => {
                let symbol = item.instrumentId;
                if (symbol.endsWith('.IS')) symbol = symbol.replace('.IS', '');
                return symbol;
            });

        return [...baseKeywords, ...topAssets];
    }, [portfolio]);

    // Category calculations (still computed on render)
    const categoryValues: Record<string, number> = {};
    let bestPerformer = { id: '', change: -Infinity };
    let worstPerformer = { id: '', change: Infinity };

    portfolio.forEach(item => {
        // Use customCurrentPrice for custom assets, otherwise use fetched price
        let price = item.customCurrentPrice || prices[item.instrumentId] || 0;
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

        // Custom category takes priority (for KFS, custom assets, etc.)
        if (item.customCategory) {
            category = item.customCategory;
        }
        // Crypto - check by type or known IDs
        else if (item.type === 'crypto' || ['BTC', 'ETH', 'SOL', 'AVAX', 'USDT', 'USDC', 'BNB', 'WLD', 'WORLDCOIN-WLD'].includes(id)) {
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
        // US ETFs - check before generic USD
        else if (item.currency === 'USD' && (item.type === 'stock' || ['VOO', 'QQQ', 'SPY', 'VTI', 'SCHD', 'JEPI', 'ARKK', 'SCHG', 'OPTGY', 'OPT25'].includes(id))) {
            category = 'ABD ETF';
        }
        // Forex (USD, EUR, etc.)
        else if (['USD', 'EUR', 'GBP', 'JPY'].includes(id)) {
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
    const portfolioInUsd = usdRate > 0 ? totalPortfolioTry / usdRate : 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
            >
                {/* Responsive Layout Content */}
                {isLargeScreen ? (
                    <View style={{ paddingHorizontal: 20, gap: 20 }}>
                        {/* WEB HEADER (Full Width) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20 }}>
                            <PortfolioSwitcher prices={prices} dailyChanges={dailyChanges} usdRate={usdRate} goldPrice={goldPrice} />
                            <TouchableOpacity
                                onPress={() => (navigation as any).navigate('Settings')}
                                style={{ padding: 8, backgroundColor: colors.cardBackground, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
                            >
                                <Feather name="settings" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
                            {/* LEFT COLUMN (Main Content) - Flex 3 */}
                            <View style={{ flex: 3, gap: 16 }}>
                                {/* Total Assets Card */}
                                <GradientCard
                                    variant="primary"
                                    style={{ borderRadius: 24, padding: 0 }}
                                    contentStyle={{ padding: 24 }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View>
                                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>TOPLAM VARLIK</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                                <Text style={{ color: '#fff', fontSize: heroFontSize, fontWeight: '800' }}>
                                                    {isHidden ? '******' : formatCurrency(totalPortfolioTry, 'TRY')}
                                                </Text>
                                            </View>

                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8 }}>
                                                {isHidden ? '****' : `$${portfolioInUsd.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`} · {isHidden ? '**' : portfolioInGramGold.toFixed(1)} gr altın
                                            </Text>
                                        </View>

                                        <TouchableOpacity onPress={() => setIsHidden(!isHidden)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
                                            <Feather name={isHidden ? "eye-off" : "eye"} size={20} color="rgba(255,255,255,0.8)" />
                                        </TouchableOpacity>
                                    </View>
                                </GradientCard>

                                {/* Portfolio Chart */}
                                {!isInitialLoading && portfolioChartVisible && (
                                    <View style={{ height: 300, width: '100%', overflow: 'hidden' }}>
                                        <PortfolioChart currentValue={totalPortfolioTry} history={history} />
                                    </View>
                                )}

                                {/* Portfolio Distribution (Donut) */}
                                {portfolio.length > 0 && (
                                    <View style={[styles.section, { marginTop: 0 }]}>
                                        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 16 * fontScale, marginLeft: 0, marginBottom: 12 }]}>Portföy Dağılımı</Text>
                                        <GradientCard
                                            variant="secondary"
                                            style={{ borderWidth: 1, borderColor: colors.border }}
                                            contentStyle={{ padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                        >
                                            {isInitialLoading ? (
                                                <Skeleton width="100%" height={200} />
                                            ) : (
                                                <>
                                                    <View style={{ marginRight: 30 }}>
                                                        <DonutChart
                                                            data={pieData.map(item => ({ name: item.name, value: item.population, color: item.color }))}
                                                            size={180}
                                                            strokeWidth={20}
                                                            centerText={isHidden ? '••••' : formatCurrency(totalPortfolioTry, 'TRY').replace('₺', '').trim()}
                                                            centerTextFontSize={22}
                                                            centerSubtext="₺"
                                                            colors={colors}
                                                        />
                                                    </View>
                                                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                                        {pieData.map((item, index) => {
                                                            const total = pieData.reduce((sum, d) => sum + d.population, 0);
                                                            const percentage = total > 0 ? ((item.population / total) * 100).toFixed(1) : '0.0';
                                                            return (
                                                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', width: '45%', marginBottom: 4 }}>
                                                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 8 }} />
                                                                    <View>
                                                                        <Text style={{ fontSize: 13 * fontScale, color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                                                                        <Text style={{ fontSize: 13 * fontScale, color: colors.subText, fontWeight: '700' }}>%{percentage}</Text>
                                                                    </View>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                </>
                                            )}
                                        </GradientCard>
                                    </View>
                                )}
                            </View>

                            {/* RIGHT COLUMN (Stats & Insights) - Flex 2 */}
                            <View style={{ flex: 2, gap: 16 }}>

                                {/* Stats Grid - Vertical on Web Right Col */}
                                <View style={{ gap: 12 }}>
                                    {/* Toplam K/Z */}
                                    <GradientCard variant="secondary" style={[styles.statItem, { padding: 0, minHeight: 80, width: '100%', borderWidth: 1, borderColor: totalUnrealizedProfitTry >= 0 ? colors.success : colors.danger }]} contentStyle={{ padding: 16 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={[styles.statLabel, { color: colors.subText }]}>Toplam K/Z</Text>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={[styles.statValue, { color: totalUnrealizedProfitTry >= 0 ? colors.success : colors.danger }]}>
                                                    {isHidden ? '•••' : `${totalUnrealizedProfitTry >= 0 ? '+' : ''}${formatCurrency(totalUnrealizedProfitTry, 'TRY')} `}
                                                </Text>
                                                <Text style={[styles.statPercent, { color: totalUnrealizedProfitPercent >= 0 ? colors.success : colors.danger, fontSize: 12 }]}>
                                                    {isHidden ? '•••' : `% ${totalUnrealizedProfitPercent.toFixed(2)} `}
                                                </Text>
                                            </View>
                                        </View>
                                    </GradientCard>

                                    {/* Günlük */}
                                    <GradientCard variant="secondary" style={[styles.statItem, { padding: 0, minHeight: 80, width: '100%', borderWidth: 1, borderColor: dailyProfit >= 0 ? colors.success : colors.danger }]} contentStyle={{ padding: 16 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={[styles.statLabel, { color: colors.subText }]}>Günlük</Text>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={[styles.statValue, { color: dailyProfit >= 0 ? colors.success : colors.danger }]}>
                                                    {isHidden ? '•••' : `${dailyProfit >= 0 ? '+' : ''}${formatCurrency(dailyProfit, 'TRY')} `}
                                                </Text>
                                                <Text style={[styles.statPercent, { color: dailyProfit >= 0 ? colors.success : colors.danger, fontSize: 12 }]}>
                                                    {isHidden ? '•••' : `% ${dailyProfitPercent.toFixed(2)} `}
                                                </Text>
                                            </View>
                                        </View>
                                    </GradientCard>
                                </View>

                                {/* Market Insights - Vertical */}
                                <View style={{ gap: 12 }}>
                                    <GradientCard variant="secondary" style={[styles.insightCard, { padding: 0, width: '100%', borderWidth: 1, borderColor: colors.success }]} contentStyle={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => { if (bestPerformer.id && bestPerformer.id !== '-') { const instrument = portfolio.find(p => p.instrumentId === bestPerformer.id); if (instrument) (navigation as any).navigate('AssetDetail', { id: instrument.id }); } }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Feather name="trending-up" size={16} color={colors.success} />
                                            <Text style={[styles.insightTitle, { color: colors.success, marginBottom: 0 }]}>En İyi</Text>
                                        </View>
                                        <Text style={[styles.insightText, { color: colors.text }]}>{bestPerformer.id ? `${bestPerformer.id}: +${bestPerformer.change.toFixed(2)}%` : '-'}</Text>
                                    </GradientCard>

                                    <GradientCard variant="secondary" style={[styles.insightCard, { padding: 0, width: '100%', borderWidth: 1, borderColor: colors.danger }]} contentStyle={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => { if (worstPerformer.id && worstPerformer.id !== '-') { const instrument = portfolio.find(p => p.instrumentId === worstPerformer.id); if (instrument) (navigation as any).navigate('AssetDetail', { id: instrument.id }); } }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Feather name="trending-down" size={16} color={colors.danger} />
                                            <Text style={[styles.insightTitle, { color: colors.danger, marginBottom: 0 }]}>En Kötü</Text>
                                        </View>
                                        <Text style={[styles.insightText, { color: colors.text }]}>{worstPerformer.id ? `${worstPerformer.id}: ${worstPerformer.change.toFixed(2)}%` : '-'}</Text>
                                    </GradientCard>
                                </View>

                                {/* Cash Management */}
                                <GradientCard variant="secondary" style={[styles.insightCard, { backgroundColor: 'transparent', width: '100%', padding: 0, borderColor: colors.primary }]} contentStyle={{ paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => (navigation as any).navigate('CashManagement')}>
                                    <Text style={[styles.insightTitle, { color: colors.primary, fontSize: 14 * fontScale, marginBottom: 0 }]}>Yedek Akçe</Text>
                                    <Text style={[styles.statValue, { color: colors.text, marginBottom: 0, fontSize: 16 * fontScale }]}>{isHidden ? '••••••' : formatCurrency(cashBalance, 'TRY')}</Text>
                                </GradientCard>

                                {/* Market Summary Ticker (Compact List) */}
                                {marketSummaryVisible && (
                                    <View style={[styles.section, { marginTop: 0 }]}>
                                        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 14, marginBottom: 8 }]}>Piyasa Özeti</Text>
                                        <View style={{ gap: 8 }}>
                                            {[
                                                { id: 'USD/TRY', label: 'USD/TRY', value: usdRate, change: dailyChanges['USD'] || 0, currency: 'TRY' },
                                                { id: 'Gram Altın', label: 'Gram Altın', value: goldPrice, change: 0.5, currency: 'TRY' },
                                                { id: 'BIST 100', label: 'BIST 100', value: bistData?.price, change: bistData?.change || 0, currency: 'TRY' },
                                            ].filter(item => selectedMarketInstruments.includes(item.id)).map((item, index) => (
                                                <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: colors.cardBackground, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                                                    <Text style={{ color: colors.subText }}>{item.label}</Text>
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        <Text style={{ color: colors.text, fontWeight: '600' }}>{item.value ? formatCurrency(item.value, item.currency as any) : '-'}</Text>
                                                        <Text style={{ color: item.change >= 0 ? colors.success : colors.danger }}>%{Math.abs(item.change).toFixed(2)}</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}

                            </View>
                        </View>
                    </View>
                ) : (
                    // MOBILE LAYOUT (Existing)
                    <>
                        {/* Header Section */}
                        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingHorizontal: 20 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                                <PortfolioSwitcher prices={prices} dailyChanges={dailyChanges} usdRate={usdRate} goldPrice={goldPrice} />
                                <TouchableOpacity
                                    onPress={() => (navigation as any).navigate('Settings')}
                                    style={{ padding: 8, backgroundColor: colors.cardBackground, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Feather name="settings" size={20} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <GradientCard
                                variant="primary"
                                style={{
                                    borderRadius: 24,
                                    marginBottom: 6,
                                    padding: 0
                                }}
                                contentStyle={{
                                    padding: 24
                                }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View>
                                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>TOPLAM VARLIK</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                            <Text style={{ color: '#fff', fontSize: heroFontSize, fontWeight: '800' }}>
                                                {isHidden ? '******' : formatCurrency(totalPortfolioTry, 'TRY')}
                                            </Text>
                                        </View>

                                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8 }}>
                                            {isHidden ? '****' : `$${portfolioInUsd.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`} · {isHidden ? '**' : portfolioInGramGold.toFixed(1)} gr altın
                                        </Text>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => setIsHidden(!isHidden)}
                                        style={{
                                            padding: 8,
                                            backgroundColor: 'rgba(255,255,255,0.1)',
                                            borderRadius: 12
                                        }}
                                    >
                                        <Feather name={isHidden ? "eye-off" : "eye"} size={20} color="rgba(255,255,255,0.8)" />
                                    </TouchableOpacity>
                                </View>
                            </GradientCard>
                        </View>

                        {/* Portfolio History Chart */}
                        {
                            !isInitialLoading && portfolioChartVisible && (
                                <PortfolioChart currentValue={totalPortfolioTry} history={history} />
                            )
                        }

                        {/* Stats Grid - 3 columns */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, justifyContent: 'flex-start' }}>
                            <GradientCard
                                variant="secondary"
                                style={[styles.statItem, { width: '24%', padding: 0, minHeight: 70, borderWidth: 1, borderColor: totalUnrealizedProfitTry >= 0 ? colors.success : colors.danger }]}
                                contentStyle={{ padding: 12, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <Text style={[styles.statLabel, { color: colors.subText }]}>Toplam K/Z</Text>
                                {isInitialLoading ? (
                                    <View style={{ gap: 4 }}>
                                        <Skeleton width="80%" height={16} />
                                        <Skeleton width="60%" height={12} />
                                    </View>
                                ) : (
                                    <>
                                        <View style={styles.statValueRow}>
                                            <Text style={[styles.statValue, { color: totalUnrealizedProfitTry >= 0 ? colors.success : colors.danger }]}>
                                                {isHidden ? '•••' : `${totalUnrealizedProfitTry >= 0 ? '+' : ''}${formatCurrency(totalUnrealizedProfitTry, 'TRY')} `}
                                            </Text>
                                        </View>
                                        <Text style={[styles.statPercent, { color: totalUnrealizedProfitPercent >= 0 ? colors.success : colors.danger, fontSize: 11 }]}>
                                            {isHidden ? '•••' : `${(totalUnrealizedProfitTry / (usdRate || 1)) >= 0 ? '+' : ''}${formatCurrency(totalUnrealizedProfitTry / (usdRate || 1), 'USD')} | % ${totalUnrealizedProfitPercent.toFixed(2)} `}
                                        </Text>
                                    </>
                                )}
                            </GradientCard>

                            <GradientCard
                                variant="secondary"
                                style={[styles.statItem, { width: '24%', padding: 0, minHeight: 70, borderWidth: 1, borderColor: dailyProfit >= 0 ? colors.success : colors.danger }]}
                                contentStyle={{ padding: 12, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <Text style={[styles.statLabel, { color: colors.subText }]}>Günlük</Text>
                                {isInitialLoading ? (
                                    <View style={{ gap: 4 }}>
                                        <Skeleton width="80%" height={16} />
                                        <Skeleton width="60%" height={12} />
                                    </View>
                                ) : (
                                    <>
                                        <View style={styles.statValueRow}>
                                            <Text style={[styles.statValue, { color: dailyProfit >= 0 ? colors.success : colors.danger }]}>
                                                {isHidden ? '•••' : `${dailyProfit >= 0 ? '+' : ''}${formatCurrency(dailyProfit, 'TRY')} `}
                                            </Text>
                                        </View>
                                        <Text style={[styles.statPercent, { color: dailyProfit >= 0 ? colors.success : colors.danger }]}>
                                            {isHidden ? '•••' : `% ${dailyProfitPercent.toFixed(2)} `}
                                        </Text>
                                    </>
                                )}
                            </GradientCard>

                            <GradientCard
                                variant="secondary"
                                style={[styles.statItem, { width: '24%', padding: 0, minHeight: 70, borderWidth: 1, borderColor: totalRealizedProfitTry >= 0 ? colors.success : colors.danger }]}
                                contentStyle={{ padding: 12, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <Text style={[styles.statLabel, { color: colors.subText }]}>Gerçekleşen</Text>
                                {isInitialLoading ? (
                                    <Skeleton width="80%" height={16} />
                                ) : (
                                    <View style={styles.statValueRow}>
                                        <Text style={[styles.statValue, { color: totalRealizedProfitTry >= 0 ? colors.success : colors.danger }]}>
                                            {isHidden ? '•••' : `${totalRealizedProfitTry >= 0 ? '+' : ''}${formatCurrency(totalRealizedProfitTry, 'TRY')} `}
                                        </Text>
                                    </View>
                                )}
                            </GradientCard>

                            <GradientCard
                                variant="secondary"
                                style={[styles.statItem, { width: '24%', padding: 0, minHeight: 70, borderWidth: 1, borderColor: colors.warning }]}
                                contentStyle={{ padding: 12, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <Text style={[styles.statLabel, { color: colors.subText }]}>Riskteki Para</Text>
                                {isInitialLoading ? (
                                    <View style={{ gap: 4 }}>
                                        <Skeleton width="80%" height={16} />
                                        <Skeleton width="60%" height={12} />
                                    </View>
                                ) : (
                                    <>
                                        <View style={styles.statValueRow}>
                                            <Text style={[styles.statValue, { color: colors.warning }]}>
                                                {isHidden ? '•••' : formatCurrency(Math.max(0, totalCostBasisTry - totalRealizedProfitTry), 'TRY')}
                                            </Text>
                                        </View>
                                        <Text style={[styles.statPercent, { color: colors.subText, fontSize: 10 }]}>
                                            {isHidden ? '•••' : `Anapara: ${formatCurrency(totalCostBasisTry, 'TRY')}`}
                                        </Text>
                                    </>
                                )}
                            </GradientCard>
                        </View>

                        {/* Market Insights Cards */}
                        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 6, marginTop: 6, marginBottom: 8 }}>
                            <GradientCard
                                variant="secondary"
                                style={[styles.insightCard, { padding: 0, minHeight: 70, borderWidth: 1, borderColor: colors.success }]}
                                contentStyle={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => {
                                    if (bestPerformer.id && bestPerformer.id !== '-') {
                                        // Find instrument in portfolio to get full object if needed, or pass partial
                                        const instrument = portfolio.find(p => p.instrumentId === bestPerformer.id);
                                        if (instrument) {
                                            (navigation as any).navigate('AssetDetail', { id: instrument.id });
                                        }
                                    }
                                }}
                            >
                                <View style={styles.insightHeader}>
                                    <Feather name="trending-up" size={14} color={colors.success} />
                                    <Text style={[styles.insightTitle, { color: colors.success }]}>En İyi</Text>
                                </View>
                                {isInitialLoading ? (
                                    <Skeleton width="100%" height={16} />
                                ) : (
                                    <Text style={[styles.insightText, { color: colors.text }]} numberOfLines={2}>
                                        {bestPerformer.id ? `${bestPerformer.id}: +${bestPerformer.change.toFixed(2)}%` : '-'}
                                    </Text>
                                )}
                            </GradientCard>

                            <GradientCard
                                variant="secondary"
                                style={[styles.insightCard, { padding: 0, minHeight: 70, borderWidth: 1, borderColor: colors.danger }]}
                                contentStyle={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => {
                                    if (worstPerformer.id && worstPerformer.id !== '-') {
                                        const instrument = portfolio.find(p => p.instrumentId === worstPerformer.id);
                                        if (instrument) {
                                            (navigation as any).navigate('AssetDetail', { id: instrument.id });
                                        }
                                    }
                                }}
                            >
                                <View style={styles.insightHeader}>
                                    <Feather name="trending-down" size={14} color={colors.danger} />
                                    <Text style={[styles.insightTitle, { color: colors.danger }]}>En Kötü</Text>
                                </View>
                                {isInitialLoading ? (
                                    <Skeleton width="100%" height={16} />
                                ) : (
                                    <Text style={[styles.insightText, { color: colors.text }]} numberOfLines={2}>
                                        {worstPerformer.id ? `${worstPerformer.id}: ${worstPerformer.change.toFixed(2)}%` : '-'}
                                    </Text>
                                )}
                            </GradientCard>

                            <GradientCard
                                variant="secondary"
                                style={[styles.insightCard, { padding: 0, minHeight: 70, borderWidth: 1, borderColor: colors.primary }]}
                                contentStyle={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => setMarketReportVisible(true)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.insightHeader}>
                                    <Feather name="bar-chart-2" size={14} color={colors.primary} />
                                    <Text style={[styles.insightTitle, { color: colors.primary }]}>Piyasa</Text>
                                </View>
                                {isInitialLoading ? (
                                    <Skeleton width="100%" height={16} />
                                ) : (
                                    <Text style={[styles.insightText, { color: colors.text }]} numberOfLines={2}>
                                        Günlük Raporu
                                    </Text>
                                )}
                            </GradientCard>
                        </View >



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
                                                <GradientCard key={index} variant="secondary" style={[styles.tickerCard, { backgroundColor: 'transparent', padding: 0, width: insightCardWidth, borderColor: colors.border }]} contentStyle={{ padding: 8, alignItems: 'center', justifyContent: 'center' }}>
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
                                                </GradientCard>
                                            ))}
                                    </ScrollView >
                                </View >
                            )
                        }

                        {/* Portfolio Distribution */}
                        {
                            portfolio.length > 0 && (
                                <View style={[styles.section, { marginTop: 8 }]}>
                                    <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 16 * fontScale, textAlign: 'center', marginLeft: 0 }]}>Portföy Dağılımı</Text>

                                    {/* Donut Chart - Compact */}
                                    <GradientCard
                                        variant="secondary"
                                        style={{
                                            marginBottom: 12,
                                            marginHorizontal: 20,
                                            borderWidth: 1,
                                            borderColor: colors.border
                                        }}
                                        contentStyle={{
                                            padding: 16,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        {isInitialLoading ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                                                <Skeleton width={120} height={120} borderRadius={60} />
                                                <View style={{ flex: 1, marginLeft: 20, gap: 10 }}>
                                                    <Skeleton width="100%" height={16} />
                                                    <Skeleton width="100%" height={16} />
                                                    <Skeleton width="100%" height={16} />
                                                </View>
                                            </View>
                                        ) : (
                                            <>
                                                {/* Left: Chart */}
                                                <View style={{ marginRight: 20 }}>
                                                    <DonutChart
                                                        data={pieData.map(item => ({
                                                            name: item.name,
                                                            value: item.population,
                                                            color: item.color
                                                        }))}
                                                        size={120}
                                                        strokeWidth={16}
                                                        centerText={isHidden ? '••••' : formatCurrency(totalPortfolioTry, 'TRY').replace('₺', '').trim()}
                                                        centerSubtext="₺"
                                                        colors={colors}
                                                    />
                                                </View>

                                                {/* Right: Legend List */}
                                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                                    {pieData.map((item, index) => {
                                                        const total = pieData.reduce((sum, d) => sum + d.population, 0);
                                                        const percentage = total > 0 ? ((item.population / total) * 100).toFixed(1) : '0.0';

                                                        return (
                                                            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' }}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginRight: 8 }} />
                                                                    <Text style={{ fontSize: 13 * fontScale, color: colors.text, fontWeight: '500' }} numberOfLines={1}>
                                                                        {item.name}
                                                                    </Text>
                                                                </View>
                                                                <Text style={{ fontSize: 13 * fontScale, color: colors.text, fontWeight: '700' }}>
                                                                    %{percentage}
                                                                </Text>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            </>
                                        )}
                                    </GradientCard>
                                </View>
                            )
                        }

                        {/* Cash Management - At Bottom */}
                        <View style={[styles.insightsRow, { marginTop: 12, marginBottom: 20 }]}>
                            <GradientCard
                                variant="secondary"
                                style={[styles.insightCard, { backgroundColor: 'transparent', width: '100%', padding: 0, borderColor: colors.primary, minHeight: 0 }]}
                                contentStyle={{ paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                onPress={() => (navigation as any).navigate('CashManagement')}
                            >
                                <Text style={[styles.insightTitle, { color: colors.primary, fontSize: 14 * fontScale, marginBottom: 0 }]}>Yedek Akçe</Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    {isInitialLoading ? (
                                        <Skeleton width={100} height={20} />
                                    ) : (
                                        <Text style={[styles.statValue, { color: colors.text, marginBottom: 0, fontSize: 16 * fontScale }]}>
                                            {isHidden ? '••••••' : formatCurrency(cashBalance, 'TRY')}
                                        </Text>
                                    )}
                                    <Feather name="chevron-right" size={20} color={colors.subText} />
                                </View>
                            </GradientCard>
                        </View>
                    </>
                )}
            </ScrollView>
            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => (navigation as any).navigate('AddInstrument')}
            >
                <Feather name="plus" size={24} color="#fff" />
            </TouchableOpacity>


            {/* Critical Updates Modal */}
            <Modal
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
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                            {[
                                                { label: 'BIST', data: marketReportData.bist },
                                                { label: '$/₺', data: marketReportData.usd },
                                                { label: 'Altın', data: marketReportData.gold },
                                                { label: 'BTC', data: marketReportData.btc },
                                            ].map((item, idx) => (
                                                <View
                                                    key={idx}
                                                    style={[
                                                        styles.compactMarketCard,
                                                        {
                                                            backgroundColor: colors.background,
                                                            borderColor: colors.border
                                                        }
                                                    ]}
                                                >
                                                    <Text style={[styles.compactMarketLabel, { color: colors.subText }]}>{item.label}</Text>
                                                    <Text style={[styles.compactMarketValue, { color: colors.text }]}>
                                                        {item.label === 'BTC' ? '$' : ''}{formatCurrency(item.data.price, 'TRY').replace('₺', '')}
                                                    </Text>
                                                    <Text style={[styles.compactMarketChange, { color: item.data.change >= 0 ? colors.success : colors.danger }]}>
                                                        {item.data.change >= 0 ? '↑' : '↓'}{Math.abs(item.data.change).toFixed(1)}%
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Comprehensive Market Commentary */}
                                    <View style={styles.modalSection}>
                                        <View style={styles.noteHeader}>
                                            <Feather name="trending-up" size={16} color={colors.primary} />
                                            <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Günün Piyasa Yorumu</Text>
                                        </View>
                                        <Text style={[styles.noteText, { color: colors.text, lineHeight: 24 }]}>
                                            {/* Market sentiment based on all indicators */}
                                            {(() => {
                                                const bistTrend = marketReportData.bist.change;
                                                const usdTrend = marketReportData.usd.change;
                                                const goldTrend = marketReportData.gold.change;
                                                const btcTrend = marketReportData.btc.change;

                                                let commentary = '';

                                                // Overall market sentiment
                                                if (bistTrend > 1 && usdTrend < 0.3) {
                                                    commentary = '📈 Bugün borsada risk iştahı yüksek görünüyor. BIST pozitif seyrederken TL değer kazanıyor, bu hisse senetleri için olumlu bir ortam yaratıyor.';
                                                } else if (bistTrend < -1 && usdTrend > 0.5) {
                                                    commentary = '📉 Piyasalarda tedirginlik hakim. Yatırımcılar güvenli liman arayışında, bu dönemde temkinli olmakta fayda var.';
                                                } else if (bistTrend > 0 && goldTrend > 0.5) {
                                                    commentary = '🏆 Hem borsa hem altın yükseliyor - bu genellikle enflasyonist beklentilere işaret ediyor.';
                                                } else if (btcTrend > 3) {
                                                    commentary = '₿ Kripto paralarda hareketli bir gün! Bitcoin %' + btcTrend.toFixed(1) + ' yükseldi. Riskli varlıklara ilgi artıyor.';
                                                } else if (btcTrend < -3) {
                                                    commentary = '₿ Kripto piyasasında düzeltme yaşanıyor. Uzun vadeli yatırımcılar için alım fırsatı olabilir.';
                                                } else if (Math.abs(bistTrend) < 0.5 && Math.abs(usdTrend) < 0.3) {
                                                    commentary = '⏸️ Piyasalar bugün sakin bir seyir izliyor. Yatırımcılar bekle-gör modunda.';
                                                } else {
                                                    commentary = '📊 Piyasalar bugün karışık sinyaller veriyor. BIST ' + (bistTrend >= 0 ? '+' : '') + bistTrend.toFixed(1) + '%, Dolar ' + (usdTrend >= 0 ? '+' : '') + usdTrend.toFixed(1) + '%.';
                                                }

                                                // Add portfolio-specific insight
                                                if (portfolio.length > 0) {
                                                    commentary += '\n\n💼 Portföyünüzde ' + portfolio.length + ' farklı varlık bulunuyor.';
                                                }

                                                return commentary;
                                            })()}
                                        </Text>
                                    </View>

                                    {/* Personalized Recommendations */}
                                    {recommendations.length > 0 && (
                                        <View style={styles.modalSection}>
                                            <View style={styles.noteHeader}>
                                                <Feather name="zap" size={16} color={colors.primary} />
                                                <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Kişisel Asistan</Text>
                                            </View>
                                            {recommendations.map((rec, idx) => (
                                                <View
                                                    key={rec.id}
                                                    style={[
                                                        styles.recommendationCard,
                                                        {
                                                            backgroundColor: rec.type === 'warning' ? 'rgba(255, 149, 0, 0.1)' :
                                                                rec.type === 'opportunity' ? 'rgba(0, 122, 255, 0.1)' :
                                                                    rec.type === 'success' ? 'rgba(52, 199, 89, 0.1)' :
                                                                        'rgba(142, 142, 147, 0.1)',
                                                            borderLeftColor: rec.type === 'warning' ? '#FF9500' :
                                                                rec.type === 'opportunity' ? '#007AFF' :
                                                                    rec.type === 'success' ? '#34C759' :
                                                                        colors.subText,
                                                        }
                                                    ]}
                                                >
                                                    <View style={styles.recommendationHeader}>
                                                        <Text style={styles.recommendationIcon}>{rec.icon}</Text>
                                                        <Text style={[styles.recommendationTitle, { color: colors.text }]}>{rec.title}</Text>
                                                    </View>
                                                    <Text style={[styles.recommendationDesc, { color: colors.subText }]}>{rec.description}</Text>
                                                    {rec.action && (
                                                        <Text style={[styles.recommendationAction, { color: colors.primary }]}>💡 {rec.action}</Text>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </>
                            ) : (
                                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                            )}

                            {/* News Feed - Always visible in modal */}
                            <View style={{ marginTop: 24, paddingBottom: 40, paddingHorizontal: 4 }}>
                                <NewsFeed keywords={newsKeywords} />
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal >

            {/* AI Assistant FAB */}

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
        paddingTop: Platform.OS === 'ios' ? 20 : 10,
        paddingBottom: 16,
        paddingHorizontal: 20,
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
        width: '24%', // 4 columns - smaller cards
        minWidth: 100,
        padding: 8,
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
        padding: 8,
        height: 64,
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
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 100,
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
    recommendationCard: {
        padding: 14,
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 4,
    },
    recommendationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    recommendationIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    recommendationTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    recommendationDesc: {
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 6,
    },
    recommendationAction: {
        fontSize: 13,
        fontWeight: '500',
    },
    compactMarketCard: {
        flex: 1,
        minWidth: '22%',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    fabBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    fabBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    compactMarketLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 4,
    },
    compactMarketValue: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    compactMarketChange: {
        fontSize: 11,
        fontWeight: '600',
    },
});
