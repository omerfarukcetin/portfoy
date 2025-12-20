import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFavorites } from '../context/FavoritesContext';
import { useTheme } from '../context/ThemeContext';
import { MarketDataService } from '../services/marketData';
import { formatCurrency } from '../utils/formatting';
import { XCircle, Plus } from 'lucide-react-native';
import { TickerIcon } from '../components/TickerIcon';

export const FavoritesScreen = () => {
    const { favorites, removeFavorite } = useFavorites();
    const { colors, fontScale, fonts } = useTheme();
    const navigation = useNavigation();
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [changes, setChanges] = useState<Record<string, number>>({});
    const [currencies, setCurrencies] = useState<Record<string, string>>({});
    const [refreshing, setRefreshing] = useState(false);
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-refresh prices every 30 seconds
    useEffect(() => {
        fetchPrices();

        refreshIntervalRef.current = setInterval(() => {
            fetchPrices();
        }, 5 * 60 * 1000); // Refresh every 5 minutes (reduced API calls)

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [favorites.length]);

    const fetchPrices = async () => {
        const newPrices: Record<string, number> = {};
        const newChanges: Record<string, number> = {};
        const newCurrencies: Record<string, string> = {};

        // Convert favorites to instrument format for batch fetching
        const instruments = favorites.map(fav => ({
            instrumentId: fav.symbol,
            type: fav.type,
            id: fav.id
        }));

        // Fetch all prices in parallel
        const priceResults = await MarketDataService.fetchMultiplePrices(instruments);

        // Process results
        for (const fav of favorites) {
            const priceData = priceResults[fav.symbol];
            if (priceData && priceData.currentPrice) {
                newPrices[fav.id] = priceData.currentPrice;
                newChanges[fav.id] = (priceData as any).change24h || 0;
                let currency = priceData.currency;
                if (!currency) {
                    // Auto-detect currency if API doesn't return it
                    if (fav.symbol.endsWith('.IS') || (fav.type as any) === 'fund' || fav.type === 'gold') {
                        currency = 'TRY';
                    } else {
                        currency = 'USD';
                    }
                }
                newCurrencies[fav.id] = currency;
            }
        }

        setPrices(newPrices);
        setChanges(newChanges);
        setCurrencies(newCurrencies);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPrices();
        setRefreshing(false);
    };

    const styles = createStyles(fontScale);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Favoriler</Text>
            </View>

            {favorites.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.subText }]}>
                        Henüz favori eklemediniz
                    </Text>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.primary }]}
                        onPress={() => navigation.navigate('AddInstrument' as never)}
                    >
                        <Text style={styles.addButtonText}>Favori Ekle</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    renderItem={({ item }) => {
                        const price = prices[item.id];
                        const change = changes[item.id];
                        const currency = currencies[item.id] || item.currency || 'USD';

                        // Determine icon color based on type
                        const getIconColor = (type: string) => {
                            switch (type) {
                                case 'gold': return '#FFD700';
                                case 'stock': return '#007AFF';
                                case 'crypto': return '#AF52DE';
                                case 'forex': return '#34C759';
                                case 'fund': return '#FF2D55';
                                default: return '#8E8E93';
                            }
                        };

                        return (
                            <View style={[styles.cardContainer, { backgroundColor: colors.cardBackground }]}>
                                <View style={styles.itemRow}>
                                    {/* Left Side: Icon + Symbol */}
                                    <View style={styles.leftContainer}>
                                        <TickerIcon
                                            symbol={item.symbol}
                                            color={getIconColor(item.type)}
                                            size={40}
                                        />
                                        <View style={styles.textContainer}>
                                            <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
                                            <Text style={[styles.type, { color: colors.subText }]}>{item.type}</Text>
                                        </View>
                                    </View>

                                    {/* Right Side: Price + Change + Delete */}
                                    <View style={styles.rightContainer}>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[styles.price, { color: colors.text }]}>
                                                {price !== undefined ? formatCurrency(price, currency as any) : '...'}
                                            </Text>
                                            {change !== undefined && (
                                                <View style={[styles.changeTag, { backgroundColor: change >= 0 ? colors.success + '15' : colors.danger + '15' }]}>
                                                    <Text style={[styles.change, { color: change >= 0 ? colors.success : colors.danger }]}>
                                                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => removeFavorite(item.id)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <XCircle size={24} color={colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {favorites.length > 0 && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.primary }]}
                    onPress={() => (navigation as any).navigate('AddInstrument')}
                >
                    <Plus size={28} color="#fff" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const createStyles = (fontScale: number) => StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
    },
    list: {
        padding: 16,
    },
    // Modern card container (iOS style)
    cardContainer: {
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    textContainer: {
        justifyContent: 'center',
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    // Legacy card (can be removed later)
    card: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    symbol: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    type: {
        fontSize: 13,
        textTransform: 'capitalize',
    },
    name: {
        fontSize: 14 * fontScale,
    },
    price: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    changeTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    change: {
        fontSize: 12,
        fontWeight: '600',
    },
    deleteButton: {
        padding: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16 * fontScale,
        marginBottom: 20,
        textAlign: 'center',
    },
    addButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16 * fontScale,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
});
