import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';

// Demo Data Generator for single asset
const generateAssetDemoData = (days: number, currentPrice: number) => {
    const data = [];
    const labels = [];
    let price = currentPrice * 0.92; // Start 8% lower for realistic growth

    for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        // Random fluctuation between -3% and +3.5%
        const change = (Math.random() - 0.48) * 0.065;
        price = price * (1 + change);

        data.push(price);

        // Add label every few days to avoid clutter
        if (i % Math.ceil(days / 5) === 0) {
            labels.push(`${date.getDate()}/${date.getMonth() + 1}`);
        } else {
            labels.push('');
        }
    }

    // Ensure last point is current price
    data[data.length - 1] = currentPrice;

    return { data, labels };
};

interface AssetPriceChartProps {
    currentPrice: number;
    currency: 'TRY' | 'USD';
    assetName: string;
}

export const AssetPriceChart: React.FC<AssetPriceChartProps> = ({
    currentPrice,
    currency,
    assetName
}) => {
    const { colors, fontScale } = useTheme();
    const [range, setRange] = useState<'1W' | '1M' | '3M'>('1W');
    const screenWidth = Dimensions.get('window').width;

    // Generate demo data based on selected range
    const demoDataMap = {
        '1W': generateAssetDemoData(7, currentPrice),
        '1M': generateAssetDemoData(30, currentPrice),
        '3M': generateAssetDemoData(90, currentPrice),
    };

    const chartData = {
        labels: demoDataMap[range].labels,
        datasets: [
            {
                data: demoDataMap[range].data,
                color: (opacity = 1) => colors.primary,
                strokeWidth: 2.5
            }
        ],
    };

    // Calculate price change for selected range
    const priceChange = currentPrice - demoDataMap[range].data[0];
    const priceChangePercent = (priceChange / demoDataMap[range].data[0]) * 100;
    const isPositive = priceChange >= 0;

    const chartConfig = {
        backgroundGradientFrom: colors.cardBackground,
        backgroundGradientTo: colors.cardBackground,
        decimalPlaces: 2,
        color: (opacity = 1) => colors.primary,
        labelColor: (opacity = 1) => colors.subText,
        style: {
            borderRadius: 16
        },
        propsForDots: {
            r: "0", // Hide dots for cleaner look
        },
        propsForBackgroundLines: {
            strokeDasharray: "",
            stroke: colors.border,
            strokeWidth: 0.5
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.text, fontSize: 16 * fontScale }]}>Fiyat Grafiği</Text>
                    <Text style={[styles.subtitle, { color: colors.subText, fontSize: 12 * fontScale }]}>
                        {range === '1W' ? 'Son 7 Gün' : range === '1M' ? 'Son 30 Gün' : 'Son 90 Gün'}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.changeValue, {
                        color: isPositive ? colors.success : colors.danger,
                        fontSize: 14 * fontScale
                    }]}>
                        {isPositive ? '+' : ''}{formatCurrency(priceChange, currency)}
                    </Text>
                    <Text style={[styles.changePercent, {
                        color: isPositive ? colors.success : colors.danger,
                        fontSize: 12 * fontScale
                    }]}>
                        {isPositive ? '▲' : '▼'} {Math.abs(priceChangePercent).toFixed(2)}%
                    </Text>
                </View>
            </View>

            <LineChart
                data={chartData}
                width={screenWidth - 64}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={{
                    marginVertical: 8,
                    borderRadius: 16,
                    marginLeft: -10
                }}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLabels={true}
                withVerticalLabels={true}
                yAxisLabel={currency === 'TRY' ? '₺' : '$'}
                yAxisInterval={1}
            />

            <View style={styles.rangeContainer}>
                {(['1W', '1M', '3M'] as const).map((r) => (
                    <TouchableOpacity
                        key={r}
                        style={[
                            styles.rangeButton,
                            range === r && { backgroundColor: colors.primary + '20' }
                        ]}
                        onPress={() => setRange(r)}
                    >
                        <Text style={[
                            styles.rangeText,
                            { color: range === r ? colors.primary : colors.subText, fontSize: 13 * fontScale }
                        ]}>
                            {r === '1W' ? '1H' : r === '1M' ? '1A' : '3A'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Demo Data Notice */}
            <View style={[styles.notice, { backgroundColor: colors.background }]}>
                <Text style={[styles.noticeText, { color: colors.subText, fontSize: 11 * fontScale }]}>
                    💡 Demo veri gösteriliyor. Gerçek fiyat geçmişi yakında eklenecek.
                </Text>
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
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    title: {
        fontWeight: '700',
        marginBottom: 2,
    },
    subtitle: {
        fontWeight: '500',
    },
    changeValue: {
        fontWeight: '700',
    },
    changePercent: {
        fontWeight: '600',
        marginTop: 2,
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
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    rangeText: {
        fontWeight: '600',
    },
    notice: {
        marginTop: 12,
        padding: 8,
        borderRadius: 8,
    },
    noticeText: {
        textAlign: 'center',
        fontStyle: 'italic',
    }
});
