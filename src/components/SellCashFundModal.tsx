import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
    const [showDatePicker, setShowDatePicker] = useState(false);

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
            await sellCashFund(item.id, amountNum, priceNum, rateNum || 1);
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
                                    <View style={styles.previewRow}>
                                        <Text style={{ color: colors.subText, fontSize: 13 }}>TL Kâr/Zarar</Text>
                                        <Text style={{ color: profitTry >= 0 ? colors.success : colors.danger, fontWeight: '700', fontSize: 13 }}>
                                            {profitTry >= 0 ? '+' : ''}{formatCurrency(profitTry, 'TRY')} ({profitTry >= 0 ? '+' : ''}{profitPercentTry.toFixed(2)}%)
                                        </Text>
                                    </View>
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
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
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
});
