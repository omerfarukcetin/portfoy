import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../utils/alerts';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export const SellAssetScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { id } = route.params as { id: string };
    const { portfolio, sellAsset, deleteAsset } = usePortfolio();
    const { colors, fonts } = useTheme();

    const item = portfolio.find(p => p.id === id);
    const [amount, setAmount] = useState('');
    const [price, setPrice] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (item) {
            setAmount(item.amount.toString());
            fetchCurrentPrice();
        }
    }, [item]);

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
            showAlert('Hata', 'Lütfen miktar ve fiyat girin');
            return;
        }

        const amountNum = parseFloat(amount);
        const priceNum = parseFloat(price);

        if (amountNum > (item?.amount || 0)) {
            showAlert('Hata', 'Sahip olduğunuzdan fazlasını satamazsınız');
            return;
        }

        try {
            await sellAsset(id, amountNum, priceNum);
            showAlert('Başarılı', 'Satış gerçekleşti');
            navigation.goBack();
        } catch (error) {
            showAlert('Hata', 'Satış işlemi başarısız');
        }
    };

    if (!item) return <View style={[styles.container, { backgroundColor: colors.background }]}><Text style={{ color: colors.text }}>Varlık bulunamadı</Text></View>;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>{item.instrumentId} Satış</Text>

            <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.infoText, { color: colors.text }]}>Mevcut Miktar: {item.amount}</Text>
                <Text style={[styles.infoText, { color: colors.text }]}>
                    Ort. Maliyet: {formatCurrency(item.averageCost, item.currency === 'USD' ? 'USD' : 'TRY')}
                </Text>
            </View>

            <Text style={[styles.label, { color: colors.subText }]}>Satılacak Miktar</Text>
            <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, borderWidth: 1 }]}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholderTextColor={colors.subText}
            />

            <Text style={[styles.label, { color: colors.subText }]}>Satış Fiyatı (Birim)</Text>
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

            <TouchableOpacity style={[styles.sellButton, { backgroundColor: colors.danger }]} onPress={handleSell}>
                <Text style={styles.buttonText}>Satışı Onayla</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.deleteButton, { borderColor: colors.danger }]}
                onPress={() => {
                    Alert.alert(
                        "Varlığı Sil",
                        "Bu varlığı portföyden tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
                        [
                            { text: "İptal", style: "cancel" },
                            {
                                text: "Sil",
                                style: "destructive",
                                onPress: async () => {
                                    await deleteAsset(id);
                                    navigation.goBack();
                                }
                            }
                        ]
                    );
                }}
            >
                <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Varlığı Tamamen Sil</Text>
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
