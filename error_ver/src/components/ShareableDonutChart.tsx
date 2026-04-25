import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { DonutChart } from './DonutChart';
import html2canvas from 'html2canvas';
// @ts-ignore
import ViewShot from 'react-native-view-shot';

interface ShareableDonutChartProps {
    data: Array<{
        name: string;
        value: number;
        color: string;
    }>;
    size: number;
    strokeWidth: number;
    centerText?: string;
    centerSubtext?: string;
    centerTextFontSize?: number;
    colors: any;
    legend?: React.ReactNode;
    hideLegend?: boolean;
    isCompact?: boolean;
}

export interface ShareableDonutChartHandle {
    captureImage: () => Promise<void>;
}

export const ShareableDonutChart = forwardRef<ShareableDonutChartHandle, ShareableDonutChartProps>(({ isCompact = false, ...props }, ref) => {
    const [hidePrices, setHidePrices] = useState(false);
    const chartRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        captureImage: handleShare
    }));

    const handleShare = async () => {
        try {
            if (Platform.OS === 'web') {
                const element = chartRef.current;
                if (!element) return;

                const canvas = await html2canvas(element, {
                    backgroundColor: props.colors.cardBackground,
                    scale: 3, // High quality
                    useCORS: true,
                    logging: false
                });

                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `portfoy-dagilimi-${Date.now()}.png`;
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                    }
                }, 'image/png', 1.0);
            } else {
                if (chartRef.current && chartRef.current.capture) {
                    const uri = await chartRef.current.capture();
                    // In a real app, we would use expo-sharing to share or save
                    // For now, we show success
                    Alert.alert('Başarılı', 'Görsel galeriye kaydedilmeye hazır.');
                }
            }
        } catch (error) {
            console.error('Capture error:', error);
            Alert.alert('Hata', 'Görsel oluşturulamadı. Lütfen tekrar deneyin.');
        }
    };

    // Prepare data with privacy option
    const displayData = hidePrices ? props.data.map(item => ({
        ...item,
        value: 1 // Equal distribution for visual only
    })) : props.data;

    const displayCenterText = hidePrices ? '***' : props.centerText;
    const displayCenterSubtext = hidePrices ? undefined : props.centerSubtext;

    const ChartContent = (
        <View style={[
            styles.container,
            { backgroundColor: props.colors.cardBackground },
            isCompact && { padding: 0 },
            { flexDirection: 'row', alignItems: 'center', padding: 20 }
        ]}>
            {/* Chart */}
            <View style={[styles.chartWrapper, { flex: 1, marginVertical: 0 }]}>
                <DonutChart
                    {...props}
                    data={displayData}
                    centerText={displayCenterText}
                    centerSubtext={displayCenterSubtext}
                />
            </View>

            {/* Legend - Always included for download unless specifically hidden */}
            {!props.hideLegend && (
                <View style={[styles.legend, { flex: 1.2, marginLeft: 20, marginTop: 0 }]}>
                    {props.data.map((item, index) => {
                        const total = props.data.reduce((sum, d) => sum + d.value, 0);
                        const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';

                        return (
                            <View key={index} style={styles.legendItem}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                                    <Text style={[styles.legendText, { color: props.colors.text, fontSize: 12 }]} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                </View>
                                <Text style={[styles.legendPercent, { color: props.colors.subText, fontSize: 12, marginLeft: 8 }]}>
                                    {hidePrices ? '••%' : `%${percentage}`}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <div ref={chartRef} style={{ width: '100%' }}>
                {ChartContent}
            </div>
        );
    }

    return (
        <ViewShot ref={chartRef} options={{ format: 'png', quality: 1.0 }}>
            {ChartContent}
        </ViewShot>
    );
});

const styles = StyleSheet.create({
    container: {
        padding: 16,
        borderRadius: 16,
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    controls: {
        flexDirection: 'row',
        gap: 8,
    },
    iconButton: {
        padding: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chartWrapper: {
        alignItems: 'center',
        marginVertical: 16,
    },
    legend: {
        marginTop: 12,
        gap: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    legendText: {
        fontSize: 13,
        fontWeight: '600',
    },
    legendPercent: {
        fontSize: 13,
        fontWeight: '700',
    },
    watermark: {
        marginTop: 12,
        alignItems: 'center',
    },
    watermarkText: {
        fontSize: 11,
        fontStyle: 'italic',
    },
});

