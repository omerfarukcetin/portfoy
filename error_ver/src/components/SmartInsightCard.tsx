import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { AssetInsight } from '../services/advisorService';

interface SmartInsightCardProps {
    insight: AssetInsight;
}

export const SmartInsightCard: React.FC<SmartInsightCardProps> = ({ insight }) => {
    const { colors, fontScale } = useTheme();

    // Determine gradient colors based on insight type
    const getGradientColors = (): [string, string] => {
        switch (insight.type) {
            case 'success':
                return ['#10b981', '#059669']; // Green
            case 'warning':
                return ['#f59e0b', '#d97706']; // Orange
            case 'danger':
                return ['#ef4444', '#dc2626']; // Red
            case 'info':
            default:
                return ['#8b5cf6', '#7c3aed']; // Purple
        }
    };

    const gradientColors = getGradientColors();

    return (
        <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.container}
        >
            <View style={styles.header}>
                <Text style={styles.icon}>{insight.icon}</Text>
                <Text style={[styles.title, { fontSize: 16 * fontScale }]}>
                    AI Yorumu
                </Text>
            </View>

            <Text style={[styles.insightTitle, { fontSize: 15 * fontScale }]}>
                {insight.title}
            </Text>

            <Text style={[styles.message, { fontSize: 13 * fontScale }]}>
                {insight.message}
            </Text>

            <View style={styles.footer}>
                <Text style={[styles.footerText, { fontSize: 11 * fontScale }]}>
                    💡 Kural tabanlı analiz • Yatırım tavsiyesi değildir
                </Text>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    icon: {
        fontSize: 24,
    },
    title: {
        color: '#fff',
        fontWeight: '700',
        opacity: 0.9,
    },
    insightTitle: {
        color: '#fff',
        fontWeight: '800',
        marginBottom: 8,
    },
    message: {
        color: '#fff',
        fontWeight: '500',
        lineHeight: 20,
        opacity: 0.95,
    },
    footer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    footerText: {
        color: '#fff',
        fontWeight: '500',
        opacity: 0.7,
        fontStyle: 'italic',
    }
});
