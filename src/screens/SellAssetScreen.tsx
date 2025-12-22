import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { showAlert } from '../utils/alerts';
import { formatCurrency } from '../utils/formatting';
import { MarketDataService } from '../services/marketData';

export const SellAssetScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const params = route.params as { assetId?: string; id?: string };
    const assetId = params.assetId || params.id || '';
    const { portfolio, sellAsset, deleteAsset } = usePortfolio();
    const { colors, fonts } = useTheme();
    const { t } = useLanguage();

    const item = portfolio.find(p => p.id === assetId);
    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const [sellDate, setSellDate] = useState('');
    const [historicalRate, setHistoricalRate] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLoadingRate, setIsLoadingRate] = useState(false);

    useEffect(() => {
        if (item) {
            setAmount(item.amount.toString());
            // Set today's date as default
            const today = new Date();
            setSellDate(today.toISOString().split('T')[0]);
            fetchCurrentPrice();
        }
    }, [item]);

    // Fetch historical rate when date changes
    useEffect(() => {
        const fetchRate = async () => {
            if (sellDate.length === 10) {
                const date = new Date(sellDate).getTime();
                if (!isNaN(date)) {
                    setIsLoadingRate(true);
                    const rate = await MarketDataService.getHistoricalRate(date);
                    if (rate) {
                        setHistoricalRate(rate.toFixed(4));
                    }
                    setIsLoadingRate(false);
                }
            }
        };
        fetchRate();
    }, [sellDate]);

    const fetchCurrentPrice = async () => {
        if (!item) return;
        setLoading(true);
        // Try to fetch current price to pre-fill
        let currentPrice = 0;
        const priceData = await MarketDataService.getYahooPrice(item.instrumentId);
        if (priceData && priceData.currentPrice) {
            currentPrice = priceData.currentPrice;
        } else {
            const cryptoData = await MarketDataService.getCryptoPrice(item.instrumentId.toLowerCase());
            if (cryptoData && cryptoData.currentPrice) {
                currentPrice = cryptoData.currentPrice;
            }
        }
        if (currentPrice) setPrice(currentPrice.toString());
        setLoading(false);
    };

    const handleSell = async () => {
        if (!amount || !price) {
            showAlert(t('common.error') || 'Error', t('sellAsset.errorFields'));
            return;
        }

        const amountNum = parseFloat(amount);
        const priceNum = parseFloat(price);
        const rateNum = historicalRate ? parseFloat(historicalRate) : undefined;
        const dateNum = sellDate ? new Date(sellDate).getTime() : undefined;

        if (amountNum > (item?.amount || 0)) {
            showAlert(t('common.error') || 'Error', t('sellAsset.errorAmount'));
            return;
        }

        try {
            await sellAsset(assetId, amountNum, priceNum, dateNum, rateNum);
            showAlert(t('common.success') || 'Success', t('sellAsset.saleSuccess'));
            navigation.goBack();
        } catch (error) {
            showAlert(t('common.error') || 'Error', t('sellAsset.saleError'));
        }
    };

    if (!item) return <View style={[styles.container, { backgroundColor: colors.background }]}><Text style={{ color: colors.text }}>{t('common.notFound') || 'Asset not found'}</Text></View>;

    // Calculate profit preview
    const priceNum = parseFloat(price) || 0;
    const amountNum = parseFloat(amount) || 0;
    const rateNum = parseFloat(historicalRate) || 1;

    // TRY based
    const sellValueTry = priceNum * amountNum;
    const costTry = item.averageCost * amountNum;
    const profitTry = sellValueTry - costTry;
    const profitPercentTry = costTry > 0 ? (profitTry / costTry) * 100 : 0;

    // USD based
    const sellValueUsd = item.currency === 'USD' ? priceNum : priceNum / rateNum;
    const costUsd = item.currency === 'USD' ? item.averageCost : item.averageCost / rateNum;
    const sellTotalUsd = sellValueUsd * amountNum;
    const costTotalUsd = costUsd * amountNum;
    const profitUsd = sellTotalUsd - costTotalUsd;
    const profitPercentUsd = costTotalUsd > 0 ? (profitUsd / costTotalUsd) * 100 : 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>{item.instrumentId} {t('sellAsset.title')}</Text>

            <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.infoText, { color: colors.text }]}>{t('sellAsset.currentAmount')}: {item.amount}</Text>
                <Text style={[styles.infoText, { color: colors.text }]}>
                    {t('sellAsset.averageCost')}: {formatCurrency(item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                </Text>
            </View>

            <Text style={[styles.label, { color: colors.subText }]}>{t('sellAsset.amountToSell')}</Text>
            <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, borderWidth: 1 }]}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholderTextColor={colors.subText}
            />

            <Text style={[styles.label, { color: colors.subText }]}>{t('sellAsset.sellPrice')}</Text>
            <View style={styles.row}>
                <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, borderWidth: 1 }]}
                    keyboardType="numeric"
                    value={price}
                    onChangeText={setPrice}
                    placeholderTextColor={colors.subText}
                />
                {loading && <ActivityIndicator style={{ marginLeft: 10 }} color={colors.primary} />}
            </View>

            <Text style={[styles.label, { color: colors.subText }]}>{t('sellAsset.sellDate')}</Text>
            <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, borderWidth: 1 }]}
                value={sellDate}
                onChangeText={setSellDate}
                placeholder="2024-01-15"
                placeholderTextColor={colors.subText}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.label, { color: colors.subText, marginBottom: 0, flex: 1 }]}>
                    {t('sellAsset.usdRate')}
                </Text>
                {isLoadingRate && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, borderWidth: 1 }]}
                keyboardType="numeric"
                value={historicalRate}
                onChangeText={setHistoricalRate}
                placeholder={t('sellAsset.autoLoaded')}
                placeholderTextColor={colors.subText}
            />

            {/* Profit Preview */}
            {priceNum > 0 && amountNum > 0 && (
                <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, marginTop: 8, borderWidth: 1, borderColor: profitTry >= 0 ? colors.success : colors.danger }]}>
                    <Text style={[styles.infoText, { color: colors.text, fontWeight: '700', marginBottom: 8 }]}>{t('sellAsset.profitPreview')}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: colors.subText, fontSize: 13 }}>{t('sellAsset.tryProfitLoss')}</Text>
                        <Text style={{ color: profitTry >= 0 ? colors.success : colors.danger, fontWeight: '700' }}>
                            {formatCurrency(profitTry, 'TRY')} ({profitPercentTry >= 0 ? '+' : ''}{profitPercentTry.toFixed(2)}%)
                        </Text>
                    </View>
                    {historicalRate && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: colors.subText, fontSize: 13 }}>{t('sellAsset.usdProfitLoss')}</Text>
                            <Text style={{ color: profitUsd >= 0 ? colors.success : colors.danger, fontWeight: '700' }}>
                                {formatCurrency(profitUsd, 'USD')} ({profitPercentUsd >= 0 ? '+' : ''}{profitPercentUsd.toFixed(2)}%)
                            </Text>
                        </View>
                    )}
                </View>
            )}

            <TouchableOpacity style={[styles.sellButton, { backgroundColor: colors.danger }]} onPress={handleSell}>
                <Text style={styles.buttonText}>{t('sellAsset.confirmSale')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.deleteButton, { borderColor: colors.danger }]}
                onPress={() => {
                    showAlert(
                        t('sellAsset.deleteAsset'),
                        t('sellAsset.deleteConfirm'),
                        [
                            { text: t('common.cancel'), style: "cancel" },
                            {
                                text: t('common.delete'),
                                style: "destructive",
                                onPress: async () => {
                                    await deleteAsset(assetId);
                                    navigation.goBack();
                                }
                            }
                        ]
                    );
                }}
            >
                <Text style={[styles.deleteButtonText, { color: colors.danger }]}>{t('sellAsset.deleteAsset')}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        paddingTop: 70,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    infoCard: {
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
    },
    infoText: {
        fontSize: 14,
        marginBottom: 3,
    },
    label: {
        fontSize: 13,
        marginBottom: 6,
        fontWeight: '600',
        marginLeft: 4,
    },
    input: {
        height: 44,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 12,
        fontSize: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sellButton: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    deleteButton: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 12,
        borderWidth: 1,
        backgroundColor: 'transparent',
    },
    deleteButtonText: {
        fontWeight: '600',
        fontSize: 14,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});
