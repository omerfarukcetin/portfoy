import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface PortfolioCategoryTabsProps {
    categories: string[];
    selectedCategory: string | null;
    colors: {
        primary: string;
        background: string;
        cardBackground: string;
        border: string;
        text: string;
    };
    onSelect: (category: string | null) => void;
}

export const PortfolioCategoryTabs = ({ categories, selectedCategory, colors, onSelect }: PortfolioCategoryTabsProps) => {
    const allOptions = ['Tumu', ...categories];

    return (
        <View style={{ backgroundColor: colors.background, paddingBottom: 8 }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 }}
            >
                {allOptions.map((category) => {
                    const isAll = category === 'Tumu';
                    const isActive = isAll ? selectedCategory === null : selectedCategory === category;
                    return (
                        <TouchableOpacity
                            key={category}
                            onPress={() => onSelect(isAll ? null : (isActive ? null : category))}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 9,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: isActive ? colors.primary : colors.border,
                                backgroundColor: isActive ? colors.primary : colors.cardBackground || colors.background,
                                shadowColor: isActive ? colors.primary : '#000',
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: isActive ? 0.16 : 0.04,
                                shadowRadius: 12,
                                elevation: isActive ? 2 : 0,
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : colors.text }}>
                                {isAll ? 'Tümü' : category.replace(' (BIST)', '')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};
