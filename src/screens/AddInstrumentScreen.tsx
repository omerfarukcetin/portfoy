import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { MarketDataService } from '../services/marketData';
import { Instrument } from '../types';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useFavorites } from '../context/FavoritesContext';
import { Ionicons } from '@expo/vector-icons';

export const AddInstrumentScreen = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Instrument[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
    const [amount, setAmount] = useState('');
    const [cost, setCost] = useState('');
    const [currency, setCurrency] = useState<'USD' | 'TRY'>('TRY');
    const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [category, setCategory] = useState<'BIST' | 'ABD' | 'ALTIN' | 'KRIPTO' | 'FON' | 'BES'>('BIST');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [historicalRate, setHistoricalRate] = useState('');

    // Crypto Search States
    const [cryptoQuery, setCryptoQuery] = useState('');
    const [cryptoResults, setCryptoResults] = useState<any[]>([]);
    const [isSearchingCrypto, setIsSearchingCrypto] = useState(false);

    // BES States
    const [besPrincipal, setBesPrincipal] = useState('');
    const [besStateContrib, setBesStateContrib] = useState('');
    const [besStateContribYield, setBesStateContribYield] = useState('');
    const [besPrincipalYield, setBesPrincipalYield] = useState('');

    const { addToPortfolio } = usePortfolio();
    const { addFavorite, removeFavorite, isFavorite } = useFavorites();
    const { colors } = useTheme();
    const navigation = useNavigation();

    // Auto-load for Gold/BES/Crypto when tab changes
    useEffect(() => {
        if (category === 'ALTIN' || category === 'BES') {
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
        if (text.length > 0 || category === 'ALTIN' || category === 'BES') {
            setLoading(true);
            const data = await MarketDataService.searchInstruments(text, category);
            setResults(data);
            setLoading(false);
        } else {
            setResults([]);
        }
    };

    const handleSelect = (item: Instrument) => {
        setSelectedInstrument(item);
        // Default currency based on category
        if (category === 'ABD' || category === 'KRIPTO') {
            setCurrency('USD');
        } else {
            setCurrency('TRY');
        }
    };

    const handleAdd = async () => {
        if (!selectedInstrument) {
            Alert.alert('Hata', 'Lütfen bir varlık seçin');
            return;
        }

        // Validation for BES
        if (category === 'BES') {
            if (!besPrincipal || !besStateContrib || !besStateContribYield || !besPrincipalYield) {
                Alert.alert('Hata', 'Lütfen tüm BES alanlarını doldurun');
                return;
            }
        } else {
            if (!amount || !cost) {
                Alert.alert('Hata', 'Lütfen miktar ve maliyet alanlarını doldurun');
                return;
            }
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            Alert.alert('Hata', 'Geçersiz tarih formatı');
            return;
        }

        const dateTs = new Date(dateStr).getTime();
        const rate = parseFloat(historicalRate.replace(',', '.'));

        try {
            if (category === 'BES') {
                const principal = parseFloat(besPrincipal.replace(',', '.'));
                const state = parseFloat(besStateContrib.replace(',', '.'));
                const stateYield = parseFloat(besStateContribYield.replace(',', '.'));
                const principalYield = parseFloat(besPrincipalYield.replace(',', '.'));

                await addToPortfolio(
                    selectedInstrument,
                    1, // Amount is 1 for BES
                    principal, // Cost is principal
                    'TRY',
                    dateTs,
                    undefined,
                    {
                        principal,
                        stateContrib: state,
                        stateContribYield: stateYield,
                        principalYield: principalYield
                    }
                );
            } else {
                // Pass the historical rate if available
                await addToPortfolio(selectedInstrument, parseFloat(amount), parseFloat(cost), currency, dateTs, isNaN(rate) ? undefined : rate);
            }

            Alert.alert('Başarılı', 'Varlık portföye eklendi');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Hata', 'Ekleme başarısız oldu');
        }
    };



    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {!selectedInstrument ? (
                <>
                    <View style={styles.tabContainer}>
                        {['BIST', 'ABD', 'ALTIN', 'KRIPTO', 'FON', 'BES'].map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.tab, category === cat && { backgroundColor: colors.primary }]}
                                onPress={() => setCategory(cat as any)}
                            >
                                <Text style={[styles.tabText, { color: category === cat ? '#fff' : colors.subText }]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {category === 'KRIPTO' ? (
                        <>
                            <TextInput
                                style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                                placeholder="Kripto ara (örn: Bitcoin, Ethereum)"
                                placeholderTextColor={colors.subText}
                                value={cryptoQuery}
                                onChangeText={setCryptoQuery}
                            />
                            {isSearchingCrypto ? (
                                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                            ) : cryptoResults.length > 0 ? (
                                <FlatList
                                    data={cryptoResults}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[styles.cryptoItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                                            onPress={() => {
                                                // Use CoinGecko ID for both id and instrumentId
                                                setSelectedInstrument({
                                                    id: item.id,  // CoinGecko ID (e.g., "worldcoin")
                                                    symbol: item.symbol.toUpperCase(),  // Display symbol (e.g., "WLD")
                                                    name: item.name,  // Display name (e.g., "Worldcoin")
                                                    type: 'crypto',
                                                    instrumentId: item.id  // IMPORTANT: Use CoinGecko ID, not symbol!
                                                } as Instrument);
                                                setCryptoQuery('');
                                                setCurrency('USD');
                                            }}
                                        >
                                            <Image source={{ uri: item.thumb }} style={styles.cryptoLogo} />
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={[styles.cryptoName, { color: colors.text }]}>{item.name}</Text>
                                                <Text style={[styles.cryptoSymbol, { color: colors.subText }]}>{item.symbol.toUpperCase()}</Text>
                                            </View>
                                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                                        </TouchableOpacity>
                                    )}
                                />
                            ) : cryptoQuery.length >= 2 ? (
                                <Text style={[styles.emptyText, { color: colors.subText }]}>Sonuç bulunamadı</Text>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <TextInput
                                style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                                placeholder={`${category} Ara...`}
                                placeholderTextColor={colors.subText}
                                value={query}
                                onChangeText={handleSearch}
                            />
                            {loading ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : (
                                <FlatList
                                    data={results}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => {
                                        let icon = '📈'; // Default
                                        if (item.type === 'crypto') icon = '₿';
                                        else if (item.type === 'gold' || item.type === 'metal') icon = '🪙';
                                        else if (item.type === 'fund') icon = '📊';
                                        else if (item.type === 'bes') icon = '🏦';
                                        else if (item.type === 'stock') icon = '📈';

                                        return (
                                            <TouchableOpacity
                                                style={[styles.item, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                                                onPress={() => handleSelect(item)}
                                            >
                                                <View style={styles.itemLeft}>
                                                    <Text style={{ fontSize: 24, marginRight: 12 }}>{icon}</Text>
                                                    <View>
                                                        <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
                                                        <Text style={[styles.name, { color: colors.subText }]}>{item.name}</Text>
                                                    </View>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <TouchableOpacity
                                                        style={{ padding: 8, marginRight: 8 }}
                                                        onPress={() => {
                                                            if (isFavorite(item.id)) {
                                                                removeFavorite(item.id);
                                                            } else {
                                                                addFavorite(item);
                                                            }
                                                        }}
                                                    >
                                                        <Ionicons
                                                            name={isFavorite(item.id) ? "star" : "star-outline"}
                                                            size={24}
                                                            color={isFavorite(item.id) ? "#FFD700" : colors.subText}
                                                        />
                                                    </TouchableOpacity>
                                                    <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
                                                        <Text style={[styles.type, { color: colors.primary }]}>{item.type.toUpperCase()}</Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                            )}
                        </>
                    )}
                </>
            ) : (
                <ScrollView style={[styles.form, { backgroundColor: colors.cardBackground, shadowColor: colors.text }]}>
                    <Text style={[styles.title, { color: colors.text }]}>{selectedInstrument.symbol} Ekle</Text>

                    {category === 'BES' ? (
                        <>
                            <Text style={[styles.label, { color: colors.subText }]}>Yatırılan Tutar (Ana Para)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={besPrincipal}
                                onChangeText={setBesPrincipal}
                                placeholder="0.00"
                                placeholderTextColor={colors.subText}
                            />

                            <Text style={[styles.label, { color: colors.subText }]}>Devlet Katkısı</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={besStateContrib}
                                onChangeText={setBesStateContrib}
                                placeholder="0.00"
                                placeholderTextColor={colors.subText}
                            />

                            <Text style={[styles.label, { color: colors.subText }]}>Devlet Katkısı Getirisi</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={besStateContribYield}
                                onChangeText={setBesStateContribYield}
                                placeholder="0.00"
                                placeholderTextColor={colors.subText}
                            />

                            <Text style={[styles.label, { color: colors.subText }]}>Yatırılan Tutarın Getirisi</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                keyboardType="numeric"
                                value={besPrincipalYield}
                                onChangeText={setBesPrincipalYield}
                                placeholder="0.00"
                                placeholderTextColor={colors.subText}
                            />
                        </>
                    ) : (
                        <>
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
                                            setDateStr(selectedDate.toISOString().split('T')[0]);
                                        }
                                    }}
                                />
                            )}

                            <Text style={[styles.label, { color: colors.text }]}>O günkü Dolar Kuru (Opsiyonel)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                value={historicalRate}
                                onChangeText={setHistoricalRate}
                                placeholder="Otomatik getirilir veya manuel girin"
                                placeholderTextColor={colors.subText}
                                keyboardType="numeric"
                            />

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
                                <View style={[styles.currencyToggle, { backgroundColor: colors.background }]}>
                                    <TouchableOpacity
                                        style={[styles.currencyBtn, currency === 'TRY' && { backgroundColor: colors.cardBackground }]}
                                        onPress={() => setCurrency('TRY')}
                                    >
                                        <Text style={[styles.currencyText, { color: colors.subText }, currency === 'TRY' && { color: colors.primary, fontWeight: '700' }]}>TL</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.currencyBtn, currency === 'USD' && { backgroundColor: colors.cardBackground }]}
                                        onPress={() => setCurrency('USD')}
                                    >
                                        <Text style={[styles.currencyText, { color: colors.subText }, currency === 'USD' && { color: colors.primary, fontWeight: '700' }]}>USD</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                    )}

                    <View style={styles.buttons}>
                        <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.background }]} onPress={() => setSelectedInstrument(null)}>
                            <Text style={[styles.cancelButtonText, { color: colors.subText }]}>İptal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAdd}>
                            <Text style={styles.buttonText}>Portföye Ekle</Text>
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
        padding: 20,
        paddingTop: 60,
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
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 20,
        marginBottom: 16,
        fontSize: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    input: {
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 20,
        marginBottom: 16,
        fontSize: 16,
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
        marginTop: 20,
        borderRadius: 24,
        padding: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 5,
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
});
