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
    let currentBasePrice = item.customCurrentPrice || currentPrice;

    // CRITICAL FIX: If crypto is kept in TRY but price is fetched in USD (common for MarketDataService)
    if (item.type === 'crypto' && item.currency === 'TRY' && currentBasePrice > 0) {
        currentBasePrice = currentBasePrice * usdRate;
    }

    let displayPrice = currentBasePrice;
    let displayValue = item.amount * currentBasePrice;
    let displayCost = item.amount * item.averageCost;

    // BES special handling
    if (item.type === 'bes') {
        displayValue = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
        displayCost = item.besPrincipal || 0;
        displayPrice = displayValue;
    }

    // Get display name - use customName for custom assets
    const displayName = item.customName || item.instrumentId;

    // Convert to display currency if different from item currency
    if (displayCurrency === 'USD' && item.currency === 'TRY') {
        displayPrice = displayPrice / usdRate;
        displayValue = displayValue / usdRate;
        displayCost = item.originalCostUsd || (displayCost / usdRate);
    } else if (displayCurrency === 'TRY' && item.currency === 'USD') {
        displayPrice = displayPrice * usdRate;
        displayValue = displayValue * usdRate;
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
                <TickerIcon
                    symbol={item.customName ? item.customName.substring(0, 3).toUpperCase() : formatSymbol(item.instrumentId)}
                    color={color || colors.primary}
                    size={Platform.OS === 'web' ? 42 : 38}
                />
                <View style={styles.textContainer}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.symbol, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>
                            {displayName.startsWith('custom_') ? (item.customName || 'Varlık') : formatSymbol(displayName)}
                        </Text>
                        {changePercent !== 0 && (
                            <View style={[styles.changeBadge, { backgroundColor: changePercent >= 0 ? colors.success + '14' : colors.danger + '14' }]}>
                                <Text style={[styles.changeBadgeText, { color: changePercent >= 0 ? colors.success : colors.danger }]}>
                                    {changePercent >= 0 ? '+' : '-'}{Math.abs(changePercent).toFixed(2)}%
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.amount, { color: colors.subText }]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit>
                        {formatCurrency(displayPrice, displayCurrency)} × {item.amount.toLocaleString('tr-TR')}
                    </Text>
                    <Text style={[styles.detailLine, { color: colors.subText }]} numberOfLines={1}>
                        {item.currency === 'USD' ? 'ABD varligi' : 'Portfoy varligi'}
                    </Text>
                </View>
            </View>

            <View style={styles.rightContainer}>
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
        paddingVertical: Platform.OS === 'web' ? 14 : 14,
        paddingHorizontal: Platform.OS === 'web' ? 18 : 16,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Platform.OS === 'web' ? 14 : 12,
        flex: 1.45,
    },
    textContainer: {
        justifyContent: 'center',
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 3,
    },
    symbol: {
        fontSize: Platform.OS === 'web' ? 15 : 14,
        fontWeight: '800',
        letterSpacing: 0.2,
        flexShrink: 1,
    },
    cryptoName: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 2,
    },
    amount: {
        fontSize: Platform.OS === 'web' ? 12 : 11,
        opacity: 0.8,
    },
    detailLine: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
        opacity: 0.75,
    },
    rightContainer: {
        alignItems: 'flex-end',
        flex: 1,
        marginLeft: 12,
    },
    value: {
        fontSize: Platform.OS === 'web' ? 16 : 15,
        fontWeight: '800',
        marginBottom: 6,
        letterSpacing: 0.2,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 45 : 25,
        paddingBottom: 12,
        paddingHorizontal: 15,
    },
    plText: {
        fontSize: Platform.OS === 'web' ? 10 : 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    plContainer: {
        paddingHorizontal: Platform.OS === 'web' ? 9 : 8,
        paddingVertical: 5,
        borderRadius: 999,
    },
    changeBadge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    changeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
});
