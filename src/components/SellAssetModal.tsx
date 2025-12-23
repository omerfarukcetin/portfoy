import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { showAlert } from '../utils/alerts';
import { formatCurrency } from '../utils/formatting';
import { MarketDataService } from '../services/marketData';
import { PortfolioItem } from '../types';
import { X } from 'lucide-react-native';

interface SellAssetModalProps {
    visible: boolean;
    onClose: () => void;
    item: PortfolioItem | null;
}

export const SellAssetModal: React.FC<SellAssetModalProps> = ({ visible, onClose, item }) => {
    const { sellAsset } = usePortfolio();
    const { colors } = useTheme();
    const { t } = useLanguage();

    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const [sellDate, setSellDate] = useState('');
    const [historicalRate, setHistoricalRate] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLoadingRate, setIsLoadingRate] = useState(false);

    useEffect(() => {
        if (visible && item) {
            setAmount(item.amount.toString());
            const today = new Date();
            setSellDate(today.toISOString().split('T')[0]);
            fetchCurrentPrice();
        } else {
            // Reset state when closing
            setAmount('');
            setPrice('');
            setSellDate('');
            setHistoricalRate('');
        }
    }, [visible, item]);

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
        if (visible) fetchRate();
    }, [sellDate, visible]);

    const fetchCurrentPrice = async () => {
        if (!item) return;
        setLoading(true);
        try {
            const priceResults = await MarketDataService.fetchMultiplePrices([item]);
            const result = priceResults[item.instrumentId];
            if (result && result.currentPrice) {
                setPrice(result.currentPrice.toString());
            }
        } catch (error) {
            console.error('Error fetching current price for modal:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSell = async () => {
        if (!item || !amount || !price) {
            showAlert(t('common.error') || 'Hata', t('sellAsset.errorFields') || 'Lütfen tüm alanları doldurun.');
            return;
        }

        const amountNum = parseFloat(amount.replace(',', '.'));
        const priceNum = parseFloat(price.replace(',', '.'));
        const rateNum = historicalRate ? parseFloat(historicalRate.replace(',', '.')) : undefined;
        const dateNum = sellDate ? new Date(sellDate).getTime() : undefined;

        if (amountNum > (item?.amount || 0)) {
            showAlert(t('common.error') || 'Hata', t('sellAsset.errorAmount') || 'Satılan miktar eldeki miktardan fazla olamaz.');
            return;
        }

        try {
            await sellAsset(item.id, amountNum, priceNum, dateNum, rateNum);
            onClose(); // Close modal immediately
            // Brief timeout to ensure modal is gone before alert shows (improves UI feel)
            setTimeout(() => {
                showAlert(t('common.success') || 'Başarılı', t('sellAsset.saleSuccess') || 'Satış işlemi başarıyla kaydedildi.');
            }, 100);
        } catch (error) {
            showAlert(t('common.error') || 'Hata', t('sellAsset.saleError') || 'Satış işlemi sırasında bir hata oluştu.');
        }
    };

    if (!item) return null;

    const priceNum = parseFloat(price.replace(',', '.')) || 0;
    const amountNum = parseFloat(amount.replace(',', '.')) || 0;
    const rateNum = parseFloat(historicalRate.replace(',', '.')) || 1;

    const sellValueTry = priceNum * amountNum;
    const costTry = item.averageCost * amountNum;
    const profitTry = sellValueTry - costTry;
    const profitPercentTry = costTry > 0 ? (profitTry / costTry) * 100 : 0;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>
                                {item.instrumentId} {t('sellAsset.title') || 'Satış Yap'}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <X size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={[styles.infoCard, { backgroundColor: colors.background }]}>
                                <Text style={[styles.infoText, { color: colors.text }]}>{t('sellAsset.currentAmount') || 'Mevcut Miktar'}: {item.amount}</Text>
                                <Text style={[styles.infoText, { color: colors.text }]}>
                                    {t('sellAsset.averageCost') || 'Ort. Maliyet'}: {formatCurrency(item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                                </Text>
                            </View>

                            <Text style={[styles.label, { color: colors.subText }]}>{t('sellAsset.amountToSell') || 'Satılacak Miktar'}</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                placeholderTextColor={colors.subText}
                            />

                            <Text style={[styles.label, { color: colors.subText }]}>{t('sellAsset.sellPrice') || 'Satış Fiyatı'}</Text>
                            <View style={styles.row}>
                                <TextInput
                                    style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    keyboardType="numeric"
                                    value={price}
                                    onChangeText={setPrice}
                                    placeholderTextColor={colors.subText}
                                />
                                {loading && <ActivityIndicator style={{ marginLeft: 10 }} color={colors.primary} />}
                            </View>

                            <Text style={[styles.label, { color: colors.subText }]}>{t('sellAsset.sellDate') || 'Satış Tarihi'}</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                value={sellDate}
                                onChangeText={setSellDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.subText}
                            />

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={[styles.label, { color: colors.subText, marginBottom: 0, flex: 1 }]}>
                                    {t('sellAsset.usdRate') || 'USD Kuru (Opsiyonel)'}
                                </Text>
                                {isLoadingRate && <ActivityIndicator size="small" color={colors.primary} />}
                            </View>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={historicalRate}
                                onChangeText={setHistoricalRate}
                                placeholderTextColor={colors.subText}
                            />

                            {/* Profit Preview */}
                            {priceNum > 0 && amountNum > 0 && (
                                <View style={[styles.previewCard, { backgroundColor: colors.background, borderColor: profitTry >= 0 ? colors.success : colors.danger }]}>
                                    <Text style={[styles.previewTitle, { color: colors.text }]}>{t('sellAsset.profitPreview') || 'Kâr/Zarar Önizleme'}</Text>
                                    <View style={styles.previewRow}>
                                        <Text style={{ color: colors.subText }}>{t('sellAsset.tryProfitLoss') || 'TL Kar/Zarar'}</Text>
                                        <Text style={{ color: profitTry >= 0 ? colors.success : colors.danger, fontWeight: '700' }}>
                                            {formatCurrency(profitTry, 'TRY')} ({profitTry >= 0 ? '+' : ''}{profitPercentTry.toFixed(2)}%)
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <TouchableOpacity style={[styles.sellButton, { backgroundColor: colors.danger }]} onPress={handleSell}>
                                <Text style={styles.buttonText}>{t('sellAsset.confirmSale') || 'Satışı Onayla'}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    keyboardView: {
        width: '100%',
        maxHeight: '90%',
    },
    container: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    infoCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    infoText: {
        fontSize: 14,
        marginBottom: 4,
        fontWeight: '500',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
        fontSize: 15,
        borderWidth: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewCard: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 20,
        marginTop: 4,
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sellButton: {
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
