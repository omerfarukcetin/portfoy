import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { PortfolioItem } from '../types';
import { formatCurrency } from '../utils/formatting';
import { TickerIcon } from './TickerIcon';
import { Feather } from '@expo/vector-icons';

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
    onSell
}) => {
    const { colors } = useTheme();

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
                <TickerIcon symbol={item.customName ? item.customName.substring(0, 3).toUpperCase() : formatSymbol(item.instrumentId)} color={color || colors.primary} />
                <View style={styles.textContainer}>
                    <Text style={[styles.symbol, { color: colors.text }]}>{displayName.startsWith('custom_') ? (item.customName || 'Varlık') : formatSymbol(displayName)}</Text>
                    <Text style={[styles.amount, { color: colors.subText }]}>
                        {formatCurrency(displayPrice, displayCurrency)} × {item.amount} Adet
                    </Text>
                    {/* Hide daily change on mobile */}
                    {Platform.OS === 'web' && changePercent !== 0 ? (
                        <Text style={[styles.dailyChange, { color: changePercent >= 0 ? colors.success : colors.danger }]}>
                            {changePercent >= 0 ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                        </Text>
                    ) : Platform.OS === 'web' ? (
                        <Text style={[styles.dailyChange, { color: colors.subText }]}>-</Text>
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
                <Text style={[styles.value, { color: colors.text }]}>{formatCurrency(displayValue, displayCurrency)}</Text>
                <View style={[styles.plContainer, { backgroundColor: isProfit ? colors.success + '15' : colors.danger + '15' }]}>
                    <Text style={[styles.plText, { color: isProfit ? colors.success : colors.danger }]}>
                        {plSign}{formatCurrency(profitLoss, displayCurrency)} ({plSign}{Math.abs(profitLossPercent).toFixed(1)}%)
                    </Text>
                </View>
            </View>

            {/* Web: Show Sell button inline - smaller on mobile */}
            {Platform.OS === 'web' && onSell && (
                <TouchableOpacity
                    style={{
                        backgroundColor: colors.danger,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 8,
                        minWidth: 32,
                    }}
                    onPress={onSell}
                >
                    <Feather name="trending-down" size={14} color="#fff" />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Platform.OS === 'web' ? 12 : 10,
        paddingHorizontal: Platform.OS === 'web' ? 16 : 12,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Platform.OS === 'web' ? 12 : 10,
        flex: 1,
    },
    textContainer: {
        justifyContent: 'center',
    },
    symbol: {
        fontSize: Platform.OS === 'web' ? 16 : 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    cryptoName: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 2,
    },
    amount: {
        fontSize: Platform.OS === 'web' ? 13 : 11,
    },
    rightContainer: {
        alignItems: 'flex-end',
    },
    costLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 2,
    },
    value: {
        fontSize: Platform.OS === 'web' ? 16 : 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    plContainer: {
        paddingHorizontal: Platform.OS === 'web' ? 6 : 5,
        paddingVertical: 2,
        borderRadius: 6,
    },
    plText: {
        fontSize: Platform.OS === 'web' ? 12 : 10,
        fontWeight: '600',
    },
    dailyChange: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
});
