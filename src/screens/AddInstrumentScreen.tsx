import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { MarketDataService } from '../services/marketData';
import { Instrument } from '../types';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useFavorites } from '../context/FavoritesContext';
import { CategoryTabs } from '../components/add-instrument/CategoryTabs';
import { InstrumentResultsList } from '../components/add-instrument/InstrumentResultsList';

const getLocalDateString = (date: Date = new Date()) =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);

const webDateInputStyle = (colors: any) => ({
    padding: 12,
    fontSize: 16,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.inputBackground,
    color: colors.text,
    width: '100%',
    minHeight: 48,
});

const formatNumberCurrency = (value: number, currency: 'USD' | 'TRY') => {
    if (!Number.isFinite(value)) return '-';
    if (currency === 'USD') {
        return `$${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const AddInstrumentScreen = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Instrument[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
    const [amount, setAmount] = useState('');
    const [cost, setCost] = useState('');
    const [currency, setCurrency] = useState<'USD' | 'TRY'>('TRY');
    const [dateStr, setDateStr] = useState(getLocalDateString());
    const [category, setCategory] = useState<'BIST' | 'ABD' | 'EMTIA' | 'KRIPTO' | 'FON' | 'BES' | 'DIGER' | 'NAKIT' | 'DÖVİZ'>('BIST');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [historicalRate, setHistoricalRate] = useState('');

    // Crypto Search States
    const [cryptoQuery, setCryptoQuery] = useState('');
    const [cryptoResults, setCryptoResults] = useState<any[]>([]);
    const [isSearchingCrypto, setIsSearchingCrypto] = useState(false);

    // BES States (simplified: principal and profit only)
    const [besPrincipal, setBesPrincipal] = useState('');
    const [besProfit, setBesProfit] = useState('');

    // Custom category states (for DIGER)
    const [customAssetName, setCustomAssetName] = useState('');
    const [customCategoryName, setCustomCategoryName] = useState('');
    const [customCurrentUnitPrice, setCustomCurrentUnitPrice] = useState(''); // Current unit price for DIGER

    const [useFromCash, setUseFromCash] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isCommissionEnabled, setIsCommissionEnabled] = useState(false);
    const [commissionRate, setCommissionRate] = useState('0.2');
    const [showAdvancedFields, setShowAdvancedFields] = useState(false);

    const { addToPortfolio, cashBalance } = usePortfolio();
    const { addFavorite, removeFavorite, isFavorite } = useFavorites();
    const { colors } = useTheme();
    const navigation = useNavigation();

    // Auto-load for Emtia/BES when tab changes
    useEffect(() => {
        if (category === 'EMTIA' || category === 'BES') {
            handleSearch('');
        } else {
            setResults([]);
            setQuery('');
        }
    }, [category]);

    // Auto-fetch price and rate when date or instrument changes
    useEffect(() => {
        const fetchData = async () => {
            if (dateStr.length === 10) {
                const date = new Date(dateStr).getTime();
                if (!isNaN(date)) {
                    setLoading(true);

                    // Fetch Historical Price of Asset
                    if (selectedInstrument) {
                        const price = await MarketDataService.getHistoricalPrice(selectedInstrument.symbol, date);
                        if (price > 0) {
                            setCost(price.toFixed(2));
                        }
                    }

                    // Fetch Historical USD/TRY Rate
                    const rate = await MarketDataService.getHistoricalRate(date);
                    if (rate) {
                        setHistoricalRate(rate.toFixed(4));
                    }

                    setLoading(false);
                }
            }
        };
        fetchData();
    }, [dateStr, selectedInstrument]);

    // Crypto search with debounce
    useEffect(() => {
        if (category !== 'KRIPTO' || !cryptoQuery || cryptoQuery.length < 2) {
            setCryptoResults([]);
            return;
        }

        setIsSearchingCrypto(true);
        const timer = setTimeout(async () => {
            try {
                const results = await MarketDataService.searchCrypto(cryptoQuery);
                setCryptoResults(results);
            } catch (error) {
                console.error('Crypto search error:', error);
                setCryptoResults([]);
            } finally {
                setIsSearchingCrypto(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [cryptoQuery, category]);

    const handleSearch = async (text: string) => {
        setQuery(text);
        if (text.length > 0 || category === 'EMTIA' || category === 'BES') {
            setLoading(true);
            // Map EMTIA to ALTIN for MarketDataService compatibility
            const searchCategory = category === 'EMTIA' ? 'ALTIN' : category;
            const data = await MarketDataService.searchInstruments(text, searchCategory as any);
            setResults(data);
            setLoading(false);
        } else {
            setResults([]);
        }
    };

    const handleSelect = (item: Instrument) => {
        setSelectedInstrument(item);
        setShowAdvancedFields(false);
        // Default currency based on category
        if (category === 'ABD' || category === 'KRIPTO') {
            setCurrency('USD');
        } else if (category === 'DÖVİZ') {
            setCurrency('TRY'); // User is buying currency with TRY
        } else {
            setCurrency('TRY');
        }
    };

    const resetSelection = () => {
        setSelectedInstrument(null);
        setShowAdvancedFields(false);
    };

    // Platform-aware alert function
    const showAlert = (title: string, message: string) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}: ${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const handleAdd = async () => {
        if (!selectedInstrument) {
            showAlert('Hata', 'Lütfen bir varlık seçin');
            return;
        }

        if (isAdding) return;

        // Validation based on category
        if (category === 'BES') {
            if (!besPrincipal || !besProfit) {
                showAlert('Hata', 'Lütfen Ana Para ve Kâr alanlarını doldurun');
                return;
            }
        } else if (category === 'DIGER') {
            if (!amount || !cost || !customCurrentUnitPrice) {
                showAlert('Hata', 'Lütfen adet, maliyet ve güncel birim fiyatı girin');
                return;
            }
        } else {
            if (!amount || !cost) {
                showAlert('Hata', 'Lütfen miktar ve maliyet alanlarını doldurun');
                return;
            }
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            showAlert('Hata', 'Geçersiz tarih formatı');
            return;
        }

        setIsAdding(true);
        const dateTs = date.getTime();
        const rate = parseFloat(historicalRate.replace(',', '.'));

        try {
            if (category === 'BES') {
                const principal = parseFloat(besPrincipal.replace(',', '.'));
                const profit = parseFloat(besProfit.replace(',', '.'));

                await addToPortfolio(
                    selectedInstrument,
                    1,
                    principal,
                    'TRY',
                    dateTs,
                    undefined,
                    {
                        principal,
                        stateContrib: 0,
                        stateContribYield: 0,
                        principalYield: profit
                    }
                );
            } else if (category === 'DIGER') {
                const customCat = customCategoryName || 'Diğer';
                const amountVal = parseFloat(amount.replace(',', '.'));
                const costVal = parseFloat(cost.replace(',', '.'));
                const currentPriceVal = parseFloat(customCurrentUnitPrice.replace(',', '.'));

                await addToPortfolio(
                    selectedInstrument,
                    amountVal,
                    costVal,
                    'TRY',
                    dateTs,
                    isNaN(rate) ? undefined : rate,
                    undefined,
                    customCat,
                    { name: customAssetName, currentPrice: currentPriceVal }
                );
            } else {
                const amountVal = parseFloat(amount.replace(',', '.'));
                const costVal = parseFloat(cost.replace(',', '.'));
                let totalCost = amountVal * costVal;
                
                if (isCommissionEnabled && category !== 'FON') {
                    const rateVal = parseFloat(commissionRate.replace(',', '.')) || 0;
                    const commissionAmount = totalCost * (rateVal / 100);
                    totalCost += commissionAmount;
                }
                const actualCost = totalCost / amountVal;

                const deduct = useFromCash && currency === 'TRY';

                if (deduct && totalCost > cashBalance) {
                    showAlert('Hata', 'Yedek akçe bakiyesi yetersiz!');
                    setIsAdding(false);
                    return;
                }

                await addToPortfolio(
                    selectedInstrument,
                    amountVal,
                    actualCost,
                    currency,
                    dateTs,
                    isNaN(rate) ? undefined : rate,
                    undefined,
                    undefined,
                    undefined,
                    deduct
                );
            }

            showAlert('Başarılı', 'Varlık portföye eklendi');
            navigation.goBack();
        } catch (error) {
            console.error('🔴 AddInstrumentScreen: Error adding instrument:', error);
            showAlert('Hata', 'Ekleme başarısız oldu');
        } finally {
            setIsAdding(false);
        }
    };

    const amountValue = parseFloat(amount.replace(',', '.')) || 0;
    const costValue = parseFloat(cost.replace(',', '.')) || 0;
    const customCurrentValue = parseFloat(customCurrentUnitPrice.replace(',', '.')) || 0;
    const commissionRateValue = parseFloat(commissionRate.replace(',', '.')) || 0;
    const commissionAmount = isCommissionEnabled && category !== 'FON'
        ? amountValue * costValue * (commissionRateValue / 100)
        : 0;
    const totalPurchaseAmount = amountValue * costValue + commissionAmount;
    const effectiveUnitCost = amountValue > 0 ? totalPurchaseAmount / amountValue : 0;
    const estimatedRemainingCash = useFromCash && currency === 'TRY'
        ? cashBalance - totalPurchaseAmount
        : cashBalance;
    const selectedCategoryLabel = category === 'DIGER' ? (customCategoryName || 'Özel Varlık') : category;
    const selectionTitle = category === 'DIGER'
        ? 'Özel varlığını tanımla'
        : 'Portföyüne eklemek istediğin varlığı seç';
    const selectionSubtitle = category === 'DIGER'
        ? 'İsim ve kategori gir, sonra işlem detayını tamamla.'
        : 'Önce varlığı bul, sonra sade bir işlem formuyla portföye ekle.';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {!selectedInstrument ? (
                <View style={{ flex: 1 }}>
                    <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.stepBadge}>
                            <Text style={[styles.stepBadgeText, { color: colors.primary }]}>1/2</Text>
                        </View>
                        <Text style={[styles.heroTitle, { color: colors.text }]}>{selectionTitle}</Text>
                        <Text style={[styles.heroSubtitle, { color: colors.subText }]}>{selectionSubtitle}</Text>
                    </View>

                    <CategoryTabs
                        activeCategory={category}
                        colors={colors}
                        onCategorySelect={setCategory}
                        onCashManagementPress={() => navigation.navigate('CashManagement' as never)}
                    />

                    {category === 'KRIPTO' ? (
                        <>
                            <View style={[styles.searchCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Kripto Ara</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.subText }]}>Coin adını ya da sembolünü yaz.</Text>
                                <TextInput
                                    style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                                    placeholder="Bitcoin, Ethereum, Solana..."
                                    placeholderTextColor={colors.subText}
                                    value={cryptoQuery}
                                    onChangeText={setCryptoQuery}
                                />
                            </View>
                            {isSearchingCrypto ? (
                                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                            ) : cryptoResults.length > 0 ? (
                                <InstrumentResultsList
                                    isCryptoMode
                                    cryptoResults={cryptoResults}
                                    results={[]}
                                    colors={colors}
                                    isFavorite={isFavorite}
                                    onSelectInstrument={(instrument) => {
                                        setSelectedInstrument(instrument);
                                        setCryptoQuery('');
                                        setCurrency('USD');
                                    }}
                                    onToggleFavorite={(instrument) => {
                                        if (isFavorite(instrument.id)) {
                                            removeFavorite(instrument.id);
                                        } else {
                                            addFavorite(instrument);
                                        }
                                    }}
                                />
                            ) : cryptoQuery.length >= 2 ? (
                                <Text style={[styles.emptyText, { color: colors.subText }]}>Sonuç bulunamadı</Text>
                            ) : (
                                <Text style={[styles.helperText, { color: colors.subText }]}>Arama yapmak için en az 2 harf gir.</Text>
                            )}
                        </>
                    ) : category === 'DIGER' ? (
                        <View style={[styles.searchCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Özel Varlık Tanımı</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.subText }]}>Önce adı ve kategoriyi belirle, sonra işlem detayına geç.</Text>

                            <Text style={[styles.label, { color: colors.text }]}>Varlık Adı</Text>
                            <TextInput
                                style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                placeholder="Gayrimenkul, araba, tahvil..."
                                placeholderTextColor={colors.subText}
                                value={customAssetName}
                                onChangeText={setCustomAssetName}
                            />

                            <Text style={[styles.label, { color: colors.text }]}>Kategori Adı</Text>
                            <TextInput
                                style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                                placeholder="Gayrimenkul, araç, özel yatırım..."
                                placeholderTextColor={colors.subText}
                                value={customCategoryName}
                                onChangeText={setCustomCategoryName}
                            />

                            {customAssetName && customCategoryName && (
                                <TouchableOpacity
                                    style={[styles.primaryInlineButton, { backgroundColor: colors.primary }]}
                                    onPress={() => {
                                        const customInstrument: Instrument = {
                                            id: `custom_${Date.now()}`,
                                            symbol: customAssetName.toUpperCase(),
                                            name: customAssetName,
                                            type: 'custom' as any
                                        };
                                        setSelectedInstrument(customInstrument);
                                        setCurrency('TRY');
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>İşlem Detayına Geç</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <>
                            <View style={[styles.searchCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>{selectedCategoryLabel} Ara</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.subText }]}>Varlığı seçtikten sonra sade bir işlem formu açılacak.</Text>
                                <TextInput
                                    style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                                    placeholder={`${category === 'EMTIA' ? 'Altın / Gümüş' : category} ara...`}
                                    placeholderTextColor={colors.subText}
                                    value={query}
                                    onChangeText={handleSearch}
                                />
                            </View>
                            {loading ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <View style={{ height: Platform.OS === 'web' ? 400 : undefined, flex: Platform.OS === 'web' ? undefined : 1 }}>
                                    <InstrumentResultsList
                                        results={results}
                                        cryptoResults={[]}
                                        colors={colors}
                                        isFavorite={isFavorite}
                                        onSelectInstrument={handleSelect}
                                        onToggleFavorite={(instrument) => {
                                            if (isFavorite(instrument.id)) {
                                                removeFavorite(instrument.id);
                                            } else {
                                                addFavorite(instrument);
                                            }
                                        }}
                                    />
                                </View>
                            )}
                        </>
                    )}
                </View>
            ) : (
                <ScrollView
                    style={[styles.form, { backgroundColor: colors.cardBackground, shadowColor: colors.text }]}
                    contentContainerStyle={{ paddingBottom: 28 }}
                >
                    <View style={styles.formHeader}>
                        <View>
                            <View style={styles.stepBadge}>
                                <Text style={[styles.stepBadgeText, { color: colors.primary }]}>2/2</Text>
                            </View>
                            <Text style={[styles.title, { color: colors.text, textAlign: 'left', marginBottom: 6 }]}>İşlem Detayı</Text>
                            <Text style={{ color: colors.subText, fontSize: 13, lineHeight: 20 }}>
                                Gereken alanları doldur, geri kalan ayrıntılar aşağıda isteğe bağlı.
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.assetPreviewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{selectedInstrument.symbol}</Text>
                            <Text style={{ color: colors.subText, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                                {selectedInstrument.name}
                            </Text>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 8 }}>
                                {selectedCategoryLabel}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.secondaryInlineButton, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                            onPress={resetSelection}
                        >
                            <Text style={{ color: colors.text, fontWeight: '700' }}>Değiştir</Text>
                        </TouchableOpacity>
                    </View>

                    {category === 'BES' ? (
                        <View style={[styles.formSectionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>BES Özeti</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.subText }]}>Bu alan toplam ana para ve güncel kâr/zararı kaydeder.</Text>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: colors.subText }]}>Ana Para (₺)</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        keyboardType="numeric"
                                        value={besPrincipal}
                                        onChangeText={setBesPrincipal}
                                        placeholder="50.000"
                                        placeholderTextColor={colors.subText}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: colors.subText }]}>Kâr / Zarar (₺)</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        keyboardType="numeric"
                                        value={besProfit}
                                        onChangeText={setBesProfit}
                                        placeholder="12.500"
                                        placeholderTextColor={colors.subText}
                                    />
                                </View>
                            </View>

                            {besPrincipal && besProfit && (
                                <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                    <Text style={{ color: colors.subText, fontSize: 12 }}>Güncel Toplam Değer</Text>
                                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 4 }}>
                                        ₺{(parseFloat(besPrincipal.replace(',', '.') || '0') + parseFloat(besProfit.replace(',', '.') || '0')).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ) : category === 'DIGER' ? (
                        <>
                            <View style={[styles.formSectionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Temel Bilgiler</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.subText }]}>Özel varlığın adetini, maliyetini ve güncel değerini gir.</Text>

                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.subText, fontSize: 12 }]}>Adet</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, height: 48 }]}
                                            keyboardType="numeric"
                                            value={amount}
                                            onChangeText={setAmount}
                                            placeholder="100"
                                            placeholderTextColor={colors.subText}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.subText, fontSize: 12 }]}>Maliyet (₺)</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, height: 48 }]}
                                            keyboardType="numeric"
                                            value={cost}
                                            onChangeText={setCost}
                                            placeholder="100"
                                            placeholderTextColor={colors.subText}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.subText, fontSize: 12 }]}>Güncel (₺)</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, height: 48 }]}
                                            keyboardType="numeric"
                                            value={customCurrentUnitPrice}
                                            onChangeText={setCustomCurrentUnitPrice}
                                            placeholder="120"
                                            placeholderTextColor={colors.subText}
                                        />
                                    </View>
                                </View>

                                <Text style={[styles.label, { color: colors.subText }]}>Tarih</Text>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        value={dateStr}
                                        onChange={(e: any) => setDateStr(e.target.value)}
                                        style={webDateInputStyle(colors)}
                                    />
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, justifyContent: 'center', height: 48 }]}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={{ color: colors.text, fontSize: 14 }}>{dateStr}</Text>
                                    </TouchableOpacity>
                                )}
                                {Platform.OS !== 'web' && showDatePicker && (
                                    <DateTimePicker
                                        value={new Date(dateStr)}
                                        mode="date"
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(false);
                                            if (selectedDate) {
                                                setDateStr(getLocalDateString(selectedDate));
                                            }
                                        }}
                                    />
                                )}
                            </View>

                            {amount && cost && customCurrentUnitPrice && (
                                <View style={[styles.summaryCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                    <View>
                                        <Text style={{ color: colors.subText, fontSize: 11 }}>Toplam Maliyet</Text>
                                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 }}>
                                            ₺{(amountValue * costValue).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ color: colors.subText, fontSize: 11 }}>Bugünkü Değer</Text>
                                        <Text style={{
                                            color: customCurrentValue >= costValue ? '#22c55e' : '#ef4444',
                                            fontSize: 16,
                                            fontWeight: '800',
                                            marginTop: 4
                                        }}>
                                            {customCurrentValue >= costValue ? '+' : ''}₺{((amountValue * customCurrentValue) - (amountValue * costValue)).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </>
                    ) : (
                        <>
                            <View style={[styles.formSectionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Temel Bilgiler</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.subText }]}>Miktar, tarih ve maliyeti gir. Uygun alanlar otomatik doldurulur.</Text>

                                <Text style={[styles.label, { color: colors.subText }]}>Miktar</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                    keyboardType="numeric"
                                    value={amount}
                                    onChangeText={setAmount}
                                    placeholder="0"
                                    placeholderTextColor={colors.subText}
                                />

                                <Text style={[styles.label, { color: colors.subText }]}>Tarih</Text>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        value={dateStr}
                                        onChange={(e: any) => setDateStr(e.target.value)}
                                        style={webDateInputStyle(colors)}
                                    />
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, justifyContent: 'center' }]}
                                            onPress={() => setShowDatePicker(true)}
                                        >
                                            <Text style={{ color: colors.text, fontSize: 16 }}>{dateStr}</Text>
                                        </TouchableOpacity>
                                        {showDatePicker && (
                                            <DateTimePicker
                                                value={new Date(dateStr)}
                                                mode="date"
                                                display="default"
                                                onChange={(event, selectedDate) => {
                                                    setShowDatePicker(false);
                                                    if (selectedDate) {
                                                        setDateStr(getLocalDateString(selectedDate));
                                                    }
                                                }}
                                            />
                                        )}
                                    </>
                                )}

                                <Text style={[styles.label, { color: colors.subText }]}>Birim Maliyet</Text>
                                <View style={styles.row}>
                                    <TextInput
                                        style={[styles.input, { flex: 1, backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        keyboardType="numeric"
                                        value={cost}
                                        onChangeText={setCost}
                                        placeholder="0.00"
                                        placeholderTextColor={colors.subText}
                                    />
                                    <View style={[styles.currencyToggle, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                        <TouchableOpacity
                                            style={[styles.currencyBtn, currency === 'TRY' && { backgroundColor: colors.primary + '18' }]}
                                            onPress={() => setCurrency('TRY')}
                                        >
                                            <Text style={[styles.currencyText, { color: currency === 'TRY' ? colors.primary : colors.subText, fontWeight: '700' }]}>TL</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.currencyBtn, currency === 'USD' && { backgroundColor: colors.primary + '18' }]}
                                            onPress={() => setCurrency('USD')}
                                        >
                                            <Text style={[styles.currencyText, { color: currency === 'USD' ? colors.primary : colors.subText, fontWeight: '700' }]}>USD</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {category === 'KRIPTO' && currency === 'TRY' && (
                                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: -8, marginBottom: 4, marginLeft: 4 }}>
                                        Piyasa fiyatı USD çekilip otomatik TL'ye çevrilir.
                                    </Text>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.advancedToggle, { backgroundColor: colors.background, borderColor: colors.border }]}
                                onPress={() => setShowAdvancedFields(!showAdvancedFields)}
                            >
                                <View>
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Gelişmiş Alanlar</Text>
                                    <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                                        Kur, komisyon ve nakit kaynağı ayarları
                                    </Text>
                                </View>
                                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                                    {showAdvancedFields ? 'Gizle' : 'Göster'}
                                </Text>
                            </TouchableOpacity>

                            {showAdvancedFields && (
                                <View style={[styles.formSectionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                    <Text style={[styles.label, { color: colors.text }]}>O günkü Dolar Kuru (Opsiyonel)</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                            value={historicalRate}
                                            onChangeText={setHistoricalRate}
                                            placeholder="Otomatik getirilir veya manuel girin"
                                            placeholderTextColor={colors.subText}
                                            keyboardType="numeric"
                                        />
                                        {loading && <ActivityIndicator style={{ marginLeft: 10 }} color={colors.primary} />}
                                    </View>

                                    {category !== 'FON' && (
                                        <>
                                            <View style={[styles.cashToggleContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginBottom: 12 }]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.label, { color: colors.text, marginBottom: 2 }]}>Komisyon Ekle</Text>
                                                    <Text style={{ color: colors.subText, fontSize: 12 }}>Maliyete otomatik yansıtılır</Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={[styles.toggleButton, { backgroundColor: isCommissionEnabled ? colors.primary : colors.background, borderColor: colors.border }]}
                                                    onPress={() => setIsCommissionEnabled(!isCommissionEnabled)}
                                                >
                                                    <Text style={{ color: isCommissionEnabled ? '#fff' : colors.text, fontWeight: '600' }}>{isCommissionEnabled ? 'Var' : 'Yok'}</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {isCommissionEnabled && (
                                                <View style={{ marginBottom: 8 }}>
                                                    <Text style={[styles.label, { color: colors.subText }]}>Komisyon Oranı (%)</Text>
                                                    <TextInput
                                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                                        keyboardType="numeric"
                                                        value={commissionRate}
                                                        onChangeText={setCommissionRate}
                                                        placeholder="0.2"
                                                        placeholderTextColor={colors.subText}
                                                    />
                                                    {amount && cost && (
                                                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: -8, marginLeft: 4 }}>
                                                            Yeni birim maliyet: {effectiveUnitCost.toFixed(4)} {currency}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                        </>
                                    )}

                                    {currency === 'TRY' && (
                                        <View style={[styles.cashToggleContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginBottom: 0 }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.label, { color: colors.text, marginBottom: 2 }]}>Yedek Akçeden Kullan</Text>
                                                <Text style={{ color: colors.subText, fontSize: 12 }}>
                                                    Bakiye: {cashBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.toggleButton,
                                                    { backgroundColor: useFromCash ? colors.primary : colors.background, borderColor: colors.border }
                                                ]}
                                                onPress={() => setUseFromCash(!useFromCash)}
                                            >
                                                <Text style={{ color: useFromCash ? '#fff' : colors.text, fontWeight: '600' }}>
                                                    {useFromCash ? 'Evet' : 'Hayır'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}

                            {(amount || cost) && (
                                <View style={[styles.summaryCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                    <View style={styles.summaryRow}>
                                        <Text style={{ color: colors.subText, fontSize: 12 }}>Toplam alış tutarı</Text>
                                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
                                            {formatNumberCurrency(totalPurchaseAmount, currency)}
                                        </Text>
                                    </View>
                                    {isCommissionEnabled && category !== 'FON' && (
                                        <View style={styles.summaryRow}>
                                            <Text style={{ color: colors.subText, fontSize: 12 }}>Komisyon</Text>
                                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                                                {formatNumberCurrency(commissionAmount, currency)}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.summaryRow}>
                                        <Text style={{ color: colors.subText, fontSize: 12 }}>Yeni birim maliyet</Text>
                                        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '800' }}>
                                            {effectiveUnitCost > 0 ? `${effectiveUnitCost.toFixed(4)} ${currency}` : '-'}
                                        </Text>
                                    </View>
                                    {useFromCash && currency === 'TRY' && (
                                        <View style={styles.summaryRow}>
                                            <Text style={{ color: colors.subText, fontSize: 12 }}>Tahmini kalan nakit</Text>
                                            <Text style={{ color: estimatedRemainingCash >= 0 ? colors.text : '#ef4444', fontSize: 14, fontWeight: '800' }}>
                                                ₺{estimatedRemainingCash.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </>
                    )}

                    <View style={styles.buttons}>
                        <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.background }]} onPress={resetSelection}>
                            <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Geri Dön</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.addButton,
                                { backgroundColor: colors.primary },
                                isAdding && { opacity: 0.7 }
                            ]}
                            onPress={handleAdd}
                            disabled={isAdding}
                        >
                            {isAdding ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.buttonText}>Portföye Ekle</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: Platform.OS === 'web' ? 16 : 20,
        paddingTop: Platform.OS === 'web' ? 20 : 60,
        maxWidth: Platform.OS === 'web' ? 600 : undefined,
        alignSelf: Platform.OS === 'web' ? 'center' : undefined,
        width: '100%',
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    tabText: {
        fontWeight: '600',
        fontSize: 12,
    },
    searchInput: {
        height: Platform.OS === 'web' ? 48 : 56,
        borderRadius: Platform.OS === 'web' ? 12 : 16,
        paddingHorizontal: Platform.OS === 'web' ? 14 : 20,
        marginBottom: Platform.OS === 'web' ? 12 : 16,
        fontSize: Platform.OS === 'web' ? 15 : 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    heroCard: {
        borderWidth: 1,
        borderRadius: 22,
        padding: 20,
        marginBottom: 16,
    },
    stepBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(37, 99, 235, 0.10)',
        marginBottom: 12,
    },
    stepBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '800',
    },
    heroSubtitle: {
        fontSize: 14,
        marginTop: 8,
        lineHeight: 21,
    },
    searchCard: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 14,
    },
    primaryInlineButton: {
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 16,
    },
    secondaryInlineButton: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    input: {
        height: Platform.OS === 'web' ? 48 : 56,
        borderRadius: Platform.OS === 'web' ? 12 : 16,
        paddingHorizontal: Platform.OS === 'web' ? 14 : 20,
        marginBottom: Platform.OS === 'web' ? 12 : 16,
        fontSize: Platform.OS === 'web' ? 15 : 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    list: {
        flex: 1,
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    symbol: {
        fontSize: 16,
        fontWeight: '700',
    },
    name: {
        fontSize: 13,
        marginTop: 2,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    type: {
        fontSize: 10,
        fontWeight: '700',
    },
    form: {
        marginTop: Platform.OS === 'web' ? 12 : 20,
        borderRadius: Platform.OS === 'web' ? 16 : 24,
        padding: Platform.OS === 'web' ? 16 : 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 5,
    },
    formHeader: {
        marginBottom: 20,
    },
    assetPreviewCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
    },
    formSectionCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    advancedToggle: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    summaryCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        gap: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectedTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 24,
        textAlign: 'center',
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
        marginLeft: 4,
    },
    rowInput: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    currencyToggle: {
        flexDirection: 'row',
        marginLeft: 12,
        borderRadius: 12,
        padding: 4,
        height: 56,
        alignItems: 'center',
        borderWidth: 1,
    },
    currencyBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    currencyText: {
        fontWeight: '600',
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 32,
    },
    addButton: {
        paddingVertical: 18,
        borderRadius: 16,
        flex: 1,
        marginLeft: 10,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    cancelButton: {
        paddingVertical: 18,
        borderRadius: 16,
        flex: 1,
        marginRight: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    cancelButtonText: {
        fontWeight: '700',
        fontSize: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 24,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cryptoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
    },
    cryptoLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    cryptoName: {
        fontSize: 16,
        fontWeight: '700',
    },
    cryptoSymbol: {
        fontSize: 13,
        marginTop: 2,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 14,
    },
    helperText: {
        textAlign: 'center',
        marginTop: 24,
        fontSize: 13,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    customAddButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    cashToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 20,
    },
    toggleButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
});
