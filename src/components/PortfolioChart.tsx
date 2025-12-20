import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Platform, Alert } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import html2canvas from 'html2canvas';
// @ts-ignore
import ViewShot from 'react-native-view-shot';

// ... existing generateDemoData logic ...
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
    isMobile?: boolean;
}

export interface PortfolioChartHandle {
    captureImage: () => Promise<void>;
}

export const PortfolioChart = forwardRef<PortfolioChartHandle, PortfolioChartProps>(({ currentValue, history = [], isMobile = false }, ref) => {
    const { colors, fontScale } = useTheme();
    const [range, setRange] = useState<'1W' | '1M' | '3M'>('1W');
    const chartRef = useRef<any>(null);
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = isMobile ? screenWidth - 32 : screenWidth - 60;

    useImperativeHandle(ref, () => ({
        captureImage: handleCapture
    }));

    const handleCapture = async () => {
        try {
            if (Platform.OS === 'web') {
                const element = chartRef.current;
                if (!element) return;

                const canvas = await html2canvas(element, {
                    backgroundColor: colors.cardBackground,
                    scale: 3,
                    useCORS: true,
                    logging: false
                });

                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `portfoy-grafigi-${Date.now()}.png`;
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                    }
                }, 'image/png', 1.0);
            } else {
                if (chartRef.current && chartRef.current.capture) {
                    const uri = await chartRef.current.capture();
                    Alert.alert('Başarılı', 'Görsel kaydedilmeye hazır.');
                }
            }
        } catch (error) {
            console.error('Capture error:', error);
            Alert.alert('Hata', 'Görsel oluşturulamadı.');
        }
    };

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

    const ChartContainer = (
        <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text, fontSize: 18 * fontScale }]}>Portföy Değeri</Text>
            </View>

            <LineChart
                data={chartData}
                width={chartWidth}
                height={isMobile ? 180 : 220}
                chartConfig={chartConfig}
                bezier
                style={{
                    marginVertical: 8,
                    borderRadius: 16,
                    marginLeft: isMobile ? -20 : -10
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

    if (Platform.OS === 'web') {
        return (
            <div ref={chartRef} style={{ width: '100%' }}>
                {ChartContainer}
            </div>
        );
    }

    return (
        <ViewShot ref={chartRef} options={{ format: 'png', quality: 1.0 }}>
            {ChartContainer}
        </ViewShot>
    );
});

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        paddingHorizontal: 8, // Reduce internal horizontal padding for mobile
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
