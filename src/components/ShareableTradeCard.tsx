import React, { useRef } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { LinearGradient } from 'expo-linear-gradient';
import html2canvas from 'html2canvas';
// @ts-ignore
import ViewShot from 'react-native-view-shot';

interface ShareableTradeCardProps {
    symbol: string;
    profitPercent: number;
    date: string;
    onClose?: () => void;
}

export interface ShareableTradeCardHandle {
    captureImage: () => Promise<void>;
}

export const ShareableTradeCard = React.forwardRef<ShareableTradeCardHandle, ShareableTradeCardProps>(({
    symbol,
    profitPercent,
    date
}, ref) => {
    const { colors, theme } = useTheme();
    const cardRef = useRef<any>(null);

    React.useImperativeHandle(ref, () => ({
        captureImage: handleCapture
    }));

    const handleCapture = async () => {
        try {
            if (Platform.OS === 'web') {
                const element = cardRef.current;
                if (!element) return;

                const canvas = await html2canvas(element, {
                    backgroundColor: null,
                    scale: 3,
                    useCORS: true,
                });

                canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `islem-ozeti-${symbol}-${Date.now()}.png`;
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                    }
                }, 'image/png', 1.0);
            } else {
                if (cardRef.current && cardRef.current.capture) {
                    const uri = await cardRef.current.capture();
                    Alert.alert('Başarılı', 'Görsel kaydedildi.');
                }
            }
        } catch (error) {
            console.error('Capture error:', error);
            Alert.alert('Hata', 'Görsel oluşturulamadı.');
        }
    };

    const isProfit = profitPercent >= 0;

    const CardContent = (
        <LinearGradient
            colors={isProfit ? ['#059669', '#10b981'] : ['#dc2626', '#ef4444']}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <View style={styles.header}>
                <Text style={styles.symbolText}>{symbol}</Text>
                <Text style={styles.dateText}>{new Date(date).toLocaleDateString()}</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.plLabel}>GERÇEKLEŞEN KÂR</Text>
                <Text style={styles.percentText}>
                    {isProfit ? '+' : ''}{profitPercent.toFixed(1)}%
                </Text>
            </View>

            <View style={styles.footer}>
                <Text style={styles.appTitle}>Portföy Cepte</Text>
            </View>
        </LinearGradient>
    );

    if (Platform.OS === 'web') {
        return (
            <div ref={cardRef} style={{ width: 340, padding: 20 }}>
                {CardContent}
            </div>
        );
    }

    return (
        <ViewShot ref={cardRef} options={{ format: 'png', quality: 1.0 }}>
            <View style={{ padding: 20 }}>
                {CardContent}
            </View>
        </ViewShot>
    );
});

const styles = StyleSheet.create({
    card: {
        width: 300,
        height: 180,
        borderRadius: 24,
        padding: 24,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    symbolText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 1,
    },
    dateText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
    content: {
        alignItems: 'center',
    },
    plLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 4,
    },
    percentText: {
        color: '#FFFFFF',
        fontSize: 48,
        fontWeight: '900',
    },
    footer: {
        alignItems: 'flex-end',
    },
    appTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 2,
    }
});
