import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { showAlert } from '../utils/alerts';
import { Plus, Inbox, TrendingDown, Trash2, X, DollarSign, TrendingUp, Percent } from 'lucide-react-native';
import { CashItem } from '../types';
import { MarketDataService } from '../services/marketData';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SellCashFundModal } from '../components/SellCashFundModal';

const TABLET_WIDTH = 768;

export const CashManagementScreen = () => {
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= TABLET_WIDTH;
    const { cashItems, cashBalance, addCashItem, updateCashItem, deleteCashItem, updateCash, sellCashFund } = usePortfolio();
    const { colors, fonts } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<CashItem | null>(null);
    const [formData, setFormData] = useState({
        type: 'cash' as 'cash' | 'money_market_fund' | 'deposit',
        name: '',
        amount: '',
        interestRate: '',
        currency: 'TRY' as 'TRY' | 'USD',
        units: '',
        averageCost: ''
    });

    // TEFAS Fund Search States
    const [fundQuery, setFundQuery] = useState('');
    const [fundResults, setFundResults] = useState<any[]>([]);
    const [isSearchingFund, setIsSearchingFund] = useState(false);
    const [selectedFund, setSelectedFund] = useState<any | null>(null);

    // Live prices for funds
    const [fundPrices, setFundPrices] = useState<Record<string, number>>({});

    // Date and historical rate for funds
    const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [historicalRate, setHistoricalRate] = useState('');
    const [isLoadingRate, setIsLoadingRate] = useState(false);

    // Sell modal state
    const [sellModalVisible, setSellModalVisible] = useState(false);
    const [sellingItem, setSellingItem] = useState<CashItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch historical rate when date changes
    useEffect(() => {
        const fetchRate = async () => {
            if (formData.type !== 'money_market_fund' || !selectedFund) return;

            setIsLoadingRate(true);
            try {
                const timestamp = new Date(dateStr).getTime();
                const rate = await MarketDataService.getHistoricalRate(timestamp);
                if (rate) {
                    setHistoricalRate(rate.toString());
                }
            } catch (error) {
                console.error('Error fetching historical rate:', error);
            } finally {
                setIsLoadingRate(false);
            }
        };
        fetchRate();
    }, [dateStr, selectedFund]);

    const openAddModal = () => {
        setEditingItem(null);
        setSelectedFund(null);
        setFundQuery('');
        setFundResults([]);
        setFormData({
            type: 'cash',
            name: '',
            amount: '',
            interestRate: '',
            currency: 'TRY',
            units: '',
            averageCost: ''
        });
        setModalVisible(true);
    };

    const openEditModal = (item: CashItem) => {
        setEditingItem(item);
        setSelectedFund(null);
        setFormData({
            type: item.type,
            name: item.name,
            amount: item.amount.toString(),
            interestRate: item.interestRate?.toString() || '',
            currency: item.currency,
            units: item.units?.toString() || '',
            averageCost: item.averageCost?.toString() || ''
        });
        setModalVisible(true);
    };

    // Search TEFAS funds
    const searchFunds = async (query: string) => {
        setFundQuery(query);
        if (query.length < 2) {
            setFundResults([]);
            return;
        }

        setIsSearchingFund(true);
        try {
            const results = await MarketDataService.searchInstruments(query, 'FON');
            console.log('Fund search results:', results);
            // Filter for money market funds (PPF - Para Piyasası Fonu)
            setFundResults(results.slice(0, 10));
        } catch (error) {
            console.error('Fund search error:', error);
        } finally {
            setIsSearchingFund(false);
        }
    };

    const selectFund = (fund: any) => {
        console.log('Selected fund:', fund);
        setSelectedFund(fund);
        setFormData({
            ...formData,
            name: fund.name || fund.id,
        });
        setFundResults([]);
        setFundQuery('');
    };

    // Current USD rate for live P/L calculation
    const [currentUsdRate, setCurrentUsdRate] = useState<number>(0);

    // Fetch live prices for funds in cashItems and current USD rate
    useEffect(() => {
        const fetchData = async () => {
            // Fetch current USD rate
            try {
                const usdData = await MarketDataService.getYahooPrice('TRY=X');
                if (usdData?.currentPrice) {
                    setCurrentUsdRate(usdData.currentPrice);
                }
            } catch (error) {
                console.error('Error fetching USD rate:', error);
            }

            // Fetch fund prices
            const fundItems = cashItems.filter(item => item.type === 'money_market_fund' && item.instrumentId);
            for (const item of fundItems) {
                if (item.instrumentId) {
                    try {
                        const priceResult = await MarketDataService.getTefasPrice(item.instrumentId);
                        console.log(`Fund price for ${item.instrumentId}:`, priceResult);
                        if (priceResult && priceResult.currentPrice) {
                            setFundPrices(prev => ({ ...prev, [item.instrumentId!]: priceResult.currentPrice! }));
                        }
                    } catch (error) {
                        console.error('Error fetching fund price:', error);
                    }
                }
            }
        };
        fetchData();
    }, [cashItems]);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);

        try {
            // For money market funds with selected fund
            if (formData.type === 'money_market_fund' && selectedFund) {
                const units = parseFloat(formData.units);
                const avgCost = parseFloat(formData.averageCost);

                if (isNaN(units) || units <= 0) {
                    showAlert('Hata', 'Geçerli bir adet girin');
                    return;
                }
                if (isNaN(avgCost) || avgCost <= 0) {
                    showAlert('Hata', 'Geçerli bir maliyet girin');
                    return;
                }

                const totalCost = units * avgCost;
                const rate = parseFloat(historicalRate) || undefined;
                const newItem: Omit<CashItem, 'id'> = {
                    type: 'money_market_fund',
                    name: selectedFund.name || selectedFund.id,
                    amount: totalCost, // Initial value = cost
                    currency: 'TRY',
                    instrumentId: selectedFund.id,
                    units: units,
                    averageCost: avgCost,
                    dateAdded: new Date(dateStr).getTime(),
                    historicalUsdRate: rate
                };
                await addCashItem(newItem);
                setModalVisible(false);
                return;
            }

            const amount = parseFloat(formData.amount);
            if (isNaN(amount) || amount <= 0) {
                showAlert('Hata', 'Geçerli bir miktar girin');
                return;
            }

            if (!formData.name.trim()) {
                showAlert('Hata', 'İsim boş olamaz');
                return;
            }

            if (editingItem) {
                // Update existing
                await updateCashItem(editingItem.id, amount);
            } else {
                // Add new
                const newItem: Omit<CashItem, 'id'> = {
                    type: formData.type,
                    name: formData.name,
                    amount: amount,
                    currency: formData.currency,
                    interestRate: formData.interestRate ? parseFloat(formData.interestRate) : undefined,
                    dateAdded: new Date(dateStr).getTime()
                };
                await addCashItem(newItem);
            }

            setModalVisible(false);
        } catch (error) {
            console.error('Error saving cash item:', error);
            showAlert('Hata', 'Kaydedilirken bir hata oluştu');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (item: CashItem) => {
        showAlert(
            'Sil',
            `${item.name} silinecek. Emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        console.log('🗑️ Deleting cash item:', item.id);
                        await deleteCashItem(item.id);
                    }
                }
            ]
        );
    };

    // Open sell modal for a fund
    const handleSellPPF = (item: CashItem) => {
        if (item.type !== 'money_market_fund' || !item.instrumentId || !item.units || !item.averageCost) return;
        setSellingItem(item);
        setSellModalVisible(true);
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'cash': return 'Nakit';
            case 'money_market_fund': return 'Para Piyasası Fonu';
            case 'deposit': return 'Mevduat';
            default: return type;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'cash': return DollarSign;
            case 'money_market_fund': return TrendingUp;
            case 'deposit': return Percent;
            default: return DollarSign;
        }
    };

    // Calculate total P/L across all cash items
    const calculateTotalPL = () => {
        let totalCurrentValue = 0;
        let totalCost = 0;
        let totalProfitUsd = 0;

        cashItems.forEach(item => {
            if (item.type === 'money_market_fund' && item.instrumentId && item.units && item.averageCost) {
                const livePrice = fundPrices[item.instrumentId];
                if (livePrice) {
                    const currentValue = item.units * livePrice;
                    const cost = item.units * item.averageCost;
                    totalCurrentValue += currentValue;
                    totalCost += cost;

                    // USD P/L
                    if (item.historicalUsdRate && currentUsdRate > 0) {
                        const costUsd = cost / item.historicalUsdRate;
                        const valueUsd = currentValue / currentUsdRate;
                        totalProfitUsd += (valueUsd - costUsd);
                    }
                } else {
                    totalCurrentValue += item.amount;
                    totalCost += item.amount;
                }
            } else {
                totalCurrentValue += item.amount;
                totalCost += item.amount; // For non-fund items, cost = current value
            }
        });

        const totalProfit = totalCurrentValue - totalCost;
        const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
        const totalProfitUsdPercent = totalCost > 0 && currentUsdRate > 0 ? (totalProfitUsd / (totalCost / (currentUsdRate || 1))) * 100 : 0;

        return { totalCurrentValue, totalCost, totalProfit, totalProfitPercent, totalProfitUsd, totalProfitUsdPercent };
    };

    const { totalCurrentValue, totalProfit, totalProfitPercent, totalProfitUsd, totalProfitUsdPercent } = calculateTotalPL();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Yedek Akçe</Text>
                <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
                    <Plus size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Total Balance */}
            <View style={[styles.totalCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.totalLabel, { color: colors.subText }]}>Toplam Bakiye</Text>
                <Text style={[styles.totalAmount, { color: colors.text }]}>{formatCurrency(totalCurrentValue, 'TRY')}</Text>
                {totalProfit !== 0 && (
                    <View style={{ marginTop: 8 }}>
                        <Text style={{ color: totalProfit >= 0 ? colors.success : colors.danger, fontSize: 15, fontWeight: '600' }}>
                            TRY: {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit, 'TRY')} ({totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%)
                        </Text>
                        {totalProfitUsd !== 0 && (
                            <Text style={{ color: totalProfitUsd >= 0 ? colors.success : colors.danger, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                                USD: {totalProfitUsd >= 0 ? '+' : ''}${totalProfitUsd.toFixed(2)} ({totalProfitUsdPercent >= 0 ? '+' : ''}{totalProfitUsdPercent.toFixed(2)}%)
                            </Text>
                        )}
                    </View>
                )}
            </View>

            {/* Cash Items List */}
            <SwipeListView
                data={cashItems}
                contentContainerStyle={styles.scrollContent}
                renderItem={(data) => {
                    const item = data.item;
                    // Calculate P/L for funds
                    let currentValue = item.amount;
                    let profit = 0;
                    let profitPercent = 0;
                    let cost = item.amount;

                    // USD calculations
                    let profitUsd = 0;
                    let profitUsdPercent = 0;
                    let costUsd = 0;
                    let currentValueUsd = 0;

                    if (item.type === 'money_market_fund' && item.instrumentId && item.units && item.averageCost) {
                        const livePrice = fundPrices[item.instrumentId];
                        if (livePrice) {
                            currentValue = item.units * livePrice;
                            cost = item.units * item.averageCost;
                            profit = currentValue - cost;
                            profitPercent = cost > 0 ? (profit / cost) * 100 : 0;

                            // USD P/L calculation
                            if (item.historicalUsdRate && currentUsdRate > 0) {
                                costUsd = cost / item.historicalUsdRate;
                                currentValueUsd = currentValue / currentUsdRate;
                                profitUsd = currentValueUsd - costUsd;
                                profitUsdPercent = costUsd > 0 ? (profitUsd / costUsd) * 100 : 0;
                            }
                        } else {
                            cost = item.units * item.averageCost;
                        }
                    }

                    return (
                        <View style={isLargeScreen ? styles.desktopItemContainer : null}>
                            <TouchableOpacity
                                activeOpacity={1}
                                style={[styles.itemCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, flex: isLargeScreen ? 1 : undefined }]}
                                onPress={() => openEditModal(item)}
                            >
                                <View style={styles.itemHeader}>
                                    <View style={styles.itemTitleRow}>
                                        {(() => {
                                            const Icon = getTypeIcon(item.type);
                                            return <Icon size={20} color={colors.primary} />;
                                        })()}
                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                            <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                                            <Text style={[styles.itemType, { color: colors.subText }]}>
                                                {getTypeLabel(item.type)}
                                                {item.interestRate && ` • %${item.interestRate} faiz`}
                                                {item.units && ` • ${item.units.toLocaleString('tr-TR')} adet`}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.itemFooter}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.itemAmount, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                                            {formatCurrency(currentValue, item.currency)}
                                        </Text>
                                        {item.type === 'money_market_fund' && item.instrumentId && fundPrices[item.instrumentId] && (
                                            <>
                                                <Text style={{ color: profit >= 0 ? colors.success : colors.danger, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                                                    TRY: {profit >= 0 ? '+' : ''}{formatCurrency(profit, 'TRY')} ({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%)
                                                </Text>
                                                {item.historicalUsdRate && currentUsdRate > 0 && (
                                                    <Text style={{ color: profitUsd >= 0 ? colors.success : colors.danger, fontSize: 12, fontWeight: '600', marginTop: 1 }}>
                                                        USD: {profitUsd >= 0 ? '+' : ''}${profitUsd.toFixed(2)} ({profitUsdPercent >= 0 ? '+' : ''}{profitUsdPercent.toFixed(2)}%)
                                                    </Text>
                                                )}
                                            </>
                                        )}
                                    </View>
                                    {item.type === 'money_market_fund' && item.averageCost && (
                                        <View style={{ alignItems: 'flex-end', flex: 0.8 }}>
                                            <Text style={[styles.itemCurrency, { color: colors.subText, fontSize: 12 }]} numberOfLines={1}>
                                                Maliyet: {formatCurrency(cost, 'TRY')}
                                            </Text>
                                            {item.historicalUsdRate && (
                                                <Text style={[styles.itemCurrency, { color: colors.subText, fontSize: 11 }]} numberOfLines={1}>
                                                    (${costUsd.toFixed(2)})
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {isLargeScreen && (
                                <View style={styles.desktopActions}>
                                    {item.type === 'money_market_fund' && item.units && (
                                        <TouchableOpacity
                                            style={[styles.desktopActionBtn, { backgroundColor: colors.success + '15' }]}
                                            onPress={() => handleSellPPF(item)}
                                        >
                                            <TrendingDown size={18} color={colors.success} />
                                            <Text style={[styles.desktopActionText, { color: colors.success }]}>Sat</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={[styles.desktopActionBtn, { backgroundColor: colors.primary + '15' }]}
                                        onPress={() => openEditModal(item)}
                                    >
                                        <Plus size={18} color={colors.primary} />
                                        <Text style={[styles.desktopActionText, { color: colors.primary }]}>Düzelt</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.desktopActionBtn, { backgroundColor: colors.danger + '15' }]}
                                        onPress={() => handleDelete(item)}
                                    >
                                        <Trash2 size={18} color={colors.danger} />
                                        <Text style={[styles.desktopActionText, { color: colors.danger }]}>Sil</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                }}
                renderHiddenItem={(data, rowMap) => (
                    <View style={styles.rowBack}>
                        {data.item.type === 'money_market_fund' && data.item.units && (
                            <TouchableOpacity
                                style={[styles.backRightBtn, { backgroundColor: colors.success + '15' }]}
                                onPress={() => {
                                    rowMap[data.item.id].closeRow();
                                    handleSellPPF(data.item);
                                }}
                            >
                                <TrendingDown size={20} color={colors.success} />
                                <Text style={[styles.backText, { color: colors.success }]}>Satış</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.backRightBtn, { backgroundColor: colors.primary + '15' }]}
                            onPress={() => {
                                rowMap[data.item.id].closeRow();
                                openEditModal(data.item);
                            }}
                        >
                            <Plus size={20} color={colors.primary} />
                            <Text style={[styles.backText, { color: colors.primary }]}>Düzenle</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.backRightBtn, { backgroundColor: colors.danger + '15' }]}
                            onPress={() => {
                                rowMap[data.item.id].closeRow();
                                handleDelete(data.item);
                            }}
                        >
                            <Trash2 size={20} color={colors.danger} />
                            <Text style={[styles.backText, { color: colors.danger }]}>Sil</Text>
                        </TouchableOpacity>
                    </View>
                )}
                rightOpenValue={-210}
                disableRightSwipe
                disableLeftSwipe={isLargeScreen}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Inbox size={64} color={colors.subText} />
                        <Text style={[styles.emptyText, { color: colors.subText }]}>
                            Henüz yedek akçe eklemediniz
                        </Text>
                        <TouchableOpacity
                            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                            onPress={openAddModal}
                        >
                            <Text style={styles.emptyButtonText}>İlk Kaydı Ekle</Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {editingItem ? 'Düzenle' : 'Yeni Ekle'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            {/* Type Selection */}
                            {!editingItem && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>Tür</Text>
                                    <View style={styles.typeButtons}>
                                        {[
                                            { value: 'cash', label: 'Nakit' },
                                            { value: 'money_market_fund', label: 'Para Piyasası' },
                                            { value: 'deposit', label: 'Mevduat' }
                                        ].map(type => (
                                            <TouchableOpacity
                                                key={type.value}
                                                style={[
                                                    styles.typeButton,
                                                    { borderColor: colors.border },
                                                    formData.type === type.value && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                ]}
                                                onPress={() => {
                                                    setFormData({ ...formData, type: type.value as any });
                                                    setSelectedFund(null);
                                                    setFundQuery('');
                                                    setFundResults([]);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.typeButtonText,
                                                    { color: formData.type === type.value ? '#fff' : colors.text }
                                                ]}>
                                                    {type.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* TEFAS Fund Search - For Money Market Funds */}
                            {formData.type === 'money_market_fund' && !editingItem && (
                                <>
                                    <View style={styles.formGroup}>
                                        <Text style={[styles.label, { color: colors.text }]}>TEFAS Fon Ara</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                            value={fundQuery}
                                            onChangeText={searchFunds}
                                            placeholder="Fon kodu veya ismi..."
                                            placeholderTextColor={colors.subText}
                                        />
                                        {isSearchingFund && (
                                            <ActivityIndicator style={{ marginTop: 10 }} color={colors.primary} />
                                        )}
                                        {fundResults.length > 0 && (
                                            <View style={[styles.fundResultsContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                                {fundResults.map((fund, index) => (
                                                    <TouchableOpacity
                                                        key={fund.id || index}
                                                        style={[styles.fundResultItem, { borderBottomColor: colors.border }]}
                                                        onPress={() => selectFund(fund)}
                                                    >
                                                        <Text style={[styles.fundCode, { color: colors.primary }]}>{fund.id}</Text>
                                                        <Text style={[styles.fundName, { color: colors.text }]} numberOfLines={1}>{fund.name}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    {selectedFund && (
                                        <>
                                            <View style={[styles.selectedFundCard, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                                                <Text style={[styles.fundCode, { color: colors.primary }]}>{selectedFund.id}</Text>
                                                <Text style={[styles.fundName, { color: colors.text }]}>{selectedFund.name}</Text>
                                            </View>

                                            <View style={styles.formGroup}>
                                                <Text style={[styles.label, { color: colors.text }]}>Adet (Pay)</Text>
                                                <TextInput
                                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                                    value={formData.units}
                                                    onChangeText={(text) => setFormData({ ...formData, units: text })}
                                                    placeholder="Örn: 1000"
                                                    placeholderTextColor={colors.subText}
                                                    keyboardType="numeric"
                                                />
                                            </View>

                                            <View style={styles.formGroup}>
                                                <Text style={[styles.label, { color: colors.text }]}>Birim Maliyet (₺)</Text>
                                                <TextInput
                                                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                                    value={formData.averageCost}
                                                    onChangeText={(text) => setFormData({ ...formData, averageCost: text })}
                                                    placeholder="Örn: 1.25"
                                                    placeholderTextColor={colors.subText}
                                                    keyboardType="numeric"
                                                />
                                            </View>

                                            {/* Date Picker removed - handled at bottom */}

                                            {/* Historical USD Rate */}
                                            <View style={styles.formGroup}>
                                                <Text style={[styles.label, { color: colors.text }]}>O Günkü Dolar Kuru</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <TextInput
                                                        style={[styles.input, { flex: 1, backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                                        value={historicalRate}
                                                        onChangeText={setHistoricalRate}
                                                        placeholder="Otomatik getirilir"
                                                        placeholderTextColor={colors.subText}
                                                        keyboardType="numeric"
                                                    />
                                                    {isLoadingRate && (
                                                        <ActivityIndicator style={{ marginLeft: 10 }} color={colors.primary} />
                                                    )}
                                                </View>
                                            </View>

                                            {formData.units && formData.averageCost && (
                                                <View style={[styles.totalCostCard, { backgroundColor: colors.background }]}>
                                                    <View>
                                                        <Text style={{ color: colors.subText }}>Toplam Maliyet (TRY):</Text>
                                                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>
                                                            {formatCurrency(parseFloat(formData.units) * parseFloat(formData.averageCost), 'TRY')}
                                                        </Text>
                                                    </View>
                                                    {historicalRate && (
                                                        <View style={{ alignItems: 'flex-end' }}>
                                                            <Text style={{ color: colors.subText }}>USD Karşılığı:</Text>
                                                            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>
                                                                ${((parseFloat(formData.units) * parseFloat(formData.averageCost)) / parseFloat(historicalRate)).toFixed(2)}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {/* Name - For non-fund types */}
                            {formData.type !== 'money_market_fund' && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>İsim</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={formData.name}
                                        onChangeText={(text) => setFormData({ ...formData, name: text })}
                                        placeholder="Örn: Vakıfbank Mevduat"
                                        placeholderTextColor={colors.subText}
                                        editable={!editingItem}
                                    />
                                </View>
                            )}

                            {/* Amount - For non-fund types or editing */}
                            {(formData.type !== 'money_market_fund' || editingItem) && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>Miktar</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={formData.amount}
                                        onChangeText={(text) => setFormData({ ...formData, amount: text })}
                                        placeholder="0.00"
                                        placeholderTextColor={colors.subText}
                                        keyboardType="numeric"
                                    />
                                </View>
                            )}

                            {/* Currency */}
                            {!editingItem && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>Para Birimi</Text>
                                    <View style={styles.currencyButtons}>
                                        {['TRY', 'USD'].map(curr => (
                                            <TouchableOpacity
                                                key={curr}
                                                style={[
                                                    styles.currencyButton,
                                                    { borderColor: colors.border },
                                                    formData.currency === curr && { backgroundColor: colors.primary, borderColor: colors.primary }
                                                ]}
                                                onPress={() => setFormData({ ...formData, currency: curr as any })}
                                            >
                                                <Text style={[
                                                    styles.currencyButtonText,
                                                    { color: formData.currency === curr ? '#fff' : colors.text }
                                                ]}>
                                                    {curr === 'TRY' ? '₺' : '$'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                            {/* Date Picker - For ALL types */}
                            {!editingItem && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>Tarih</Text>
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="date"
                                            value={dateStr}
                                            onChange={(e: any) => setDateStr(e.target.value)}
                                            style={{
                                                padding: 12,
                                                fontSize: 16,
                                                borderRadius: 10,
                                                border: `1px solid ${colors.border}`,
                                                backgroundColor: colors.inputBackground,
                                                color: colors.text,
                                                width: '100%',
                                                minHeight: 48,
                                                cursor: 'pointer',
                                            }}
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
                                                            setDateStr(selectedDate.toISOString().split('T')[0]);
                                                        }
                                                    }}
                                                />
                                            )}
                                        </>
                                    )}
                                </View>
                            )}

                            {/* Interest Rate (for deposits) */}
                            {formData.type === 'deposit' && !editingItem && (
                                <View style={styles.formGroup}>
                                    <Text style={[styles.label, { color: colors.text }]}>Faiz Oranı (Yıllık %)</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                        value={formData.interestRate}
                                        onChangeText={(text) => setFormData({ ...formData, interestRate: text })}
                                        placeholder="Örn: 45.5"
                                        placeholderTextColor={colors.subText}
                                        keyboardType="numeric"
                                    />
                                </View>
                            )}
                        </ScrollView>

                        {/* Buttons */}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: colors.border }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.text }]}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    { backgroundColor: colors.primary },
                                    isSaving && { opacity: 0.7 }
                                ]}
                                onPress={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Kaydet</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Sell Fund Modal */}
            <SellCashFundModal
                visible={sellModalVisible}
                onClose={() => {
                    setSellModalVisible(false);
                    setSellingItem(null);
                }}
                item={sellingItem}
                currentPrice={sellingItem?.instrumentId ? fundPrices[sellingItem.instrumentId] : undefined}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    headerTitle: {
        fontSize: Platform.OS === 'web' ? 24 : 20,
        fontWeight: '700',
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    totalCard: {
        margin: 16,
        padding: Platform.OS === 'web' ? 24 : 20,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    totalLabel: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    totalAmount: {
        fontSize: Platform.OS === 'web' ? 34 : 28,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 20,
        paddingTop: 0,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        marginTop: 20,
        marginBottom: 30,
    },
    emptyButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    desktopItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    desktopActions: {
        flexDirection: 'row',
        gap: 8,
        height: 100, // Matching card height approximately
        marginBottom: 12,
    },
    desktopActionBtn: {
        width: 60,
        height: '100%',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    desktopActionText: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 4,
    },
    itemCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    rowBack: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        borderRadius: 20,
        overflow: 'hidden',
        marginHorizontal: 16,
        marginBottom: 16,
        height: Platform.OS === 'web' ? 110 : 100,
    },
    backRightBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 70,
        height: '100%',
    },
    backText: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 4,
    },
    itemTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    itemName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    itemType: {
        fontSize: 14,
    },
    deleteButton: {
        padding: 4,
    },
    itemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 8,
    },
    itemAmount: {
        fontSize: Platform.OS === 'web' ? 24 : 20,
        fontWeight: '700',
    },
    itemCurrency: {
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
        alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    },
    modalContent: {
        borderTopLeftRadius: Platform.OS === 'web' ? 16 : 24,
        borderTopRightRadius: Platform.OS === 'web' ? 16 : 24,
        borderBottomLeftRadius: Platform.OS === 'web' ? 16 : 0,
        borderBottomRightRadius: Platform.OS === 'web' ? 16 : 0,
        padding: Platform.OS === 'web' ? 20 : 16,
        maxHeight: '90%',
        maxWidth: Platform.OS === 'web' ? 600 : undefined,
        width: Platform.OS === 'web' ? '90%' : '100%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    formGroup: {
        marginBottom: Platform.OS === 'web' ? 16 : 14,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderRadius: Platform.OS === 'web' ? 10 : 12,
        padding: Platform.OS === 'web' ? 12 : 12,
        fontSize: Platform.OS === 'web' ? 15 : 15,
        minHeight: Platform.OS === 'web' ? 44 : 48,
    },
    typeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    typeButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    currencyButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    currencyButton: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    currencyButtonText: {
        fontSize: 18,
        fontWeight: '700',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    fundResultsContainer: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 12,
        maxHeight: 200,
        overflow: 'hidden',
    },
    fundResultItem: {
        padding: 12,
        borderBottomWidth: 1,
    },
    fundCode: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    fundName: {
        fontSize: 13,
    },
    selectedFundCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        marginBottom: 16,
    },
    totalCostCard: {
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
});
