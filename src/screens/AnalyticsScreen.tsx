import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { MarketDataService } from '../services/marketData';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export const AnalyticsScreen = () => {
    const { colors, fonts } = useTheme();
    const { history, portfolio } = usePortfolio();
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState<'1W' | '1M' | '3M' | '1Y'>('1M');
    const [benchmarkData, setBenchmarkData] = useState<Record<string, number[]>>({});

    useEffect(() => {
        fetchBenchmarks();
    }, [period]);

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

    const fetchBenchmarks = async () => {
        setLoading(true);
        const historySlice = getHistorySlice();
        if (!historySlice || historySlice.length === 0) {
            setLoading(false);
            return;
        }

        // Use real dates from history for fetching benchmarks if possible,
        // but getBenchmarkHistory returns its own dates.
        // We should align them or just fetch the range.

        let range: '1mo' | '3mo' | '1y' = '1mo';
        if (period === '3M') range = '3mo';
        if (period === '1Y') range = '1y';

        const benchmarks = {
            'BIST 100': 'XU100.IS',
            'Dolar/TL': 'TRY=X',
            'Gram Altın': 'GOLD_GRAM_TL' // Special symbol for Gram Gold in TL
        };

        const newBenchmarkData: Record<string, number[]> = {};

        for (const [name, symbol] of Object.entries(benchmarks)) {
            const data = await MarketDataService.getBenchmarkHistory(symbol, range);

            // We need to map this data to our history dates or just use it as is if we plot separate lines.
            // ChartKit expects same length data for all datasets.
            // This is tricky because trading days differ.
            // Simplified approach: Fetch data and normalize to percentage change, then sample to match portfolio history length.

            if (data.length > 0) {
                // Normalize to % change
                const startVal = data[0].value;
                const percentData = data.map(d => ((d.value - startVal) / startVal) * 100);

                // Resample to match history length
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
        setLoading(false);
    };

    const renderChart = () => {
        const historySlice = getHistorySlice();
        if (!historySlice || historySlice.length < 2) {
            return <Text style={{ color: colors.subText, textAlign: 'center', marginTop: 20 }}>Yeterli veri yok</Text>;
        }

        // Calculate Portfolio Percentage Change
        const portfolioData = historySlice.map(h => h.valueTry);
        const portfolioStart = portfolioData[0];
        const portfolioPercent = portfolioData.map(v => ((v - portfolioStart) / portfolioStart) * 100);

        const datasets = [
            {
                data: portfolioPercent,
                color: (opacity = 1) => colors.primary,
                strokeWidth: 3,
                withDots: false,
            }
        ];

        const benchmarkColors: Record<string, string> = {
            'BIST 100': '#FF9500', // Orange
            'Dolar/TL': '#34C759', // Green
            'Gram Altın': '#FFD60A'    // Yellow
        };

        Object.keys(benchmarkData).forEach(key => {
            if (benchmarkData[key] && benchmarkData[key].length === portfolioPercent.length) {
                datasets.push({
                    data: benchmarkData[key],
                    color: (opacity = 1) => benchmarkColors[key] || '#8E8E93',
                    strokeWidth: 2,
                    withDots: false,
                });
            }
        });

        // Optimize labels for longer periods
        let labels = historySlice.map(h => h.date.substr(5));
        if (period === '3M' || period === '1Y') {
            // Show fewer labels (e.g., 6 labels max)
            const step = Math.ceil(labels.length / 6);
            labels = labels.map((l, i) => i % step === 0 ? l : '');
        }

        const data = {
            labels: labels,
            datasets: datasets,
            legend: ['Portföy', ...Object.keys(benchmarkData)]
        };

        return (
            <LineChart
                data={data}
                width={screenWidth - 40}
                height={200}
                chartConfig={{
                    backgroundColor: colors.cardBackground,
                    backgroundGradientFrom: colors.cardBackground,
                    backgroundGradientTo: colors.cardBackground,
                    decimalPlaces: 1,
                    color: (opacity = 1) => colors.text,
                    labelColor: (opacity = 1) => colors.subText,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "0", strokeWidth: "0", stroke: colors.primary }, // Hide dots
                    formatYLabel: (y) => `${y}%`
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
                withDots={false}
                withShadow={false}
                withInnerLines={false}
            />
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.title, { color: colors.text }]}>Analiz ve Karşılaştırma</Text>
            </View>

            <View style={styles.periodSelector}>
                {['1W', '1M', '3M', '1Y'].map((p) => (
                    <TouchableOpacity
                        key={p}
                        style={[styles.periodBtn, period === p && { backgroundColor: colors.primary }]}
                        onPress={() => setPeriod(p as any)}
                    >
                        <Text style={[styles.periodText, { color: period === p ? '#fff' : colors.subText }]}>{p}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Portföy Performansı</Text>
                    {loading ? <ActivityIndicator color={colors.primary} /> : renderChart()}
                </View>

                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Karşılaştırma ({period})</Text>
                    <View style={styles.benchmarkRow}>
                        <Text style={[styles.benchmarkLabel, { color: colors.text }]}>Portföy</Text>
                        <Text style={[styles.benchmarkValue, { color: colors.primary }]}>
                            {getHistorySlice().length > 0 ? (((getHistorySlice()[getHistorySlice().length - 1].valueTry - getHistorySlice()[0].valueTry) / getHistorySlice()[0].valueTry) * 100).toFixed(2) : '0.00'}%
                        </Text>
                    </View>
                    {Object.keys(benchmarkData).map(key => {
                        const data = benchmarkData[key];
                        const lastValue = data && data.length > 0 ? data[data.length - 1] : 0;
                        return (
                            <View key={key} style={styles.benchmarkRow}>
                                <Text style={[styles.benchmarkLabel, { color: colors.text }]}>{key}</Text>
                                <Text style={[styles.benchmarkValue, { color: lastValue >= 0 ? colors.success : colors.danger }]}>
                                    {lastValue >= 0 ? '+' : ''}{lastValue.toFixed(2)}%
                                </Text>
                            </View>
                        );
                    })}
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
        paddingTop: 70,
        paddingBottom: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    periodSelector: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 12,
    },
    periodBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginHorizontal: 5,
    },
    periodText: {
        fontWeight: '600',
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 30,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    benchmarkRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    benchmarkLabel: {
        fontSize: 14,
    },
    benchmarkValue: {
        fontSize: 14,
        fontWeight: '700',
    },
});
