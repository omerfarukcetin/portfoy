import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
    const { sellAsset, cashItems } = usePortfolio();
    const { colors } = useTheme();
    const { t } = useLanguage();

    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const [sellDate, setSellDate] = useState('');
    const [historicalRate, setHistoricalRate] = useState('');
    const [destinationCashId, setDestinationCashId] = useState('default');
    const [isTaxEnabled, setIsTaxEnabled] = useState(false);
    const [taxRate, setTaxRate] = useState('17.5');
    const [isCommissionEnabled, setIsCommissionEnabled] = useState(false);
    const [commissionRate, setCommissionRate] = useState('0.2');
    const [loading, setLoading] = useState(false);
    const [isLoadingRate, setIsLoadingRate] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        if (visible && item) {
            setAmount(item.amount.toString());
            const today = new Date();
            setSellDate(today.toISOString().split('T')[0]);
            fetchCurrentPrice();
        } else {
            setPrice('');
            setSellDate('');
            setHistoricalRate('');
            setDestinationCashId('default');
            setIsTaxEnabled(false);
            setTaxRate('17.5');
            setIsCommissionEnabled(false);
            setCommissionRate('0.2');
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
        const taxRateNum = isTaxEnabled ? (parseFloat(taxRate.replace(',', '.')) || 0) : undefined;
        const commissionRateNum = isCommissionEnabled ? (parseFloat(commissionRate.replace(',', '.')) || 0) : undefined;

        if (amountNum > (item?.amount || 0)) {
            showAlert(t('common.error') || 'Hata', t('sellAsset.errorAmount') || 'Satılan miktar eldeki miktardan fazla olamaz.');
            return;
        }

        try {
            await sellAsset(item.id, amountNum, priceNum, dateNum, rateNum, destinationCashId, taxRateNum, commissionRateNum);
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
    const taxNum = isTaxEnabled ? (parseFloat(taxRate.replace(',', '.')) || 0) : 0;
    const commNum = isCommissionEnabled ? (parseFloat(commissionRate.replace(',', '.')) || 0) : 0;

    const sellValueTry = priceNum * amountNum;
    const costTry = item.averageCost * amountNum;

    // Profit, Commission, and Tax Calculations
    const commissionAmountTry = commNum > 0 ? sellValueTry * (commNum / 100) : 0;
    const netSellValueTry = sellValueTry - commissionAmountTry;

    const grossProfitTry = netSellValueTry - costTry;
    const taxAmountTry = grossProfitTry > 0 ? grossProfitTry * (taxNum / 100) : 0;
    const netProfitTry = grossProfitTry - taxAmountTry;

    const profitPercentTry = costTry > 0 ? (grossProfitTry / costTry) * 100 : 0;
    const netProfitPercentTry = costTry > 0 ? (netProfitTry / costTry) * 100 : 0;

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

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
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
                                <>
                                    <TouchableOpacity
                                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: 'center' }]}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={{ color: colors.text, fontSize: 16 }}>{sellDate}</Text>
                                    </TouchableOpacity>
                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={new Date(sellDate)}
                                            mode="date"
                                            display="default"
                                            onChange={(event, selectedDate) => {
                                                setShowDatePicker(false);
                                                if (selectedDate) {
                                                    setSellDate(selectedDate.toISOString().split('T')[0]);
                                                }
                                            }}
                                        />
                                    )}
                                </>
                            )}

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

                            {/* Global Stopaj Toggle */}
                            <Text style={[styles.label, { color: colors.subText, marginTop: 8 }]}>Stopaj (Vergi) Kesintisi</Text>
                            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                                <TouchableOpacity
                                    style={[
                                        styles.cashOption,
                                        { flex: 1, borderColor: colors.border, backgroundColor: colors.background, marginRight: 8 },
                                        !isTaxEnabled && { backgroundColor: colors.primary, borderColor: colors.primary }
                                    ]}
                                    onPress={() => setIsTaxEnabled(false)}
                                >
                                    <Text style={[styles.cashOptionText, { color: colors.text, textAlign: 'center' }, !isTaxEnabled && { color: '#FFF' }]}>
                                        Yok
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.cashOption,
                                        { flex: 1, borderColor: colors.border, backgroundColor: colors.background, marginRight: 0 },
                                        isTaxEnabled && { backgroundColor: colors.primary, borderColor: colors.primary }
                                    ]}
                                    onPress={() => setIsTaxEnabled(true)}
                                >
                                    <Text style={[styles.cashOptionText, { color: colors.text, textAlign: 'center' }, isTaxEnabled && { color: '#FFF' }]}>
                                        Var
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {isTaxEnabled && (
                                <>
                                    <Text style={[styles.label, { color: colors.subText }]}>Stopaj Oranı (%)</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                        keyboardType="numeric"
                                        value={taxRate}
                                        onChangeText={setTaxRate}
                                        placeholder="17.5"
                                        placeholderTextColor={colors.subText}
                                    />
                                </>
                            )}
                            
                            {/* Commission Toggle */}
                            <Text style={[styles.label, { color: colors.subText, marginTop: 8 }]}>Komisyon Kesintisi</Text>
                            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                                <TouchableOpacity
                                    style={[
                                        styles.cashOption,
                                        { flex: 1, borderColor: colors.border, backgroundColor: colors.background, marginRight: 8 },
                                        !isCommissionEnabled && { backgroundColor: colors.primary, borderColor: colors.primary }
                                    ]}
                                    onPress={() => setIsCommissionEnabled(false)}
                                >
                                    <Text style={[styles.cashOptionText, { color: colors.text, textAlign: 'center' }, !isCommissionEnabled && { color: '#FFF' }]}>
                                        Yok
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.cashOption,
                                        { flex: 1, borderColor: colors.border, backgroundColor: colors.background, marginRight: 0 },
                                        isCommissionEnabled && { backgroundColor: colors.primary, borderColor: colors.primary }
                                    ]}
                                    onPress={() => setIsCommissionEnabled(true)}
                                >
                                    <Text style={[styles.cashOptionText, { color: colors.text, textAlign: 'center' }, isCommissionEnabled && { color: '#FFF' }]}>
                                        Var
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {isCommissionEnabled && (
                                <>
                                    <Text style={[styles.label, { color: colors.subText }]}>Komisyon Oranı (%)</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                        keyboardType="numeric"
                                        value={commissionRate}
                                        onChangeText={setCommissionRate}
                                        placeholder="0.2"
                                        placeholderTextColor={colors.subText}
                                    />
                                </>
                            )}

                            {/* Destination Cash Selector */}
                            <Text style={[styles.label, { color: colors.subText, marginTop: 8 }]}>Aktarılacak Kasa</Text>
                            <View style={{ marginBottom: 16 }}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, paddingRight: 16 }}>
                                    <TouchableOpacity
                                        style={[
                                            styles.cashOption,
                                            { borderColor: colors.border, backgroundColor: colors.background },
                                            destinationCashId === 'default' && { backgroundColor: colors.primary, borderColor: colors.primary }
                                        ]}
                                        onPress={() => setDestinationCashId('default')}
                                    >
                                        <Text style={[styles.cashOptionText, { color: colors.text }, destinationCashId === 'default' && { color: '#FFF' }]}>
                                            Otomatik Nakit (TL)
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.cashOption,
                                            { borderColor: colors.border, backgroundColor: colors.background },
                                            destinationCashId === 'none' && { backgroundColor: colors.primary, borderColor: colors.primary }
                                        ]}
                                        onPress={() => setDestinationCashId('none')}
                                    >
                                        <Text style={[styles.cashOptionText, { color: colors.text }, destinationCashId === 'none' && { color: '#FFF' }]}>
                                            Kasaya Aktarma
                                        </Text>
                                    </TouchableOpacity>

                                    {cashItems.filter(c => c.type === 'cash').map(cash => (
                                        <TouchableOpacity
                                            key={cash.id}
                                            style={[
                                                styles.cashOption,
                                                { borderColor: colors.border, backgroundColor: colors.background },
                                                destinationCashId === cash.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                                            ]}
                                            onPress={() => setDestinationCashId(cash.id)}
                                        >
                                            <Text style={[styles.cashOptionText, { color: colors.text }, destinationCashId === cash.id && { color: '#FFF' }]}>
                                                {cash.name} ({formatCurrency(cash.amount, cash.currency)})
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Profit Preview */}
                            {priceNum > 0 && amountNum > 0 && (
                                <View style={[styles.previewCard, { backgroundColor: colors.background, borderColor: grossProfitTry >= 0 ? colors.success : colors.danger }]}>
                                    <View style={[styles.previewRow, { marginBottom: 6 }]}>
                                        <Text style={{ color: colors.subText, fontSize: 13 }}>Brüt Kâr/Zarar</Text>
                                        <Text style={{ color: grossProfitTry >= 0 ? colors.success : colors.danger, fontWeight: '700', fontSize: 13 }}>
                                            {grossProfitTry >= 0 ? '+' : ''}{formatCurrency(grossProfitTry, 'TRY')}
                                        </Text>
                                    </View>
                                    {isCommissionEnabled && commNum > 0 && (
                                        <View style={[styles.previewRow, { marginBottom: 6 }]}>
                                            <Text style={{ color: colors.subText, fontSize: 13 }}>Komisyon Kesintisi (%{commNum})</Text>
                                            <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>
                                                -{formatCurrency(commissionAmountTry, 'TRY')}
                                            </Text>
                                        </View>
                                    )}
                                    {grossProfitTry > 0 && isTaxEnabled && taxNum > 0 && (
                                        <View style={[styles.previewRow, { marginBottom: 6 }]}>
                                            <Text style={{ color: colors.subText, fontSize: 13 }}>Stopaj Kesintisi (%{taxNum})</Text>
                                            <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>
                                                -{formatCurrency(taxAmountTry, 'TRY')}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }]}>
                                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>Net Kâr/Zarar</Text>
                                        <Text style={{ color: netProfitTry >= 0 ? colors.success : colors.danger, fontWeight: '800', fontSize: 14 }}>
                                            {netProfitTry >= 0 ? '+' : ''}{formatCurrency(netProfitTry, 'TRY')} ({netProfitTry >= 0 ? '+' : ''}{netProfitPercentTry.toFixed(2)}%)
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
        maxHeight: '92%',
    },
    container: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
        maxHeight: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    infoCard: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    infoText: {
        fontSize: 13,
        marginBottom: 2,
        fontWeight: '500',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        marginLeft: 4,
    },
    input: {
        height: 44,
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 12,
        fontSize: 14,
        borderWidth: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewCard: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        marginTop: 0,
    },
    previewTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sellButton: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    cashOption: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 8,
    },
    cashOptionText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
