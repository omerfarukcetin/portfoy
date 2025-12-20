import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { MarketDataService } from '../services/marketData';
import { formatCurrency } from '../utils/formatting';
import { ChevronDown, LogOut } from 'lucide-react-native';
import { useSettings } from '../context/SettingsContext';
import { TickerIcon } from '../components/TickerIcon';
import { TransactionTimeline } from '../components/TransactionTimeline';
import { SmartInsightCard } from '../components/SmartInsightCard';
import { generateAssetInsight } from '../services/advisorService';

export const AssetDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { id } = route.params as { id: string };
    const { portfolio } = usePortfolio();
    const { colors, fontScale, fonts } = useTheme();
    const { symbolCase } = useSettings();

    const item = portfolio.find(p => p.id === id);

    const [loading, setLoading] = useState(true);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [usdRate, setUsdRate] = useState(0);
    const [change24h, setChange24h] = useState(0);

    const formatSymbol = (symbol: string) => {
        if (symbolCase === 'titlecase') {
            return symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
        }
        return symbol.toUpperCase();
    };

    useEffect(() => {
        if (item) {
            fetchData();
        }
    }, [item]);

    const fetchData = async () => {
        if (!item) return;
        setLoading(true);
        try {
            // Fetch USD rate
            const usdData = await MarketDataService.getYahooPrice('TRY=X');
            const rate = usdData?.currentPrice || 35; // Default fallback
            setUsdRate(rate);

            // Fetch asset price
            let price = 0;
            let change = 0;

            const priceResults = await MarketDataService.fetchMultiplePrices([item]);
            const result = priceResults[item.instrumentId];

            if (result) {
                price = result.currentPrice || 0;
                change = result.change24h || 0;
            }

            // Convert crypto price to TRY if needed for consistency, OR handle currency logic below
            // For logic simplicity, we keep raw fetched price and convert during display
            if (item.type === 'crypto' && item.currency === 'TRY') {
                // Crypto usually fetched in USD, but item says TRY.
                // MarketDataService.fetchMultiplePrices usually returns USD for crypto.
                // We will handle conversions in render.
            }

            setCurrentPrice(price);
            setChange24h(change);
        } catch (error) {
            console.error('Error fetching detail data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!item) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: colors.text }}>Varlık bulunamadı.</Text>
            </View>
        );
    }

    const styles = StyleSheet.create({
        container: {
            flex: 1,
        },
        scrollContent: {
            padding: 16,
            paddingTop: 10,
        },
        // Matching TransactionsScreen header exactly
        header: {
            paddingTop: 60,
            paddingBottom: 20,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center', // Ensure vertical centering if height grows
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 3,
            zIndex: 10,
            // No flex direction row
        },
        screenTitle: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
        },
        closeButton: {
            position: 'absolute',
            left: 20,
            bottom: 16, // Aligned visually with text
            padding: 4,
            zIndex: 11,
        },
        assetInfoCard: {
            backgroundColor: colors.cardBackground,
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center', // Center content
        },
        symbol: {
            fontSize: 32 * fontScale,
            fontWeight: '800',
            marginBottom: 12, // Increased spacing
            textAlign: 'center',
        },
        assetDetailsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        price: {
            fontSize: 18 * fontScale,
            fontWeight: '600',
        },
        changeTag: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            overflow: 'hidden',
        },
        change: {
            fontSize: 14 * fontScale,
            fontWeight: '700',
            color: '#fff',
        },
        amountTag: {
            fontSize: 14 * fontScale,
            color: colors.subText,
            fontWeight: '600',
            backgroundColor: colors.background, // Slight contrast
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            overflow: 'hidden',
        },
        sectionTitle: {
            fontSize: 18 * fontScale,
            fontWeight: '700',
            marginBottom: 12,
            marginTop: 10,
        },
        grid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        card: {
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            flex: 1, // Equal width
            minWidth: '45%',
        },
        cardLabel: {
            fontSize: 13 * fontScale,
            marginBottom: 6,
        },
        cardValue: {
            fontSize: 16 * fontScale,
            fontWeight: '700',
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            borderRadius: 12,
            marginTop: 24,
            backgroundColor: colors.primary,
        },
        actionText: {
            color: '#FFF',
            fontWeight: '700',
            fontSize: 16 * fontScale,
            marginLeft: 8,
        },
    });

    // --- CALCULATIONS ---

    // Special handling for BES - uses stored values, not market prices
    const isBes = item.type === 'bes';

    // Determine raw price in both currencies
    let priceInUsd = 0;
    let priceInTry = 0;

    // Is the asset inherently priced in USD (like US Stocks, Crypto usually)?
    const isPricedInUsd = item.currency === 'USD' || item.type === 'crypto';

    if (isBes) {
        // BES: Calculate current value from stored data
        const besPrincipal = item.besPrincipal || item.averageCost || 0;
        const besProfit = item.besPrincipalYield || 0;
        priceInTry = besPrincipal + besProfit; // Total current value
        priceInUsd = priceInTry / (usdRate || 1);
    } else if (isPricedInUsd) {
        priceInUsd = currentPrice;
        priceInTry = currentPrice * usdRate;
    } else {
        priceInTry = currentPrice;
        priceInUsd = currentPrice / (usdRate || 1);
    }

    // --- TRY Bazlı Hesaplamalar ---
    let costInTryForTryCalc = 0;
    let currentValueTry = 0;

    if (isBes) {
        // BES: Cost is principal, value is principal + profit
        costInTryForTryCalc = item.besPrincipal || item.averageCost || 0;
        currentValueTry = priceInTry; // Already calculated above
    } else {
        // Maliyet: Use originalCostTry if available for accurate historical tracking
        if (item.currency === 'USD') {
            costInTryForTryCalc = item.originalCostTry || (item.amount * item.averageCost * usdRate);
        } else {
            costInTryForTryCalc = item.amount * item.averageCost;
        }
        currentValueTry = item.amount * priceInTry;
    }
    const profitTry = currentValueTry - costInTryForTryCalc;
    const profitPercentTry = costInTryForTryCalc > 0 ? (profitTry / costInTryForTryCalc) * 100 : 0;
    const totalCostTry = costInTryForTryCalc;

    // --- USD Bazlı Hesaplamalar ---
    let costInUsdForUsdCalc = 0;
    let currentValueUsd = 0;

    if (isBes) {
        // BES: Cost is principal in USD, value is total in USD
        costInUsdForUsdCalc = (item.besPrincipal || item.averageCost || 0) / (usdRate || 1);
        currentValueUsd = priceInUsd;
    } else {
        if (item.currency === 'TRY') {
            costInUsdForUsdCalc = item.originalCostUsd || (item.amount * item.averageCost / usdRate);
        } else {
            costInUsdForUsdCalc = item.amount * item.averageCost;
        }
        currentValueUsd = item.amount * priceInUsd;
    }
    const profitUsd = currentValueUsd - costInUsdForUsdCalc;
    const profitPercentUsd = costInUsdForUsdCalc > 0 ? (profitUsd / costInUsdForUsdCalc) * 100 : 0;
    const totalCostUsd = costInUsdForUsdCalc;


    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Custom Header - Fixed at top */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <ChevronDown size={32} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.screenTitle}>İşlem Detayı</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Compact Asset Info Card */}
                <View style={[styles.assetInfoCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <View>
                        <Text style={[styles.symbol, { color: colors.text }]}>{formatSymbol(item.instrumentId)}</Text>
                        <Text style={[{ color: colors.subText, fontSize: 13, marginTop: 2 }]}>
                            {item.amount} adet
                        </Text>
                    </View>

                    {loading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.price, { color: colors.text }]}>
                                {formatCurrency(isPricedInUsd ? priceInUsd : priceInTry, isPricedInUsd ? 'USD' : 'TRY')}
                            </Text>
                            <View style={[styles.changeTag, { backgroundColor: change24h >= 0 ? colors.success : colors.danger, marginTop: 4 }]}>
                                <Text style={styles.change}>
                                    {change24h >= 0 ? '▲' : '▼'} %{Math.abs(change24h).toFixed(2)}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* 3-COLUMN GRID LAYOUT FOR WEB */}
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
                    {/* COLUMN 1: Transaction Timeline */}
                    <View style={{ flex: 1, gap: 16 }}>
                        {!loading && (
                            <TransactionTimeline
                                currentAmount={item.amount}
                                averageCost={item.averageCost}
                                currency={item.currency === 'USD' ? 'USD' : 'TRY'}
                            />
                        )}
                    </View>

                    {/* COLUMN 2: TRY Statistics */}
                    <View style={{ flex: 1, gap: 16 }}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>🇹🇷 Türk Lirası Bazında</Text>
                        <View style={{ gap: 12 }}>
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardLabel, { color: colors.subText }]}>Toplam Değer</Text>
                                <Text style={[styles.cardValue, { color: colors.text }]}>{formatCurrency(currentValueTry, 'TRY')}</Text>
                            </View>
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardLabel, { color: colors.subText }]}>Maliyet</Text>
                                <Text style={[styles.cardValue, { color: colors.text }]}>{formatCurrency(totalCostTry, 'TRY')}</Text>
                            </View>
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardLabel, { color: colors.subText }]}>Kar / Zarar</Text>
                                <Text style={[styles.cardValue, { color: profitTry >= 0 ? colors.success : colors.danger }]}>
                                    {formatCurrency(profitTry, 'TRY')}
                                </Text>
                            </View>
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardLabel, { color: colors.subText }]}>K/Z Oranı</Text>
                                <Text style={[styles.cardValue, { color: profitPercentTry >= 0 ? colors.success : colors.danger }]}>
                                    %{profitPercentTry.toFixed(2)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* COLUMN 3: USD Statistics + AI Insights */}
                    <View style={{ flex: 1, gap: 16 }}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>🇺🇸 Dolar Bazında</Text>
                        <View style={{ gap: 12 }}>
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardLabel, { color: colors.subText }]}>Toplam Değer</Text>
                                <Text style={[styles.cardValue, { color: colors.text }]}>{formatCurrency(currentValueUsd, 'USD')}</Text>
                            </View>
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardLabel, { color: colors.subText }]}>Maliyet</Text>
                                <Text style={[styles.cardValue, { color: colors.text }]}>{formatCurrency(totalCostUsd, 'USD')}</Text>
                            </View>
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardLabel, { color: colors.subText }]}>Kar / Zarar</Text>
                                <Text style={[styles.cardValue, { color: profitUsd >= 0 ? colors.success : colors.danger }]}>
                                    {formatCurrency(profitUsd, 'USD')}
                                </Text>
                            </View>
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardLabel, { color: colors.subText }]}>K/Z Oranı</Text>
                                <Text style={[styles.cardValue, { color: profitPercentUsd >= 0 ? colors.success : colors.danger }]}>
                                    %{profitPercentUsd.toFixed(2)}
                                </Text>
                            </View>
                        </View>

                        {/* AI Smart Insight */}
                        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>🤖 Akıllı Analiz</Text>
                        {!loading && (
                            <SmartInsightCard
                                insight={generateAssetInsight(
                                    isPricedInUsd ? priceInUsd : priceInTry,
                                    item.averageCost,
                                    change24h,
                                    item.amount
                                )}
                            />
                        )}
                    </View>
                </View>

                {/* Actions */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => (navigation as any).navigate('SellAsset', { id: item.id })}
                >
                    <LogOut size={20} color="#FFF" />
                    <Text style={styles.actionText}>Satış Yap</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

