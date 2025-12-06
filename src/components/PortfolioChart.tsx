import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/formatting';

const screenWidth = Dimensions.get('window').width;

export const PortfolioChart = () => {
    const { colors, fontScale } = useTheme();
    const { history, totalValueTry } = usePortfolio();
    const [range, setRange] = useState<'1H' | '1A' | '1Y' | 'TÜM'>('1A');

    const chartData = useMemo(() => {
        if (!history || history.length === 0) {
            // Return dummy data if no history
            return {
                labels: ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'],
                datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
            };
        }

        const now = new Date();
        let filteredHistory = [...history];

        // Filter based on range
        if (range === '1H') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filteredHistory = history.filter(h => new Date(h.date) >= oneWeekAgo);
        } else if (range === '1A') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            filteredHistory = history.filter(h => new Date(h.date) >= oneMonthAgo);
        } else if (range === '1Y') {
            const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            filteredHistory = history.filter(h => new Date(h.date) >= oneYearAgo);
        }

        // If filtered data is empty (e.g. new user), show at least the current value
        if (filteredHistory.length === 0) {
            const today = now.toISOString().split('T')[0];
            filteredHistory = [{ date: today, valueTry: totalValueTry, valueUsd: 0 }];
        }

        // Downsample for performance if too many points
        if (filteredHistory.length > 30) {
            const step = Math.ceil(filteredHistory.length / 20);
            filteredHistory = filteredHistory.filter((_, index) => index % step === 0);
        }

        const labels = filteredHistory.map(h => {
            const d = new Date(h.date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        });

        const data = filteredHistory.map(h => h.valueTry);

        return {
            labels,
            datasets: [{ data }]
        };
    }, [history, range, totalValueTry]);

    // Calculate change percentage for the selected range
    const changePercent = useMemo(() => {
        if (!chartData.datasets[0].data || chartData.datasets[0].data.length < 2) return 0;
        const first = chartData.datasets[0].data[0];
        const last = chartData.datasets[0].data[chartData.datasets[0].data.length - 1];
        return first > 0 ? ((last - first) / first) * 100 : 0;
    }, [chartData]);

    return (
        <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.text, fontSize: 16 * fontScale }]}>Portföy Gelişimi</Text>
                    <Text style={[styles.subtitle, { color: changePercent >= 0 ? colors.success : colors.danger, fontSize: 14 * fontScale }]}>
                        {changePercent >= 0 ? '+' : ''}%{changePercent.toFixed(2)} ({range})
                    </Text>
                </View>
                <View style={styles.rangeContainer}>
                    {['1H', '1A', '1Y', 'TÜM'].map((r) => (
                        <TouchableOpacity
                            key={r}
                            style={[
                                styles.rangeButton,
                                range === r && { backgroundColor: colors.primary }
                            ]}
                            onPress={() => setRange(r as any)}
                        >
                            <Text style={[
                                styles.rangeText,
                                { color: range === r ? '#fff' : colors.subText, fontSize: 12 * fontScale }
                            ]}>
                                {r}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <LineChart
                data={chartData}
                width={screenWidth - 40} // Container padding
                height={220}
                chartConfig={{
                    backgroundColor: colors.cardBackground,
                    backgroundGradientFrom: colors.cardBackground,
                    backgroundGradientTo: colors.cardBackground,
                    decimalPlaces: 0,
                    color: (opacity = 1) => colors.primary,
                    labelColor: (opacity = 1) => colors.subText,
                    style: {
                        borderRadius: 16
                    },
                    propsForDots: {
                        r: "4",
                        strokeWidth: "2",
                        stroke: colors.cardBackground
                    },
                    propsForBackgroundLines: {
                        strokeDasharray: "", // solid lines
                        stroke: colors.border + '40' // lighter border
                    }
                }}
                bezier
                style={{
                    marginVertical: 8,
                    borderRadius: 16,
                    marginLeft: -20 // Adjust for left padding of chart
                }}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLabels={true}
                withVerticalLabels={true}
                yAxisLabel="₺"
                yAxisInterval={1}
                formatYLabel={(y) => {
                    // Shorten large numbers (e.g. 15000 -> 15k)
                    const num = parseFloat(y);
                    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
                    if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
                    return num.toString();
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontWeight: '600',
        marginBottom: 4,
    },
    subtitle: {
        fontWeight: '700',
    },
    rangeContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 8,
        padding: 2,
    },
    rangeButton: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    rangeText: {
        fontWeight: '600',
    }
});
