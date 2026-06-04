import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface FundResult {
    id: string;
    name: string;
}

interface FundSearchResultsProps {
    funds: FundResult[];
    colors: {
        cardBackground: string;
        border: string;
        primary: string;
        text: string;
    };
    onSelect: (fund: FundResult) => void;
}

export const FundSearchResults = ({ funds, colors, onSelect }: FundSearchResultsProps) => {
    if (!funds.length) return null;

    return (
        <View style={{ backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' }}>
            {funds.map((fund, index) => (
                <TouchableOpacity
                    key={fund.id || String(index)}
                    style={{
                        padding: 12,
                        borderBottomWidth: index === funds.length - 1 ? 0 : 1,
                        borderBottomColor: colors.border,
                    }}
                    onPress={() => onSelect(fund)}
                >
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>{fund.id}</Text>
                    <Text style={{ color: colors.text }} numberOfLines={1}>{fund.name}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};
