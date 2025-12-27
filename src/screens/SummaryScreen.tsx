import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, Platform, useWindowDimensions, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Eye, EyeOff, Briefcase, TrendingUp, TrendingDown, Calendar, CheckSquare, Archive, Download, MoreHorizontal, Shield, Activity, Settings, Plus, X, ChevronRight, Zap, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';

import { PortfolioSwitcher } from '../components/PortfolioSwitcher';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';
import { MarketDataService } from '../services/marketData';
import { formatCurrency } from '../utils/formatting';
import { ShareableDonutChart, ShareableDonutChartHandle } from '../components/ShareableDonutChart';
import { PortfolioChart, PortfolioChartHandle } from '../components/PortfolioChart';
import { generateRecommendations, Recommendation } from '../services/advisorService';
import { Skeleton } from '../components/Skeleton';
import { NewsFeed } from '../components/NewsFeed';
import { GradientCard } from '../components/GradientCard';
import html2canvas from 'html2canvas';
// @ts-ignore
import ViewShot from 'react-native-view-shot';


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
        history,
        totalValueTry,
        totalValueUsd,
        cashBalance,
        updateTotalValue,
        totalRealizedProfitTry,
        totalRealizedProfitUsd,
        prices: contextPrices,
        dailyChanges: contextDailyChanges,
        currentUsdRate: contextUsdRate,
        lastPricesUpdate,
        refreshAllPrices,
        activePortfolio
    } = usePortfolio();

    const donutChartRef = useRef<ShareableDonutChartHandle>(null);
    const portfolioChartRef = useRef<PortfolioChartHandle>(null);
    const { marketSummaryVisible, selectedMarketInstruments, portfolioChartVisible, cashThreshold } = useSettings();
    const [refreshing, setRefreshing] = useState(false);

    // Local state for managed data
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Persist portfolio values for UI
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
    const [fundPrices, setFundPrices] = useState<Record<string, number>>({});
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const distCardWebRef = useRef<any>(null);
    const distCardMobileRef = useRef<any>(null);

    const captureDistributionCard = async () => {
        try {
            if (donutChartRef.current) {
                await donutChartRef.current.captureImage();
            } else {
                console.warn('⚠️ donutChartRef is not ready');
            }
        } catch (error) {
            console.error('Capture error:', error);
            Alert.alert('Hata', 'Görsel oluşturulamadı.');
        }
    };

    // Render UI first, then load data progressively
    useEffect(() => {
        // Defer market summary data to load after UI renders
        const marketDataTimer = setTimeout(() => {
            fetchMarketData();
        }, 100);

        const mInterval = setInterval(() => {
            fetchMarketData();
        }, 5 * 60 * 1000); // Auto-refresh market data every 5 minutes

        return () => {
            clearTimeout(marketDataTimer);
            clearInterval(mInterval);
        };
    }, []);

    const prices = contextPrices;
    const dailyChanges = contextDailyChanges;
    const usdRate = contextUsdRate;

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
            // Context handles currentUsdRate
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
        await Promise.all([
            refreshAllPrices(),
            fetchMarketData()
        ]);
        setRefreshing(false);
    };

    const fetchPrices = async () => {
        // This is now handled by Context.refreshAllPrices()
        // But we still need to fetch fund prices for PPF if not moved to context yet.
        const fundItems = cashItems.filter(item => item.type === 'money_market_fund' && item.instrumentId);
        const newFundPrices: Record<string, number> = {};
        for (const item of fundItems) {
            if (item.instrumentId) {
                try {
                    const priceResult = await MarketDataService.getTefasPrice(item.instrumentId);
                    if (priceResult && priceResult.currentPrice) {
                        newFundPrices[item.instrumentId] = priceResult.currentPrice;
                    }
                } catch (error) {
                    console.error('Error fetching fund price:', error);
                }
            }
        }
        setFundPrices(newFundPrices);
        setIsInitialLoading(false);
    };

    // Immediate load on mount
    useEffect(() => {
        fetchPrices(); // Fund prices
        fetchMarketData();
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

        // Add Cash (includes PPF at cost basis)
        calcTotalTry += cashBalance;
        calcTotalUsd += cashBalance / (usdRate || 1);

        // Add PPF profit (difference between current value and cost)
        let ppfProfit = 0;
        cashItems.forEach(item => {
            if (item.type === 'money_market_fund' && item.instrumentId && item.units && item.averageCost) {
                const livePrice = fundPrices[item.instrumentId];
                if (livePrice) {
                    const currentValue = item.units * livePrice;
                    const cost = item.units * item.averageCost;
                    ppfProfit += currentValue - cost;
                }
            }
        });
        calcTotalTry += ppfProfit;
        calcTotalUsd += ppfProfit / (usdRate || 1);

        // Update state
        setTotalPortfolioTry(calcTotalTry);
        setTotalPortfolioUsd(calcTotalUsd);
        setTotalCostBasisTry(calcCostBasisTry);
        setDailyProfit(calcDailyProfit);
    }, [portfolio, contextPrices, contextDailyChanges, contextUsdRate, cashBalance, cashItems, fundPrices]);

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

    // Calculate Yedek Akçe totals (reusable for both mobile and web)
    const { totalCashValue, ppfProfit, ppfCost } = React.useMemo(() => {
        let cost = 0;
        let currentValue = 0;
        cashItems.forEach(item => {
            if (item.type === 'money_market_fund' && item.instrumentId && item.units && item.averageCost) {
                const livePrice = fundPrices[item.instrumentId];
                if (livePrice) {
                    currentValue += item.units * livePrice;
                    cost += item.units * item.averageCost;
                }
            }
        });
        const profit = currentValue - cost;
        return {
            totalCashValue: cashBalance + profit,
            ppfProfit: profit,
            ppfCost: cost
        };
    }, [cashBalance, cashItems, fundPrices]);

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
        // Forex (USD, EUR, etc.)
        else if (item.type === 'forex' || ['USD', 'EUR', 'GBP', 'RUB', 'JPY'].includes(id)) {
            category = 'Döviz';
        }
        // US ETFs - check before generic USD
        else if (item.currency === 'USD' && (item.type === 'stock' || ['VOO', 'QQQ', 'SPY', 'VTI', 'SCHD', 'JEPI', 'ARKK', 'SCHG', 'OPTGY', 'OPT25'].includes(id))) {
            category = 'ABD ETF';
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
                    <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 20 }}>
                        {/* WEB HEADER - Greeting + Portfolio Switcher */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>
                                    {activePortfolio?.id === 'all-portfolios' ? 'Toplam Varlığın 🌍' : 'Merhaba, Yatırımcı 👋'}
                                </Text>
                                <Text style={{ fontSize: 14, color: colors.subText, marginTop: 4 }}>
                                    {activePortfolio?.id === 'all-portfolios' ? 'Tüm portföylerinin birleşik özeti' : 'İşte bugünkü finansal özetin'}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.subText, marginTop: 4, opacity: 0.8 }}>
                                    {lastPricesUpdate > 0 ? `Veriler Gerçek Zamanlıdır • Son Güncelleme: ${new Date(lastPricesUpdate).toLocaleTimeString()}` : 'Veriler Güncelleniyor...'}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <PortfolioSwitcher prices={prices} dailyChanges={dailyChanges} usdRate={usdRate} goldPrice={goldPrice} />
                                <TouchableOpacity
                                    onPress={() => (navigation as any).navigate('Alerts')}
                                    style={{ padding: 10, backgroundColor: colors.cardBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Bell size={18} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setIsHidden(!isHidden)}
                                    style={{ padding: 10, backgroundColor: colors.cardBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                                >
                                    {isHidden ? <EyeOff size={18} color={colors.text} strokeWidth={2} /> : <Eye size={18} color={colors.text} strokeWidth={2} />}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* MAIN 2-COLUMN LAYOUT */}
                        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
                            {/* LEFT COLUMN - Main Content */}
                            <View style={{ flex: 2, gap: 20 }}>
                                {/* Total Assets Card (Full Width) */}
                                <GradientCard
                                    variant="primary"
                                    style={{ borderRadius: 20, padding: 0 }}
                                    contentStyle={{ padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12 }}>
                                            <Briefcase size={24} color="rgba(255,255,255,0.9)" />
                                        </View>
                                        <View>
                                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' }}>Toplam Varlıklar</Text>
                                            <Text style={{ color: '#fff', fontSize: heroFontSize, fontWeight: '800', marginTop: 4 }}>
                                                {isHidden ? '******' : formatCurrency(totalPortfolioTry, 'TRY')}
                                            </Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>
                                                {isHidden ? '****' : `💰 $${portfolioInUsd.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}  ·  {isHidden ? '**' : `⚖ ${portfolioInGramGold.toFixed(1)} gr altın`}
                                            </Text>
                                        </View>
                                    </View>
                                    {/* K/Z Badge */}
                                    <View style={{
                                        backgroundColor: 'rgba(255,255,255,0.15)',
                                        paddingHorizontal: 20,
                                        paddingVertical: 16,
                                        borderRadius: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 12
                                    }}>
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 10 }}>
                                            <TrendingUp size={20} color={totalUnrealizedProfitTry >= 0 ? '#34C759' : '#FF3B30'} />
                                        </View>
                                        <View>
                                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' }}>TOPLAM KÂR/ZARAR</Text>
                                            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 2 }}>
                                                {isHidden ? '•••' : `${totalUnrealizedProfitTry >= 0 ? '+' : ''}${formatCurrency(totalUnrealizedProfitTry, 'TRY')}`}
                                            </Text>
                                        </View>
                                        <View style={{
                                            backgroundColor: totalUnrealizedProfitPercent >= 0 ? '#34C759' : '#FF3B30',
                                            paddingHorizontal: 10,
                                            paddingVertical: 6,
                                            borderRadius: 8,
                                            marginLeft: 8
                                        }}>
                                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                                                {isHidden ? '•••' : `%${totalUnrealizedProfitPercent.toFixed(2)}`}
                                            </Text>
                                        </View>
                                    </View>
                                </GradientCard>

                                {/* 3 Stat Cards Row */}
                                <View style={{ flexDirection: 'row', gap: 16 }}>
                                    {/* Günlük Değişim */}
                                    <View style={{
                                        flex: 1,
                                        backgroundColor: colors.cardBackground,
                                        borderRadius: 16,
                                        padding: 20,
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                            <View style={{ backgroundColor: colors.background, padding: 10, borderRadius: 10 }}>
                                                <Calendar size={18} color={colors.subText} />
                                            </View>
                                            <View style={{
                                                backgroundColor: dailyProfit >= 0 ? '#E8F5E9' : '#FFEBEE',
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 6
                                            }}>
                                                <Text style={{ color: dailyProfit >= 0 ? '#34C759' : '#FF3B30', fontSize: 11, fontWeight: '600' }}>
                                                    {dailyProfit >= 0 ? '↑' : '↓'} {Math.abs(dailyProfitPercent).toFixed(2)}%
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: colors.subText, fontSize: 13, fontWeight: '500' }}>Günlük Değişim</Text>
                                        <Text style={{ color: dailyProfit >= 0 ? colors.success : colors.danger, fontSize: 22, fontWeight: '700', marginTop: 4 }}>
                                            {isHidden ? '•••' : `${dailyProfit >= 0 ? '+' : ''}${formatCurrency(dailyProfit, 'TRY')}`}
                                        </Text>
                                    </View>

                                    {/* Gerçekleşen Kâr */}
                                    <View style={{
                                        flex: 1,
                                        backgroundColor: colors.cardBackground,
                                        borderRadius: 16,
                                        padding: 20,
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                            <View style={{ backgroundColor: colors.background, padding: 10, borderRadius: 10 }}>
                                                <CheckSquare size={18} color={colors.subText} />
                                            </View>
                                        </View>
                                        <Text style={{ color: colors.subText, fontSize: 13, fontWeight: '500' }}>Gerçekleşen Kâr</Text>
                                        <Text style={{ color: totalRealizedProfitTry >= 0 ? colors.success : colors.danger, fontSize: 22, fontWeight: '700', marginTop: 4 }}>
                                            {isHidden ? '•••' : `${totalRealizedProfitTry >= 0 ? '+' : ''}${formatCurrency(totalRealizedProfitTry, 'TRY')}`}
                                        </Text>
                                    </View>

                                    {/* Yedek Akçe */}
                                    <TouchableOpacity
                                        style={{
                                            flex: 1,
                                            backgroundColor: colors.cardBackground,
                                            borderRadius: 16,
                                            padding: 20,
                                            borderWidth: 1,
                                            borderColor: colors.border
                                        }}
                                        onPress={() => (navigation as any).navigate('CashManagement')}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                            <View style={{ backgroundColor: '#FFF3E0', padding: 10, borderRadius: 10 }}>
                                                <Archive size={18} color="#FF9800" />
                                            </View>
                                        </View>
                                        <Text style={{ color: colors.subText, fontSize: 13, fontWeight: '500' }}>Yedek Akçe</Text>
                                        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 4 }}>
                                            {isHidden ? '•••' : formatCurrency(totalCashValue, 'TRY')}
                                        </Text>
                                        {/* Show money market fund profit */}
                                        {ppfCost > 0 && ppfProfit !== 0 && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                                {ppfProfit >= 0 ? (
                                                    <TrendingUp size={14} color={colors.success} strokeWidth={2} />
                                                ) : (
                                                    <TrendingDown size={14} color={colors.danger} strokeWidth={2} />
                                                )}
                                                <Text style={{
                                                    color: ppfProfit >= 0 ? colors.success : colors.danger,
                                                    fontSize: 13,
                                                    fontWeight: '600'
                                                }}>
                                                    {isHidden ? '•••' : `${ppfProfit >= 0 ? '+' : ''}${formatCurrency(ppfProfit, 'TRY')}`}
                                                </Text>
                                                <Text style={{ color: colors.subText, fontSize: 11, fontWeight: '500' }}>
                                                    Kâr
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                { /* Portfolio Distribution - Donut Chart */}
                                {
                                    portfolio.length > 0 && (
                                        <View
                                            style={{
                                                backgroundColor: colors.cardBackground,
                                                borderRadius: 16,
                                                padding: 24,
                                                borderWidth: 1,
                                                borderColor: colors.border
                                            }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                                <View>
                                                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Varlık Dağılımı</Text>
                                                    <Text style={{ fontSize: 13, color: colors.subText, marginTop: 2 }}>Portföyünüzün sektörel dağılımı</Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={{ padding: 8, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                                                    onPress={() => captureDistributionCard()}
                                                >
                                                    <Download size={16} color={colors.subText} />
                                                </TouchableOpacity>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 40 }}>
                                                {/* Donut Chart */}
                                                <View style={{ alignItems: 'center' }}>
                                                    {isInitialLoading ? (
                                                        <Skeleton width={220} height={220} borderRadius={110} />
                                                    ) : (
                                                        <ShareableDonutChart
                                                            ref={donutChartRef}
                                                            data={pieData.map(item => ({ name: item.name, value: item.population, color: item.color }))}
                                                            size={220}
                                                            strokeWidth={28}
                                                            centerText={isHidden ? '••••' : `${(totalPortfolioTry / 1000).toFixed(0)}K`}
                                                            centerSubtext="TOPLAM"
                                                            colors={colors}
                                                            hideLegend={true}
                                                        />
                                                    )}
                                                </View>

                                                {/* Legend - 2 column grid */}
                                                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                                                    {pieData.map((item, index) => {
                                                        const total = pieData.reduce((sum, d) => sum + d.population, 0);
                                                        const percentage = total > 0 ? ((item.population / total) * 100).toFixed(1) : '0.0';
                                                        return (
                                                            <View key={index} style={{ width: '45%', marginBottom: 8 }}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                                                                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                                                                </View>
                                                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4, marginLeft: 18 }}>
                                                                    <Text style={{ fontSize: 16, color: colors.text, fontWeight: '700' }}>{percentage}%</Text>
                                                                    <Text style={{ fontSize: 12, color: colors.subText }}>
                                                                        {isHidden ? '•••' : formatCurrency(item.population, 'TRY')}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        </View>
                                    )
                                }
                            </View>

                            {/* RIGHT COLUMN - Insights */}
                            <View style={{ flex: 1, gap: 16 }}>
                                {/* Risk Analysis Card */}
                                <View style={{
                                    backgroundColor: colors.cardBackground,
                                    borderRadius: 16,
                                    padding: 20,
                                    borderWidth: 1,
                                    borderColor: colors.border
                                }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Shield size={18} color={colors.text} />
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Risk Analizi</Text>
                                        </View>
                                        <View style={{
                                            backgroundColor: '#FFF3E0',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 8
                                        }}>
                                            <Text style={{ color: '#FF9800', fontSize: 12, fontWeight: '700' }}>Orta Risk</Text>
                                        </View>
                                    </View>

                                    <View style={{ gap: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: colors.subText, fontSize: 13 }}>Riskteki Para</Text>
                                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                                                {isHidden ? '•••' : formatCurrency(Math.max(0, totalCostBasisTry - totalRealizedProfitTry), 'TRY')}
                                            </Text>
                                        </View>

                                        {/* Progress Bar */}
                                        <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }}>
                                            <View style={{ width: '66%', height: '100%', backgroundColor: colors.success, borderRadius: 4 }} />
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <View>
                                                <Text style={{ color: colors.subText, fontSize: 11 }}>Anapara</Text>
                                                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                                                    {isHidden ? '•••' : formatCurrency(totalCostBasisTry, 'TRY')}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ color: colors.subText, fontSize: 11 }}>Risk Oranı</Text>
                                                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>%66</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Daily Performance */}
                                <View style={{
                                    backgroundColor: colors.cardBackground,
                                    borderRadius: 16,
                                    padding: 20,
                                    borderWidth: 1,
                                    borderColor: colors.border
                                }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.subText, letterSpacing: 0.5, marginBottom: 16 }}>GÜNÜN PERFORMANSI</Text>

                                    {/* Best Performer */}
                                    <TouchableOpacity
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: colors.background,
                                            padding: 14,
                                            borderRadius: 12,
                                            marginBottom: 10,
                                            borderWidth: 1,
                                            borderColor: colors.success + '30'
                                        }}
                                        onPress={() => {
                                            if (bestPerformer.id && bestPerformer.id !== '-') {
                                                const instrument = portfolio.find(p => p.instrumentId === bestPerformer.id);
                                                if (instrument) (navigation as any).navigate('AssetDetail', { id: instrument.id });
                                            }
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ backgroundColor: '#E8F5E9', padding: 8, borderRadius: 8 }}>
                                                <TrendingUp size={16} color={colors.success} />
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 11, color: colors.subText }}>EN İYİ PERFORMANS</Text>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                                                    {bestPerformer.id ? bestPerformer.id.replace('.IS', '') : '-'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                                            <Text style={{ color: colors.success, fontSize: 14, fontWeight: '700' }}>
                                                {bestPerformer.id ? `+${bestPerformer.change.toFixed(2)}%` : '-'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Worst Performer */}
                                    <TouchableOpacity
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: colors.background,
                                            padding: 14,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: colors.danger + '30'
                                        }}
                                        onPress={() => {
                                            if (worstPerformer.id && worstPerformer.id !== '-') {
                                                const instrument = portfolio.find(p => p.instrumentId === worstPerformer.id);
                                                if (instrument) (navigation as any).navigate('AssetDetail', { id: instrument.id });
                                            }
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ backgroundColor: '#FFEBEE', padding: 8, borderRadius: 8 }}>
                                                <TrendingDown size={16} color={colors.danger} />
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 11, color: colors.subText }}>EN KÖTÜ PERFORMANS</Text>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                                                    {worstPerformer.id ? worstPerformer.id.replace('.IS', '') : '-'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={{ backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                                            <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700' }}>
                                                {worstPerformer.id ? `${worstPerformer.change.toFixed(2)}%` : '-'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                {/* Market Summary */}
                                {marketSummaryVisible && (
                                    <View style={{
                                        backgroundColor: colors.cardBackground,
                                        borderRadius: 16,
                                        padding: 20,
                                        borderWidth: 1,
                                        borderColor: colors.border
                                    }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Activity size={16} color={colors.text} />
                                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Piyasa Özeti</Text>
                                            </View>
                                            <TouchableOpacity>
                                                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Tümünü Gör</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View style={{ gap: 12 }}>
                                            {[
                                                { id: 'USD/TRY', label: 'USD/TRY', sublabel: 'DOLAR KURU', icon: '$', value: usdRate, change: dailyChanges['USD'] || 0, currency: 'TRY' },
                                                { id: 'Gram Altın', label: 'Gram Altın', sublabel: 'EMTİA', icon: 'Au', value: goldPrice, change: 0.5, currency: 'TRY' },
                                                { id: 'BIST 100', label: 'BIST 100', sublabel: 'ENDEKS', icon: 'B', value: bistData?.price, change: bistData?.change || 0, currency: 'TRY' },
                                            ].filter(item => selectedMarketInstruments.includes(item.id)).map((item, index) => (
                                                <View key={index} style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    paddingVertical: 8
                                                }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                        <View style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 10,
                                                            backgroundColor: colors.background,
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderWidth: 1,
                                                            borderColor: colors.border
                                                        }}>
                                                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.subText }}>{item.icon}</Text>
                                                        </View>
                                                        <View>
                                                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.label}</Text>
                                                            <Text style={{ fontSize: 11, color: colors.subText }}>{item.sublabel}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                                                            {item.value ? formatCurrency(item.value, item.currency as any) : '-'}
                                                        </Text>
                                                        <Text style={{ fontSize: 12, color: item.change >= 0 ? colors.success : colors.danger, fontWeight: '600' }}>
                                                            {item.change >= 0 ? '↑' : '↓'} {Math.abs(item.change).toFixed(2)}%
                                                        </Text>
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
                    // MODERN MOBILE LAYOUT
                    <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 16 }}>
                        {/* Mobile Header: Greeting + Switcher */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                                    {activePortfolio?.id === 'all-portfolios' ? 'Tüm Varlıklarım 🌍' : 'Selam! 👋'}
                                </Text>
                                <Text style={{ fontSize: 9, color: colors.subText, marginTop: 1 }}>
                                    {lastPricesUpdate > 0 ? `Son Güncelleme: ${new Date(lastPricesUpdate).toLocaleTimeString()}` : 'Güncelleniyor...'}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <PortfolioSwitcher prices={prices} dailyChanges={dailyChanges} usdRate={usdRate} goldPrice={goldPrice} />
                                <TouchableOpacity
                                    onPress={() => (navigation as any).navigate('Settings')}
                                    style={{ padding: 8, backgroundColor: colors.cardBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                                >
                                    <Settings size={20} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Total Assets Card */}
                        <GradientCard
                            variant="primary"
                            style={{ borderRadius: 20, padding: 0 }}
                            contentStyle={{ padding: 20 }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' }}>TOPLAM VARLIKLAR</Text>
                                    <Text style={{ color: '#fff', fontSize: heroFontSize * 0.9, fontWeight: '800', marginTop: 4 }}>
                                        {isHidden ? '******' : formatCurrency(totalPortfolioTry, 'TRY')}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                                            {isHidden ? '****' : `$${portfolioInUsd.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
                                        </Text>
                                        <View style={{ width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                                            {isHidden ? '**' : `${portfolioInGramGold.toFixed(1)} gr altın`}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setIsHidden(!isHidden)}
                                    style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 }}
                                >
                                    {isHidden ? <EyeOff size={18} color="#fff" /> : <Eye size={18} color="#fff" />}
                                </TouchableOpacity>
                            </View>

                            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 }} />

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View>
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' }}>TOPLAM K/Z</Text>
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                                        {isHidden ? '•••' : `${totalUnrealizedProfitTry >= 0 ? '+' : ''}${formatCurrency(totalUnrealizedProfitTry, 'TRY')}`}
                                    </Text>
                                </View>
                                <View style={{
                                    backgroundColor: totalUnrealizedProfitPercent >= 0 ? '#34C759' : '#FF3B30',
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 6
                                }}>
                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                                        {isHidden ? '•••' : `%${totalUnrealizedProfitPercent.toFixed(1)}`}
                                    </Text>
                                </View>
                            </View>
                        </GradientCard>

                        {/* 2x2 Grid for Stats */}
                        <View style={{ gap: 10 }}>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {/* Günlük Değişim */}
                                <Card style={{ flex: 1, padding: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <View style={{ backgroundColor: dailyProfit >= 0 ? colors.success + '15' : colors.danger + '15', padding: 6, borderRadius: 8 }}>
                                            <Calendar size={14} color={dailyProfit >= 0 ? colors.success : colors.danger} />
                                        </View>
                                        <Text style={{ fontSize: 10, color: colors.subText, fontWeight: '600' }}>GÜNLÜK</Text>
                                    </View>
                                    <Text style={{ color: dailyProfit >= 0 ? colors.success : colors.danger, fontSize: 15, fontWeight: '700' }}>
                                        {isHidden ? '•••' : `${dailyProfit >= 0 ? '+' : ''}${dailyProfitPercent.toFixed(1)}%`}
                                    </Text>
                                    <Text style={{ color: colors.text, fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                                        {isHidden ? '•••' : formatCurrency(dailyProfit, 'TRY')}
                                    </Text>
                                </Card>

                                {/* Yedek Akçe */}
                                <Card style={{ flex: 1, padding: 12, minHeight: 85 }} onPress={() => (navigation as any).navigate('CashManagement')}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <View style={{ backgroundColor: colors.warning + '15', padding: 6, borderRadius: 8 }}>
                                            <Archive size={14} color={colors.warning} />
                                        </View>
                                        <Text style={{ fontSize: 10, color: colors.subText, fontWeight: '600' }}>NAKİT</Text>
                                    </View>
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                                        {isHidden ? '•••' : formatCurrency(totalCashValue, 'TRY')}
                                    </Text>
                                    {ppfCost > 0 && ppfProfit !== 0 ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <Text style={{
                                                color: ppfProfit >= 0 ? colors.success : colors.danger,
                                                fontSize: 10,
                                                fontWeight: '700'
                                            }}>
                                                {isHidden ? '•••' : `${ppfProfit >= 0 ? '+' : ''}${formatCurrency(ppfProfit, 'TRY')}`}
                                            </Text>
                                            <Text style={{ color: colors.subText, fontSize: 9 }}>kâr</Text>
                                        </View>
                                    ) : (
                                        <Text style={{ color: colors.subText, fontSize: 10, marginTop: 2 }}>Yönetmek için dokun</Text>
                                    )}
                                </Card>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {/* Gerçekleşen Kâr */}
                                <Card style={{ flex: 1, padding: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <View style={{ backgroundColor: colors.success + '15', padding: 6, borderRadius: 8 }}>
                                            <CheckSquare size={14} color={colors.success} />
                                        </View>
                                        <Text style={{ fontSize: 10, color: colors.subText, fontWeight: '600' }}>KAZANÇ</Text>
                                    </View>
                                    <Text style={{ color: colors.success, fontSize: 15, fontWeight: '700' }}>
                                        {isHidden ? '•••' : formatCurrency(totalRealizedProfitTry, 'TRY')}
                                    </Text>
                                    <Text style={{ color: colors.subText, fontSize: 10, marginTop: 2 }}>Gerçekleşen kâr</Text>
                                </Card>

                                {/* Risk Analizi */}
                                <Card style={{ flex: 1, padding: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <View style={{ backgroundColor: colors.primary + '15', padding: 6, borderRadius: 8 }}>
                                            <Shield size={14} color={colors.primary} />
                                        </View>
                                        <Text style={{ fontSize: 10, color: colors.subText, fontWeight: '600' }}>RİSK</Text>
                                    </View>
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                                        {isHidden ? '•••' : `%${((totalCostBasisTry / (totalPortfolioTry || 1)) * 100).toFixed(0)}`}
                                    </Text>
                                    <Text style={{ color: colors.subText, fontSize: 10, marginTop: 2 }}>Riskte olan para</Text>
                                </Card>
                            </View>
                        </View>

                        {/* Chart Preview */}
                        {portfolioChartVisible && activePortfolio?.id !== 'all-portfolios' && (
                            <View style={{ marginTop: 4, marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }}>
                                    <View />
                                    <TouchableOpacity
                                        onPress={() => portfolioChartRef.current?.captureImage()}
                                        style={{ padding: 6, backgroundColor: colors.cardBackground, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                                    >
                                        <Download size={14} color={colors.subText} />
                                    </TouchableOpacity>
                                </View>
                                <PortfolioChart
                                    ref={portfolioChartRef}
                                    currentValue={totalPortfolioTry}
                                    history={history}
                                    isMobile={true}
                                />
                            </View>
                        )}

                        {/* Distribution Card */}
                        {portfolio.length > 0 && (
                            <Card style={{ padding: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Varlık Dağılımı</Text>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <TouchableOpacity onPress={() => captureDistributionCard()}>
                                            <Download size={18} color={colors.subText} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => (navigation as any).navigate('Analytics')}>
                                            <ArrowUpRight size={18} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 140, height: 140 }}>
                                        <ShareableDonutChart
                                            ref={donutChartRef}
                                            data={pieData.map(item => ({ name: item.name, value: item.population, color: item.color }))}
                                            size={140}
                                            strokeWidth={18}
                                            centerText={isHidden ? '••••' : formatCurrency(totalPortfolioTry, 'TRY')}
                                            centerSubtext=""
                                            centerTextFontSize={13}
                                            colors={colors}
                                            hideLegend={true}
                                            isCompact={true}
                                        />
                                    </View>
                                    <View style={{ flex: 1, gap: 6, paddingLeft: 16 }}>
                                        {pieData.map((item, index) => (
                                            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color }} />
                                                    <Text style={{ fontSize: 11, color: colors.text, fontWeight: '600' }} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                                                </View>
                                                <Text style={{ fontSize: 11, color: colors.subText, fontWeight: '700', marginLeft: 4 }}>
                                                    {((item.population / (totalPortfolioTry || 1)) * 100).toFixed(0)}%
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </Card>
                        )}

                        {/* Quick Insights Row */}
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 30, marginTop: 4 }}>
                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    backgroundColor: colors.success + '10',
                                    padding: 12,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: colors.success + '30'
                                }}
                                onPress={() => setMarketReportVisible(true)}
                            >
                                <Zap size={16} color={colors.success} style={{ marginBottom: 4 }} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Piyasa Raporu</Text>
                                <Text style={{ fontSize: 10, color: colors.subText, marginTop: 2 }}>Günlük analizleri gör</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    backgroundColor: colors.primary + '10',
                                    padding: 12,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: colors.primary + '30'
                                }}
                                onPress={() => (navigation as any).navigate('Alerts')}
                            >
                                <Bell size={16} color={colors.primary} style={{ marginBottom: 4 }} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Fiyat Alarmları</Text>
                                <Text style={{ fontSize: 10, color: colors.subText, marginTop: 2 }}>Takip listeni incele</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => (navigation as any).navigate('AddInstrument')}
            >
                <Plus size={24} color="#fff" />
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
                                <X size={24} color={colors.subText} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.modalDate, { color: colors.subText }]}>
                            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>

                        <ScrollView style={styles.modalBody}>
                            {marketReportData ? (
                                <>
                                    {/* Portfolio Info (moved here) */}
                                    <View style={styles.headerInfo}>
                                        <View style={styles.titleRow}>
                                            <Briefcase size={Platform.OS === 'web' ? 24 : 20} color={colors.primary} strokeWidth={2.5} />
                                            <Text style={[styles.title, { color: colors.text }]}>{activePortfolio?.name || 'Ana Portföy'}</Text>
                                        </View>
                                        <Text style={[styles.lastUpdated, { color: colors.subText }]}>
                                            {lastPricesUpdate > 0 ? `Son Güncelleme: ${new Date(lastPricesUpdate).toLocaleTimeString()}` : 'Güncelleniyor...'}
                                        </Text>
                                    </View>

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
                                            <TrendingUp size={16} color={colors.primary} />
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
                                                <Zap size={16} color={colors.primary} />
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
    headerInfo: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    lastUpdated: {
        fontSize: 11,
        fontWeight: '500',
        opacity: 0.8,
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
