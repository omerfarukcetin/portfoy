import React, { useState, useRef } from 'react';
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
}

export const ShareableDonutChart: React.FC<ShareableDonutChartProps> = (props) => {
    const [hidePrices, setHidePrices] = useState(false);
    const chartRef = useRef<any>(null);

    const handleShare = async () => {
        try {
            if (Platform.OS === 'web') {
                // Web: Use html2canvas
                const element = chartRef.current;
                if (!element) return;

                const canvas = await html2canvas(element, {
                    backgroundColor: props.colors.cardBackground,
                    scale: 2, // Higher quality
                });

                // Convert to blob and download
                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `portfolio-distribution-${Date.now()}.png`;
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                    }
                });
            } else {
                // Mobile: Use ViewShot
                const uri = await chartRef.current.capture();
                Alert.alert('Başarılı', 'Görsel kaydedildi!');
                // TODO: Share or save to gallery
            }
        } catch (error) {
            console.error('Screenshot error:', error);
            Alert.alert('Hata', 'Görsel oluşturulamadı');
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
        <View style={[styles.container, { backgroundColor: props.colors.cardBackground }]}>
            {/* Header with icon controls */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: props.colors.text }]}>
                    Portföy Dağılımı
                </Text>
                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: props.colors.border + '40' }]}
                        onPress={() => setHidePrices(!hidePrices)}
                    >
                        <Text style={{ fontSize: 16 }}>{hidePrices ? '👁️' : '🙈'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: props.colors.primary + '20' }]}
                        onPress={handleShare}
                    >
                        <Text style={{ fontSize: 16 }}>💾</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chart */}
            <View style={styles.chartWrapper}>
                <DonutChart
                    {...props}
                    data={displayData}
                    centerText={displayCenterText}
                    centerSubtext={displayCenterSubtext}
                />
            </View>

            {/* Legend - Always included for download, hidden when prices hidden */}
            <View style={styles.legend}>
                {props.data.map((item, index) => {
                    const total = props.data.reduce((sum, d) => sum + d.value, 0);
                    const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';

                    return (
                        <View key={index} style={styles.legendItem}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                                <Text style={[styles.legendText, { color: props.colors.text }]} numberOfLines={1}>
                                    {item.name}
                                </Text>
                            </View>
                            <Text style={[styles.legendPercent, { color: props.colors.subText }]}>
                                {hidePrices ? '••%' : `%${percentage}`}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Watermark for privacy mode */}
            {hidePrices && (
                <View style={styles.watermark}>
                    <Text style={[styles.watermarkText, { color: props.colors.subText }]}>
                        Tutarlar gizlendi
                    </Text>
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
};

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

