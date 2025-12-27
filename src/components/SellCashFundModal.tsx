import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../utils/alerts';
import { formatCurrency } from '../utils/formatting';
import { MarketDataService } from '../services/marketData';
import { CashItem } from '../types';
import { X } from 'lucide-react-native';

interface SellCashFundModalProps {
    visible: boolean;
    onClose: () => void;
    item: CashItem | null;
    currentPrice?: number;
}

export const SellCashFundModal: React.FC<SellCashFundModalProps> = ({ visible, onClose, item, currentPrice: propCurrentPrice }) => {
    const { sellCashFund } = usePortfolio();
    const { colors } = useTheme();

    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const [sellDate, setSellDate] = useState('');
    const [historicalRate, setHistoricalRate] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLoadingRate, setIsLoadingRate] = useState(false);
    const [currentUsdRate, setCurrentUsdRate] = useState(0);

    useEffect(() => {
        if (visible && item && item.units) {
            setAmount(item.units.toString());
            const today = new Date();
            setSellDate(today.toISOString().split('T')[0]);

            // Set price from prop or fetch
            if (propCurrentPrice) {
                setPrice(propCurrentPrice.toString());
            } else {
                fetchCurrentPrice();
            }

            // Fetch current USD rate
            fetchCurrentUsdRate();
        } else {
            // Reset state when closing
            setAmount('');
            setPrice('');
            setSellDate('');
            setHistoricalRate('');
        }
    }, [visible, item, propCurrentPrice]);

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
        if (!item || !item.instrumentId) return;
        setLoading(true);
        try {
            const priceData = await MarketDataService.getTefasPrice(item.instrumentId);
            if (priceData && priceData.currentPrice) {
                setPrice(priceData.currentPrice.toString());
            }
        } catch (error) {
            console.error('Error fetching current price for modal:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentUsdRate = async () => {
        try {
            const usdData = await MarketDataService.getYahooPrice('TRY=X');
            if (usdData?.currentPrice) {
                setCurrentUsdRate(usdData.currentPrice);
            }
        } catch (error) {
            console.error('Error fetching USD rate:', error);
        }
    };

    const handleSell = async () => {
        if (!item || !amount || !price) {
            showAlert('Hata', 'Lütfen tüm alanları doldurun.');
            return;
        }

        const amountNum = parseFloat(amount.replace(',', '.'));
        const priceNum = parseFloat(price.replace(',', '.'));
        const rateNum = historicalRate ? parseFloat(historicalRate.replace(',', '.')) : currentUsdRate;

        if (amountNum > (item?.units || 0)) {
            showAlert('Hata', 'Satılan miktar eldeki miktardan fazla olamaz.');
            return;
        }

        try {
            // Use the sellCashFund function with the sell price and USD rate
            await sellCashFund(item.id, priceNum, rateNum || 1);
            onClose();
            setTimeout(() => {
                showAlert('Başarılı', 'Fon satış işlemi başarıyla kaydedildi.');
            }, 100);
        } catch (error) {
            showAlert('Hata', 'Satış işlemi sırasında bir hata oluştu.');
        }
    };

    if (!item || !item.units || !item.averageCost) return null;

    const priceNum = parseFloat(price.replace(',', '.')) || 0;
    const amountNum = parseFloat(amount.replace(',', '.')) || 0;
    const rateNum = parseFloat(historicalRate.replace(',', '.')) || currentUsdRate || 1;

    const sellValueTry = priceNum * amountNum;
    const costTry = item.averageCost * amountNum;
    const profitTry = sellValueTry - costTry;
    const profitPercentTry = costTry > 0 ? (profitTry / costTry) * 100 : 0;

    // USD calculations
    const costUsd = item.historicalUsdRate ? costTry / item.historicalUsdRate : costTry / rateNum;
    const valueUsd = sellValueTry / rateNum;
    const profitUsd = valueUsd - costUsd;
    const profitPercentUsd = costUsd > 0 ? (profitUsd / costUsd) * 100 : 0;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>
                                {item.name} Satış
                            </Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <X size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={[styles.infoCard, { backgroundColor: colors.background }]}>
                                <Text style={[styles.infoText, { color: colors.text }]}>Mevcut Pay: {item.units.toLocaleString('tr-TR')}</Text>
                                <Text style={[styles.infoText, { color: colors.text }]}>
                                    Ort. Maliyet: {formatCurrency(item.averageCost, 'TRY')}/pay
                                </Text>
                                <Text style={[styles.infoText, { color: colors.subText }]}>
                                    Toplam Maliyet: {formatCurrency(item.units * item.averageCost, 'TRY')}
                                </Text>
                            </View>

                            <Text style={[styles.label, { color: colors.subText }]}>Satılacak Pay Adedi</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                placeholderTextColor={colors.subText}
                            />

                            <Text style={[styles.label, { color: colors.subText }]}>Satış Fiyatı (Birim)</Text>
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

                            <Text style={[styles.label, { color: colors.subText }]}>Satış Tarihi</Text>
                            {Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    value={sellDate}
                                    onChange={(e: any) => setSellDate(e.target.value)}
                                    style={{
                                        padding: 12,
                                        fontSize: 16,
                                        borderRadius: 12,
                                        border: `1px solid ${colors.border}`,
                                        backgroundColor: colors.background,
                                        color: colors.text,
                                        width: '100%',
                                        height: 48,
                                        marginBottom: 16,
                                    }}
                                />
                            ) : (
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={sellDate}
                                    onChangeText={setSellDate}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={colors.subText}
                                />
                            )}

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={[styles.label, { color: colors.subText, marginBottom: 0, flex: 1 }]}>
                                    USD Kuru (Opsiyonel)
                                </Text>
                                {isLoadingRate && <ActivityIndicator size="small" color={colors.primary} />}
                            </View>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={historicalRate}
                                onChangeText={setHistoricalRate}
                                placeholder={currentUsdRate ? `Güncel: ${currentUsdRate.toFixed(2)}` : 'Otomatik'}
                                placeholderTextColor={colors.subText}
                            />

                            {/* Profit Preview */}
                            {priceNum > 0 && amountNum > 0 && (
                                <View style={[styles.previewCard, { backgroundColor: colors.background, borderColor: profitTry >= 0 ? colors.success : colors.danger }]}>
                                    <Text style={[styles.previewTitle, { color: colors.text }]}>Kâr/Zarar Önizleme</Text>

                                    <View style={styles.previewRow}>
                                        <Text style={{ color: colors.subText }}>Satış Tutarı</Text>
                                        <Text style={{ color: colors.text, fontWeight: '600' }}>
                                            {formatCurrency(sellValueTry, 'TRY')}
                                        </Text>
                                    </View>

                                    <View style={[styles.previewRow, { marginTop: 8 }]}>
                                        <Text style={{ color: colors.subText }}>TL Kâr/Zarar</Text>
                                        <Text style={{ color: profitTry >= 0 ? colors.success : colors.danger, fontWeight: '700' }}>
                                            {profitTry >= 0 ? '+' : ''}{formatCurrency(profitTry, 'TRY')} ({profitTry >= 0 ? '+' : ''}{profitPercentTry.toFixed(2)}%)
                                        </Text>
                                    </View>

                                    {rateNum > 0 && (
                                        <View style={[styles.previewRow, { marginTop: 4 }]}>
                                            <Text style={{ color: colors.subText }}>USD Kâr/Zarar</Text>
                                            <Text style={{ color: profitUsd >= 0 ? colors.success : colors.danger, fontWeight: '600', fontSize: 13 }}>
                                                {profitUsd >= 0 ? '+' : ''}${profitUsd.toFixed(2)} ({profitUsd >= 0 ? '+' : ''}{profitPercentUsd.toFixed(2)}%)
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <TouchableOpacity style={[styles.sellButton, { backgroundColor: colors.danger }]} onPress={handleSell}>
                                <Text style={styles.buttonText}>Satışı Onayla</Text>
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
