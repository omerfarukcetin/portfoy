import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface CashTypeSelectorProps {
    value: 'cash' | 'money_market_fund' | 'deposit';
    colors: {
        border: string;
        primary: string;
        text: string;
    };
    onChange: (value: 'cash' | 'money_market_fund' | 'deposit') => void;
}

const TYPES = [
    { value: 'cash', label: 'Nakit' },
    { value: 'money_market_fund', label: 'Para Piyasası' },
    { value: 'deposit', label: 'Mevduat' },
] as const;

export const CashTypeSelector = ({ value, colors, onChange }: CashTypeSelectorProps) => {
    return (
        <View style={{ flexDirection: 'row', gap: 8 }}>
            {TYPES.map((type) => {
                const isActive = value === type.value;
                return (
                    <TouchableOpacity
                        key={type.value}
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isActive ? colors.primary : colors.border,
                            backgroundColor: isActive ? colors.primary : 'transparent',
                            alignItems: 'center',
                        }}
                        onPress={() => onChange(type.value)}
                    >
                        <Text style={{ color: isActive ? '#fff' : colors.text, fontWeight: '600' }}>{type.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};
