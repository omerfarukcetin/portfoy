import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { PortfolioItem } from '../types';
import { formatCurrency } from '../utils/formatting';
import { TickerIcon } from './TickerIcon';

interface AssetRowProps {
    item: PortfolioItem;
    currentPrice: number;
    changePercent: number;
    displayCurrency: 'TRY' | 'USD';
    usdRate: number;
    onPress: () => void;
    onLongPress: () => void;
    color?: string; // Theme color for the icon
    onSell?: () => void; // Optional sell action for web
    onEdit?: () => void; // Optional edit action for web
}

export const AssetRow: React.FC<AssetRowProps> = ({
    item,
    currentPrice,
    changePercent,
    displayCurrency,
    usdRate,
    onPress,
    onLongPress,
    color,
    onSell,
    onEdit
}) => {
    const { colors } = useTheme();

    // ... rest of component logic ...

    // For custom assets, use customCurrentPrice if available
    let effectivePrice = item.customCurrentPrice || currentPrice;
    let displayPrice = effectivePrice;
    let displayValue = item.amount * effectivePrice;
    let displayCost = item.amount * item.averageCost;

    // BES special handling - calculate value from BES fields
    if (item.type === 'bes') {
        displayValue = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
        displayCost = item.besPrincipal || 0;
        displayPrice = displayValue; // Show total value as "price"
    }

    // Get display name - use customName for custom assets
    const displayName = item.customName || item.instrumentId;

    // For proper P/L calculation with different percentages:
    // Use original cost in the target currency if available, otherwise convert
    if (displayCurrency === 'USD' && item.currency === 'TRY') {
        // Convert TRY price to USD
        displayPrice = currentPrice / usdRate;
        displayValue = displayValue / usdRate;
        // Use original USD cost if stored, else convert (this gives same %)
        displayCost = item.originalCostUsd || (displayCost / usdRate);
    } else if (displayCurrency === 'TRY' && item.currency === 'USD') {
        // Convert USD price to TRY
        displayPrice = currentPrice * usdRate;
        displayValue = displayValue * usdRate;
        // Use original TRY cost if stored, else convert
        displayCost = item.originalCostTry || (displayCost * usdRate);
    }

    const profitLoss = displayValue - displayCost;
    const profitLossPercent = displayCost > 0 ? (profitLoss / displayCost) * 100 : 0;
    const isProfit = profitLoss >= 0;
    const plSign = isProfit ? '+' : '';

    const formatSymbol = (symbol: string) => {
        // Simple formatting
        return symbol.replace('.IS', '').replace('TRY=X', 'USD/TRY');
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
        >
            <View style={styles.leftContainer}>
                {Platform.OS === 'web' && (
                    <TickerIcon symbol={item.customName ? item.customName.substring(0, 3).toUpperCase() : formatSymbol(item.instrumentId)} color={color || colors.primary} />
                )}
                <View style={styles.textContainer}>
                    <Text style={[styles.symbol, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>{displayName.startsWith('custom_') ? (item.customName || 'Varlık') : formatSymbol(displayName)}</Text>
                    <Text style={[styles.amount, { color: colors.subText }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>
                        {formatCurrency(displayPrice, displayCurrency)} × {item.amount.toLocaleString('tr-TR')}
                    </Text>
                    {changePercent !== 0 ? (
                        <Text style={[styles.dailyChange, { color: changePercent >= 0 ? colors.success : colors.danger }]} numberOfLines={1}>
                            {changePercent >= 0 ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                        </Text>
                    ) : Platform.OS === 'web' ? (
                        <Text style={[styles.dailyChange, { color: colors.subText }]} numberOfLines={1}>-</Text>
                    ) : null}
                </View>
            </View>

            <View style={styles.rightContainer}>
                {/* Hide cost label on mobile */}
                {Platform.OS === 'web' && (
                    <Text style={[styles.costLabel, { color: colors.subText }]}>
                        Maliyet: {formatCurrency(item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                    </Text>
                )}
                <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(displayValue, displayCurrency)}</Text>
                <View style={[styles.plContainer, { backgroundColor: isProfit ? colors.success + '15' : colors.danger + '15' }]}>
                    <Text style={[styles.plText, { color: isProfit ? colors.success : colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                        {plSign}{formatCurrency(profitLoss, displayCurrency)} ({plSign}{Math.abs(profitLossPercent).toFixed(1)}%)
                    </Text>
                </View>
            </View>

        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Platform.OS === 'web' ? 16 : 12,
        paddingHorizontal: Platform.OS === 'web' ? 20 : 16,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Platform.OS === 'web' ? 14 : 10,
        flex: 1.5,
    },
    textContainer: {
        justifyContent: 'center',
        flex: 1,
    },
    symbol: {
        fontSize: Platform.OS === 'web' ? 15 : 14,
        fontWeight: '700',
        marginBottom: 2,
        letterSpacing: 0.3,
    },
    cryptoName: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 2,
    },
    amount: {
        fontSize: Platform.OS === 'web' ? 12 : 11,
        opacity: 0.7,
    },
    rightContainer: {
        alignItems: 'flex-end',
        flex: 1,
        marginLeft: 8,
    },
    costLabel: {
        fontSize: 9,
        fontWeight: '500',
        marginBottom: 3,
        opacity: 0.6,
    },
    value: {
        fontSize: Platform.OS === 'web' ? 15 : 14,
        fontWeight: '700',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 45 : 25,
        paddingBottom: 12,
        paddingHorizontal: 15,
    },
    plText: {
        fontSize: Platform.OS === 'web' ? 11 : 11,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    plContainer: {
        paddingHorizontal: Platform.OS === 'web' ? 8 : 6,
        paddingVertical: 4,
        borderRadius: 8,
    },
    dailyChange: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 3,
        opacity: 0.8,
    },
});
