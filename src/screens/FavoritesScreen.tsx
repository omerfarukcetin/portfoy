import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFavorites } from '../context/FavoritesContext';
import { useTheme } from '../context/ThemeContext';
import { MarketDataService } from '../services/marketData';
import { formatCurrency } from '../utils/formatting';
import { Ionicons } from '@expo/vector-icons';

export const FavoritesScreen = () => {
    const { favorites, removeFavorite } = useFavorites();
    const { colors, fontScale } = useTheme();
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
                newCurrencies[fav.id] = priceData.currency || 'USD';
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

                        return (
                            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <View style={styles.row}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => removeFavorite(item.id)}
                                        >
                                            <Ionicons name="close-circle" size={20} color={colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={[styles.price, { color: colors.text }]}>
                                        {price !== undefined ? formatCurrency(price, currency as any) : '...'}
                                    </Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={[styles.name, { color: colors.subText }]}>{item.name}</Text>
                                    {change !== undefined && (
                                        <Text style={[styles.change, { color: change >= 0 ? colors.success : colors.danger }]}>
                                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                                        </Text>
                                    )}
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
                    <Ionicons name="add" size={28} color="#fff" />
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
    },
    headerTitle: {
        fontSize: 28 * fontScale,
        fontWeight: '700',
    },
    list: {
        padding: 16,
    },
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
        fontSize: 18 * fontScale,
        fontWeight: '700',
    },
    name: {
        fontSize: 14 * fontScale,
    },
    price: {
        fontSize: 18 * fontScale,
        fontWeight: '700',
    },
    change: {
        fontSize: 14 * fontScale,
        fontWeight: '600',
    },
    deleteButton: {
        marginLeft: 8,
        padding: 2,
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
