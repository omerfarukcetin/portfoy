import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface TickerIconProps {
    symbol: string;
    color?: string;
    size?: number;
}

export const TickerIcon: React.FC<TickerIconProps> = ({ symbol, color, size = 40 }) => {
    const { colors } = useTheme();

    const getInitials = (text: string) => {
        if (!text) return '';
        // Special icons or truncated text
        if (text === 'TRY') return '₺';
        if (text === 'USD') return '$';
        if (text === 'EUR') return '€';
        if (text.startsWith('XU100')) return 'BIST';

        return text.substring(0, 2).toUpperCase();
    };

    const displayColor = color || colors.primary;

    return (
        <View style={[
            styles.container,
            {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: displayColor + '20', // 20% opacity
            }
        ]}>
            <Text style={[styles.text, { color: displayColor, fontSize: size * 0.4 }]}>
                {getInitials(symbol)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontWeight: '700',
    }
});
