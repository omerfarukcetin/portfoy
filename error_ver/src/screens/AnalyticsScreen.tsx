import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { MarketDataService } from '../services/marketData';
import { LineChart } from 'react-native-chart-kit';
import {
    TrendingUp,
    TrendingDown,
    BarChart2,
    Activity,
    Target,
    Zap,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Info,
    Layout
} from 'lucide-react-native';
import { formatCurrency } from '../utils/formatting';

const screenWidth = Dimensions.get('window').width;

// Helper to determine if we are on wide screen (web/tablet)
const isWide = Platform.OS === 'web' && screenWidth > 800;

export const AnalyticsScreen = () => {
    const { colors, fontScale } = useTheme();
    const { history, portfolio } = usePortfolio();
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState<'1W' | '1M' | '3M' | '1Y'>('1M');
    const [benchmarkData, setBenchmarkData] = useState<Record<string, number[]>>({});
    const [contributionData, setContributionData] = useState<any[]>([]);

    useEffect(() => {
        fetchAllData();
    }, [period]);

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([
            fetchBenchmarks(),
            calculateContributions()
        ]);
        setLoading(false);
    };

    const getHistorySlice = () => {
        let days = 7;
        switch (period) {
            case '1W': days = 7; break;
            case '1M': days = 30; break;
            case '3M': days = 90; break;
            case '1Y': days = 365; break;
        }
        return history.slice(-days);
    };

    const calculateContributions = async () => {
        if (!portfolio || portfolio.length === 0) return;

        const slice = getHistorySlice();
        if (slice.length < 2) return;

        const startDate = new Date(slice[0].date).getTime();

        const contributions = await Promise.all(portfolio.map(async (item) => {
            try {
                // For contribution, we need the price at the start of the period
                // MarketDataService.getHistoricalPrice is primarily for stocks
                let historicalPrice = await MarketDataService.getHistoricalPrice(item.instrumentId, startDate);

                // Fallback: If no historical price, use average cost as a very loose proxy or just 0
                if (historicalPrice <= 0) {
                    // If the asset was added AFTER the period started, we use the average cost 
                    // (since it didn't exist in the portfolio before)
                    if (item.dateAdded > startDate) {
                        historicalPrice = item.averageCost;
                    } else {
                        // Asset existed but we couldn't fetch price. Skip contribution calculation for it.
                        return null;
                    }
                }

                // Current price - we need a fresh one or use what we have in item if it was updated recently
                // Since this is Analytics, we expect prices to be relatively fresh from PortfolioContext
                // But item in portfolio doesn't have current price directly, it's fetched in components.
                // However, MarketDataService.fetchMultiplePrices is used in portfolio screens.
                // For simplicity, let's fetch current price here too or assume it's available.
                const currentPriceData = await MarketDataService.getYahooPrice(item.instrumentId);
                const currentPrice = currentPriceData?.currentPrice || item.averageCost;

                const gain = (currentPrice - historicalPrice) * item.amount;
                const gainPercent = ((currentPrice - historicalPrice) / historicalPrice) * 100;

                return {
                    symbol: item.instrumentId,
                    gain,
                    gainPercent,
                    type: item.type
                };
            } catch (e) {
                return null;
            }
        }));

        setContributionData(contributions.filter(c => c !== null).sort((a, b) => b.gain - a.gain));
    };

    const fetchBenchmarks = async () => {
        const historySlice = getHistorySlice();
        if (!historySlice || historySlice.length === 0) return;

        let range: '1mo' | '3mo' | '1y' = '1mo';
        if (period === '3M') range = '3mo';
        if (period === '1Y') range = '1y';

        const benchmarks = {
            'BIST 100': 'XU100.IS',
            'Dolar/TL': 'TRY=X',
            'Gram Altın': 'GOLD_GRAM_TL'
        };

        const newBenchmarkData: Record<string, number[]> = {};

        for (const [name, symbol] of Object.entries(benchmarks)) {
            const data = await MarketDataService.getBenchmarkHistory(symbol, range);

            if (data.length > 0) {
                const startVal = data[0].value;
                const percentData = data.map(d => ((d.value - startVal) / startVal) * 100);

                const resampled = [];
                const step = percentData.length / historySlice.length;
                for (let i = 0; i < historySlice.length; i++) {
                    const index = Math.min(Math.floor(i * step), percentData.length - 1);
                    resampled.push(percentData[index]);
                }
                newBenchmarkData[name] = resampled;
            } else {
                newBenchmarkData[name] = new Array(historySlice.length).fill(0);
            }
        }

        setBenchmarkData(newBenchmarkData);
    };

    const metrics = useMemo(() => {
        const slice = getHistorySlice();
        if (slice.length < 2) return null;

        const startVal = slice[0].valueTry;
        const endVal = slice[slice.length - 1].valueTry;
        const totalReturn = ((endVal - startVal) / startVal) * 100;

        // Volatility (daily standard deviation of returns)
        const dailyReturns = [];
        for (let i = 1; i < slice.length; i++) {
            const r = (slice[i].valueTry - slice[i - 1].valueTry) / slice[i - 1].valueTry;
            dailyReturns.push(r);
        }
        const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / dailyReturns.length;
        const volatility = Math.sqrt(variance) * 100; // Daily volatility in %

        return {
            totalReturn,
            volatility,
            avgWeekly: (avgReturn * 7 * 100) // Rough weekly average in %
        };
    }, [history, period]);

    const renderChart = () => {
        const historySlice = getHistorySlice();
        if (!historySlice || historySlice.length < 2) {
            return (
                <View style={styles.chartPlaceholder}>
                    <Activity size={48} color={colors.border} />
                    <Text style={{ color: colors.subText, textAlign: 'center', marginTop: 12 }}>Analiz için yeterli geçmiş veri yok.</Text>
                </View>
            );
        }

        const portfolioData = historySlice.map(h => h.valueTry);
        const portfolioStart = portfolioData[0];
        const portfolioPercent = portfolioData.map(v => ((v - portfolioStart) / portfolioStart) * 100);

        const datasets = [
            {
                data: portfolioPercent,
                color: (opacity = 1) => colors.primary,
                strokeWidth: 3,
            }
        ];

        const benchmarkColors: Record<string, string> = {
            'BIST 100': '#FF9500',
            'Dolar/TL': '#34C759',
            'Gram Altın': '#FFD60A'
        };

        Object.keys(benchmarkData).forEach(key => {
            if (benchmarkData[key] && benchmarkData[key].length === portfolioPercent.length) {
                datasets.push({
                    data: benchmarkData[key],
                    color: (opacity = 1) => benchmarkColors[key] || '#8E8E93',
                    strokeWidth: 1.5,
                } as any);
            }
        });

        let labels = historySlice.map(h => h.date.substr(5));
        if (period === '3M' || period === '1Y') {
            const step = Math.ceil(labels.length / 6);
            labels = labels.map((l, i) => i % step === 0 ? l : '');
        }

        const data = {
            labels: labels,
            datasets: datasets,
        };

        return (
            <LineChart
                data={data}
                width={isWide ? (screenWidth - 80) / 2 : screenWidth - 48}
                height={240}
                chartConfig={{
                    backgroundColor: colors.cardBackground,
                    backgroundGradientFrom: colors.cardBackground,
                    backgroundGradientTo: colors.cardBackground,
                    decimalPlaces: 1,
                    color: (opacity = 1) => colors.text,
                    labelColor: (opacity = 1) => colors.subText,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "0" },
                    formatYLabel: (y) => `${Number(y) > 0 ? '+' : ''}${y}%`,
                    fillShadowGradient: colors.primary,
                    fillShadowGradientOpacity: 0.1,
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
                withDots={false}
                withInnerLines={false}
                withVerticalLines={false}
                yAxisInterval={1}
            />
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.headerTitleRow}>
                    <BarChart2 size={24} color={colors.primary} />
                    <Text style={[styles.title, { color: colors.text }]}>Analiz ve Karşılaştırma</Text>
                </View>

                <View style={styles.periodSelector}>
                    {['1W', '1M', '3M', '1Y'].map((p) => (
                        <TouchableOpacity
                            key={p}
                            style={[
                                styles.periodBtn,
                                { backgroundColor: period === p ? colors.primary : colors.background }
                            ]}
                            onPress={() => setPeriod(p as any)}
                        >
                            <Text style={[styles.periodText, { color: period === p ? '#fff' : colors.subText }]}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Performance Summary Grid */}
                <View style={isWide ? styles.rowGrid : styles.singleCol}>
                    <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.summaryIcon}>
                            <Target size={20} color={colors.primary} />
                        </View>
                        <Text style={[styles.summaryLabel, { color: colors.subText }]}>Toplam Getiri</Text>
                        <Text style={[styles.summaryValue, { color: (metrics?.totalReturn || 0) >= 0 ? colors.success : colors.danger }]}>
                            {metrics ? (metrics.totalReturn >= 0 ? '+' : '') + metrics.totalReturn.toFixed(2) + '%' : '--'}
                        </Text>
                    </View>

                    <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.summaryIcon}>
                            <Zap size={20} color="#FF9500" />
                        </View>
                        <Text style={[styles.summaryLabel, { color: colors.subText }]}>Ort. Haftalık</Text>
                        <Text style={[styles.summaryValue, { color: (metrics?.avgWeekly || 0) >= 0 ? colors.success : colors.danger }]}>
                            {metrics ? (metrics.avgWeekly >= 0 ? '+' : '') + metrics.avgWeekly.toFixed(2) + '%' : '--'}
                        </Text>
                    </View>

                    <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.summaryIcon}>
                            <Activity size={20} color="#5856D6" />
                        </View>
                        <Text style={[styles.summaryLabel, { color: colors.subText }]}>Volatilite</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>
                            {metrics ? metrics.volatility.toFixed(2) + '%' : '--'}
                        </Text>
                    </View>
                </View>

                {/* Main Content Layout */}
                <View style={isWide ? styles.mainRow : styles.mainCol}>

                    {/* LEFT COLUMN: Chart */}
                    <View style={isWide ? styles.leftCol : styles.fullWidth}>
                        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            <View style={styles.cardHeader}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Performans Grafiği</Text>
                                <View style={styles.legendContainer}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                                        <Text style={[styles.legendText, { color: colors.subText }]}>Portföy</Text>
                                    </View>
                                </View>
                            </View>
                            {loading ? <ActivityIndicator color={colors.primary} style={{ height: 250 }} /> : renderChart()}
                        </View>

                        {/* Benchmark Comparison Table */}
                        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            <View style={styles.cardHeader}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Piyasa Karşılaştırması</Text>
                                <Info size={16} color={colors.subText} />
                            </View>

                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableLabel, { color: colors.subText }]}>Enstrüman</Text>
                                <Text style={[styles.tableLabel, { color: colors.subText, textAlign: 'right' }]}>Değişim ({period})</Text>
                            </View>

                            <View style={styles.benchmarkRow}>
                                <View style={styles.benchmarkIconLabel}>
                                    <View style={[styles.symbolIcon, { backgroundColor: colors.primary + '20' }]}>
                                        <Layout size={14} color={colors.primary} />
                                    </View>
                                    <Text style={[styles.benchmarkLabel, { color: colors.text, fontWeight: '700' }]}>Portföyüm</Text>
                                </View>
                                <Text style={[styles.benchmarkValue, { color: (metrics?.totalReturn || 0) >= 0 ? colors.success : colors.danger }]}>
                                    {metrics ? (metrics.totalReturn >= 0 ? '+' : '') + metrics.totalReturn.toFixed(2) + '%' : '0.00%'}
                                </Text>
                            </View>

                            {Object.keys(benchmarkData).map(key => {
                                const data = benchmarkData[key];
                                const lastValue = data && data.length > 0 ? data[data.length - 1] : 0;
                                return (
                                    <View key={key} style={styles.benchmarkRow}>
                                        <View style={styles.benchmarkIconLabel}>
                                            <View style={[styles.symbolIcon, { backgroundColor: colors.border }]}>
                                                <TrendingUp size={14} color={colors.subText} />
                                            </View>
                                            <Text style={[styles.benchmarkLabel, { color: colors.text }]}>{key}</Text>
                                        </View>
                                        <Text style={[styles.benchmarkValue, { color: lastValue >= 0 ? colors.success : colors.danger }]}>
                                            {lastValue >= 0 ? '+' : ''}{lastValue.toFixed(2)}%
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* RIGHT COLUMN: Contributions */}
                    <View style={isWide ? styles.rightCol : styles.fullWidth}>
                        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 16 }]}>Varlık Katkısı</Text>

                            {loading ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : contributionData.length === 0 ? (
                                <Text style={{ color: colors.subText, textAlign: 'center', marginVertical: 20 }}>Henüz katkı verisi yok.</Text>
                            ) : (
                                <>
                                    <Text style={[styles.subSectionTitle, { color: colors.subText }]}>En Çok Kazandıranlar</Text>
                                    {contributionData.slice(0, 3).map((c, i) => (
                                        <View key={'win' + i} style={styles.contributionItem}>
                                            <View style={styles.contributionLeft}>
                                                <View style={[styles.contIcon, { backgroundColor: colors.success + '20' }]}>
                                                    <ArrowUpRight size={14} color={colors.success} />
                                                </View>
                                                <Text style={[styles.contSymbol, { color: colors.text }]}>{c.symbol}</Text>
                                            </View>
                                            <View style={styles.contributionRight}>
                                                <Text style={[styles.contValue, { color: colors.success }]}>+{formatCurrency(c.gain, 'TRY')}</Text>
                                                <Text style={[styles.contPercent, { color: colors.subText }]}>%{c.gainPercent.toFixed(1)}</Text>
                                            </View>
                                        </View>
                                    ))}

                                    <View style={{ height: 16 }} />

                                    <Text style={[styles.subSectionTitle, { color: colors.subText }]}>En Çok Kaybettirenler</Text>
                                    {[...contributionData].reverse().slice(0, 3).filter(c => c.gain < 0).map((c, i) => (
                                        <View key={'lose' + i} style={styles.contributionItem}>
                                            <View style={styles.contributionLeft}>
                                                <View style={[styles.contIcon, { backgroundColor: colors.danger + '20' }]}>
                                                    <ArrowDownRight size={14} color={colors.danger} />
                                                </View>
                                                <Text style={[styles.contSymbol, { color: colors.text }]}>{c.symbol}</Text>
                                            </View>
                                            <View style={styles.contributionRight}>
                                                <Text style={[styles.contValue, { color: colors.danger }]}>{formatCurrency(c.gain, 'TRY')}</Text>
                                                <Text style={[styles.contPercent, { color: colors.subText }]}>%{c.gainPercent.toFixed(1)}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>

                        {/* Period Insights */}
                        <View style={[styles.card, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30', borderStyle: 'dashed' }]}>
                            <Text style={[styles.cardTitle, { color: colors.primary, fontSize: 14 }]}>Dönem Özeti</Text>
                            <Text style={[styles.insightText, { color: colors.text }]}>
                                {period === '1W' ? 'Son 7 günde' : period === '1M' ? 'Son 30 günde' : period === '3M' ? 'Son 3 ayda' : 'Son 1 yılda'} portföyünüz
                                <Text style={{ fontWeight: 'bold' }}> {metrics ? (metrics.totalReturn >= 0 ? 'gelişim gösterdi.' : 'değer kaybetti.') : ''}</Text>
                                {metrics && metrics.volatility > 5 ? ' Hareketli bir dönem geçirdiniz.' : ' Sakin bir seyir izlediniz.'}
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
    },
    periodSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    periodBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    periodText: {
        fontWeight: '700',
        fontSize: 13,
    },
    content: {
        padding: 24,
        gap: 24,
    },
    rowGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    singleCol: {
        flexDirection: 'column',
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    summaryIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '800',
    },
    mainRow: {
        flexDirection: 'row',
        gap: 24,
    },
    mainCol: {
        flexDirection: 'column',
        gap: 24,
    },
    leftCol: {
        flex: 2,
        gap: 24,
    },
    rightCol: {
        flex: 1,
        gap: 24,
    },
    fullWidth: {
        width: '100%',
        gap: 24,
    },
    card: {
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    legendContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
        fontWeight: '600',
    },
    chartPlaceholder: {
        height: 240,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tableHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    tableLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    benchmarkRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.03)',
    },
    benchmarkIconLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    symbolIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    benchmarkLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    benchmarkValue: {
        fontSize: 14,
        fontWeight: '700',
    },
    subSectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    contributionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    contributionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    contIcon: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contSymbol: {
        fontSize: 14,
        fontWeight: '700',
    },
    contributionRight: {
        alignItems: 'flex-end',
    },
    contValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    contPercent: {
        fontSize: 11,
        fontWeight: '600',
    },
    insightText: {
        fontSize: 13,
        lineHeight: 20,
        marginTop: 8,
    }
});
