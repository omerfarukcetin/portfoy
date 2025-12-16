import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { DonutChart } from './DonutChart';
import { Feather } from '@expo/vector-icons';
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
            {/* Header with controls */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: props.colors.text }]}>
                    Portföy Dağılımı
                </Text>
                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.toggleButton, { borderColor: props.colors.border }]}
                        onPress={() => setHidePrices(!hidePrices)}
                    >
                        <Feather
                            name={hidePrices ? 'eye-off' : 'eye'}
                            size={16}
                            color={props.colors.subText}
                        />
                        <Text style={[styles.toggleText, { color: props.colors.subText }]}>
                            {hidePrices ? 'Göster' : 'Gizle'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.shareButton, { backgroundColor: props.colors.primary }]}
                        onPress={handleShare}
                    >
                        <Feather name="download" size={16} color="#fff" />
                        <Text style={styles.shareText}>Kaydet</Text>
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

            {/* Legend */}
            {props.legend && !hidePrices && (
                <View style={styles.legend}>
                    {props.legend}
                </View>
            )}

            {/* Watermark for privacy mode */}
            {hidePrices && (
                <View style={styles.watermark}>
                    <Text style={[styles.watermarkText, { color: props.colors.subText }]}>
                        Fiyatlar gizlendi
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
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    shareText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    chartWrapper: {
        alignItems: 'center',
        marginVertical: 16,
    },
    legend: {
        marginTop: 16,
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
