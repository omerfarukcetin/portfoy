import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { Portfolio } from '../types';

interface PortfolioSwitcherProps {
    prices?: Record<string, number>;
    dailyChanges?: Record<string, number>;
    usdRate?: number;
    goldPrice?: number;
}

// Calculate portfolio stats
const calculatePortfolioStats = (
    portfolio: Portfolio,
    prices: Record<string, number>,
    dailyChanges: Record<string, number>,
    usdRate: number
) => {
    let totalValue = 0;
    let totalCost = 0;
    let dailyChangeAmount = 0;

    portfolio.items.forEach(item => {
        const price = prices[item.instrumentId] || item.averageCost;
        let value = item.amount * price;
        let cost = item.amount * item.averageCost;

        // Handle BES items specially - value is sum of all components
        if (item.type === 'bes') {
            value = (item.besPrincipal || 0) + (item.besStateContrib || 0) +
                (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
            cost = item.besPrincipal || 0;
        }

        // Convert USD to TRY for display
        if (item.currency === 'USD') {
            value *= usdRate;
            cost *= usdRate;
        }

        totalValue += value;
        totalCost += cost;

        // Daily change
        const changePercent = dailyChanges[item.instrumentId] || 0;
        dailyChangeAmount += value * (changePercent / 100);
    });

    // Add cash balance
    const cashBalance = portfolio.cashItems?.reduce((sum, item) => sum + item.amount, 0) || 0;
    totalValue += cashBalance;
    totalCost += cashBalance; // Cash is not a profit/loss source

    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
    const dailyChangePercent = totalValue > 0 ? (dailyChangeAmount / (totalValue - dailyChangeAmount)) * 100 : 0;

    return {
        totalValue,
        totalCost,
        totalPL,
        totalPLPercent,
        dailyChangeAmount,
        dailyChangePercent
    };
};

export const PortfolioSwitcher = ({ prices = {}, dailyChanges = {}, usdRate = 1, goldPrice = 0 }: PortfolioSwitcherProps) => {
    const { portfolios, activePortfolio, switchPortfolio, createPortfolio, deletePortfolio, renamePortfolio } = usePortfolio();
    const { colors, fontScale, fonts } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
    const [portfolioNameInput, setPortfolioNameInput] = useState('');

    const handleCreate = async () => {
        if (!portfolioNameInput.trim()) {
            Alert.alert('Hata', 'Lütfen bir portföy adı girin.');
            return;
        }

        await createPortfolio(portfolioNameInput, '#007AFF', '💼');
        setPortfolioNameInput('');
        setIsCreating(false);
        setModalVisible(false);
    };

    const handleRename = async () => {
        if (!portfolioNameInput.trim() || !editingPortfolioId) {
            Alert.alert('Hata', 'Lütfen bir portföy adı girin.');
            return;
        }

        await renamePortfolio(editingPortfolioId, portfolioNameInput);
        setPortfolioNameInput('');
        setEditingPortfolioId(null);
        setModalVisible(false);
    };

    const startEditing = (portfolio: any) => {
        setEditingPortfolioId(portfolio.id);
        setPortfolioNameInput(portfolio.name);
    };

    const renderItem = ({ item }: { item: any }) => {
        const stats = calculatePortfolioStats(item as Portfolio, prices, dailyChanges, usdRate);
        const hasPrices = Object.keys(prices).length > 0;

        return (
            <TouchableOpacity
                style={[
                    styles.portfolioItem,
                    {
                        backgroundColor: item.id === activePortfolio?.id ? colors.primary + '20' : 'transparent',
                        borderColor: colors.border
                    }
                ]}
                onPress={() => {
                    switchPortfolio(item.id);
                    setModalVisible(false);
                }}
            >
                <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                    <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={[styles.portfolioName, { color: colors.text, fontSize: 14 * fontScale }]}>
                        {item.name}
                    </Text>
                    {hasPrices ? (
                        <View style={{ marginTop: 4 }}>
                            <Text style={{ color: colors.text, fontSize: 14 * fontScale, fontWeight: '700' }}>
                                {formatCurrency(stats.totalValue, 'TRY')}
                            </Text>
                            <Text style={{ color: colors.subText, fontSize: 11 * fontScale, marginTop: 2 }}>
                                ${(stats.totalValue / usdRate).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} · {goldPrice > 0 ? (stats.totalValue / goldPrice).toFixed(1) : '?'} gr altın
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                                <Text style={{
                                    fontSize: 11 * fontScale,
                                    color: stats.dailyChangeAmount >= 0 ? colors.success : colors.danger
                                }}>
                                    Gün: {stats.dailyChangeAmount >= 0 ? '+' : ''}{formatCurrency(stats.dailyChangeAmount, 'TRY').replace('₺', '')} ({stats.dailyChangePercent >= 0 ? '+' : ''}{stats.dailyChangePercent.toFixed(1)}%)
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Text style={{
                                    fontSize: 11 * fontScale,
                                    color: stats.totalPL >= 0 ? colors.success : colors.danger
                                }}>
                                    K/Z: {stats.totalPL >= 0 ? '+' : ''}{formatCurrency(stats.totalPL, 'TRY').replace('₺', '')} ({stats.totalPLPercent >= 0 ? '+' : ''}{stats.totalPLPercent.toFixed(1)}%)
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={[styles.portfolioCount, { color: colors.subText, fontSize: 12 * fontScale }]}>
                            {item.items.length} varlık
                        </Text>
                    )}
                </View>

                <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={() => startEditing(item)}
                            style={{ padding: 6 }}
                        >
                            <Feather name="edit-2" size={16} color={colors.subText} />
                        </TouchableOpacity>

                        {item.id !== activePortfolio?.id && (
                            <TouchableOpacity
                                onPress={() => {
                                    Alert.alert(
                                        'Portföyü Sil',
                                        `"${item.name}" portföyünü silmek istediğinize emin misiniz?`,
                                        [
                                            { text: 'İptal', style: 'cancel' },
                                            {
                                                text: 'Sil',
                                                style: 'destructive',
                                                onPress: () => deletePortfolio(item.id)
                                            }
                                        ]
                                    );
                                }}
                                style={{ padding: 6 }}
                            >
                                <Feather name="trash-2" size={16} color={colors.subText} />
                            </TouchableOpacity>
                        )}

                        {item.id === activePortfolio?.id && (
                            <View style={{ padding: 6 }}>
                                <Feather name="check" size={18} color={colors.primary} />
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <TouchableOpacity
                style={[styles.trigger, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={{ fontSize: 18, marginRight: 8 }}>{activePortfolio?.icon || '💼'}</Text>
                <Text style={[styles.triggerText, { color: colors.text, fontSize: 14 * fontScale }]} numberOfLines={1}>
                    {activePortfolio?.name || 'Portföy Seç'}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.subText} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalVisible(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text, fontSize: 18 * fontScale }]}>
                                {isCreating ? 'Yeni Portföy' : editingPortfolioId ? 'Portföyü Düzenle' : 'Portföylerim'}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setModalVisible(false);
                                setIsCreating(false);
                                setEditingPortfolioId(null);
                            }}>
                                <Feather name="x" size={24} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        {(isCreating || editingPortfolioId) ? (
                            <View style={styles.createContainer}>
                                <Text style={[styles.label, { color: colors.subText }]}>Portföy Adı</Text>
                                <TextInput
                                    style={[styles.input, {
                                        color: colors.text,
                                        borderColor: colors.border,
                                        backgroundColor: colors.background
                                    }]}
                                    value={portfolioNameInput}
                                    onChangeText={setPortfolioNameInput}
                                    placeholder="Örn: Kripto Sepeti"
                                    placeholderTextColor={colors.subText}
                                    autoFocus
                                />
                                <View style={styles.createActions}>
                                    <TouchableOpacity
                                        style={[styles.cancelButton, { borderColor: colors.border }]}
                                        onPress={() => {
                                            setIsCreating(false);
                                            setEditingPortfolioId(null);
                                            setPortfolioNameInput('');
                                        }}
                                    >
                                        <Text style={{ color: colors.text }}>İptal</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.createButton, { backgroundColor: colors.primary }]}
                                        onPress={isCreating ? handleCreate : handleRename}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: '600' }}>
                                            {isCreating ? 'Oluştur' : 'Kaydet'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                <FlatList
                                    data={portfolios}
                                    renderItem={renderItem}
                                    keyExtractor={item => item.id}
                                    style={styles.list}
                                />
                                <TouchableOpacity
                                    style={[styles.addButton, { borderColor: colors.border }]}
                                    onPress={() => {
                                        setIsCreating(true);
                                        setPortfolioNameInput('');
                                    }}
                                >
                                    <Feather name="plus" size={20} color={colors.primary} />
                                    <Text style={[styles.addButtonText, { color: colors.primary }]}>Yeni Portföy Oluştur</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    triggerText: {
        fontWeight: '600',
        maxWidth: 120,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 16,
        padding: 20,
        maxHeight: '60%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontWeight: '700',
    },
    list: {
        marginBottom: 16,
    },
    portfolioItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    portfolioName: {
        fontWeight: '600',
        marginBottom: 2,
    },
    portfolioCount: {
        fontWeight: '400',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    addButtonText: {
        marginLeft: 8,
        fontWeight: '600',
    },
    createContainer: {
        paddingTop: 8,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
    },
    createActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    createButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    }
});
