import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';

// Demo Data Generator
const generateDemoData = (days: number, startValue: number) => {
    const data = [];
    const labels = [];
    let currentValue = startValue;

    for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        // Random fluctuation between -2% and +2.5%
        const change = (Math.random() - 0.45) * 0.05;
        currentValue = currentValue * (1 + change);

        data.push(currentValue);

        // Add label every few days to avoid clutter
        if (i % Math.ceil(days / 5) === 0) {
            labels.push(date.getDate().toString());
        } else {
            labels.push('');
        }
    }
    return { data, labels };
};

interface PortfolioChartProps {
    currentValue: number;
    history?: Array<{ date: string; valueTry: number }>;
}

export const PortfolioChart: React.FC<PortfolioChartProps> = ({ currentValue, history = [] }) => {
    const { colors, fontScale } = useTheme();
    const [range, setRange] = useState<'1W' | '1M' | '3M'>('1W');
    const screenWidth = Dimensions.get('window').width;

    // Helper to filter history based on range
    const getHistoryData = (range: '1W' | '1M' | '3M') => {
        if (!history || history.length < 2) return null;

        const now = new Date();
        const cutoff = new Date();
        if (range === '1W') cutoff.setDate(now.getDate() - 7);
        if (range === '1M') cutoff.setDate(now.getDate() - 30);
        if (range === '3M') cutoff.setDate(now.getDate() - 90);

        const filtered = history.filter(h => new Date(h.date) >= cutoff);
        if (filtered.length < 2) return null; // Not enough data for chart

        const data = filtered.map(h => h.valueTry);
        const labels = filtered.map((h, i) => {
            // Show label for first, middle, last points to avoid clutter
            if (i === 0 || i === filtered.length - 1 || i === Math.floor(filtered.length / 2)) {
                const d = new Date(h.date);
                return `${d.getDate()}/${d.getMonth() + 1}`;
            }
            return '';
        });

        // Add current value as the last point if it's different/newer
        // (Optional optimization)

        return { data, labels };
    };

    const realData = getHistoryData(range);

    // Demo Data Generator (Fallback)
    const demoDataMap = {
        '1W': generateDemoData(7, currentValue * 0.95),
        '1M': generateDemoData(30, currentValue * 0.90),
        '3M': generateDemoData(90, currentValue * 0.85),
    };

    const chartData = {
        labels: realData ? realData.labels : demoDataMap[range].labels,
        datasets: [
            {
                data: realData ? realData.data : demoDataMap[range].data,
                color: (opacity = 1) => colors.primary, // optional
                strokeWidth: 2 // optional
            }
        ],
    };

    const chartConfig = {
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
            stroke: colors.border,
            strokeWidth: 0.5
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text, fontSize: 18 * fontScale }]}>Portföy Değeri</Text>
                {/* Changes badge could go here */}
            </View>

            <LineChart
                data={chartData}
                width={screenWidth - 60} // Container padding * 2 + parent padding
                height={220}
                chartConfig={chartConfig}
                bezier
                style={{
                    marginVertical: 8,
                    borderRadius: 16,
                    marginLeft: -10 // Adjust for left padding of chart
                }}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLabels={true}
                withVerticalLabels={true}
                yAxisLabel="₺"
                yAxisInterval={1}
            />

            <View style={styles.rangeContainer}>
                {(['1W', '1M', '3M'] as const).map((r) => (
                    <TouchableOpacity
                        key={r}
                        style={[
                            styles.rangeButton,
                            range === r && { backgroundColor: colors.primary + '20' } // 20% opacity primary
                        ]}
                        onPress={() => setRange(r)}
                    >
                        <Text style={[
                            styles.rangeText,
                            { color: range === r ? colors.primary : colors.subText }
                        ]}>
                            {r === '1W' ? '1 Hafta' : r === '1M' ? '1 Ay' : '3 Ay'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontWeight: '700',
    },
    rangeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        marginTop: 10,
        gap: 12,
    },
    rangeButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    rangeText: {
        fontSize: 13,
        fontWeight: '600',
    }
});
