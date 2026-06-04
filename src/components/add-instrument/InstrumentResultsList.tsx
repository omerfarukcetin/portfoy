import React from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Star, CheckCircle } from 'lucide-react-native';
import { Instrument } from '../../types';

interface Colors {
    cardBackground: string;
    border: string;
    text: string;
    subText: string;
    primary: string;
}

interface CryptoResult {
    id: string;
    name: string;
    symbol: string;
    thumb: string;
}

interface InstrumentResultsListProps {
    results: Instrument[];
    cryptoResults: CryptoResult[];
    colors: Colors;
    isCryptoMode?: boolean;
    onSelectInstrument: (instrument: Instrument) => void;
    onToggleFavorite: (instrument: Instrument) => void;
    isFavorite: (id: string) => boolean;
}

const getInstrumentIcon = (item: Instrument) => {
    if (item.type === 'crypto') return '₿';
    if (item.type === 'gold' || item.type === 'metal') return '🪙';
    if (item.type === 'fund') return '📊';
    if (item.type === 'bes') return '🏦';
    return '📈';
};

export const InstrumentResultsList = ({
    results,
    cryptoResults,
    colors,
    isCryptoMode = false,
    onSelectInstrument,
    onToggleFavorite,
    isFavorite,
}: InstrumentResultsListProps) => {
    if (isCryptoMode) {
        return (
            <FlatList
                data={cryptoResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const instrument: Instrument = {
                        id: item.id,
                        symbol: item.symbol.toUpperCase(),
                        name: item.name,
                        type: 'crypto',
                        instrumentId: item.id,
                    };

                    return (
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 14,
                                borderRadius: 14,
                                backgroundColor: colors.cardBackground,
                                borderWidth: 1,
                                borderColor: colors.border,
                                marginBottom: 10,
                            }}
                            onPress={() => onSelectInstrument(instrument)}
                        >
                            <Image source={{ uri: item.thumb }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                                <Text style={{ color: colors.subText }}>{item.symbol.toUpperCase()}</Text>
                            </View>
                            <TouchableOpacity style={{ padding: 8, marginRight: 8 }} onPress={() => onToggleFavorite(instrument)}>
                                <Star
                                    size={24}
                                    color={isFavorite(item.id) ? '#FFD700' : colors.subText}
                                    fill={isFavorite(item.id) ? '#FFD700' : 'none'}
                                />
                            </TouchableOpacity>
                            <CheckCircle size={24} color={colors.primary} />
                        </TouchableOpacity>
                    );
                }}
            />
        );
    }

    return (
        <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            nestedScrollEnabled
            style={{ flex: 1 }}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 14,
                        borderRadius: 14,
                        backgroundColor: colors.cardBackground,
                        borderWidth: 1,
                        borderColor: colors.border,
                        marginBottom: 10,
                    }}
                    onPress={() => onSelectInstrument(item)}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 24, marginRight: 12 }}>{getInstrumentIcon(item)}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.symbol}</Text>
                            <Text style={{ color: colors.subText }} numberOfLines={2}>{item.name}</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity style={{ padding: 8, marginRight: 8 }} onPress={() => onToggleFavorite(item)}>
                            <Star
                                size={24}
                                color={isFavorite(item.id) ? '#FFD700' : colors.subText}
                                fill={isFavorite(item.id) ? '#FFD700' : 'none'}
                            />
                        </TouchableOpacity>
                        <View style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
                            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>{item.type.toUpperCase()}</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            )}
        />
    );
};
