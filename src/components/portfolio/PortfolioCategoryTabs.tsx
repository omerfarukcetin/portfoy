import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface PortfolioCategoryTabsProps {
    categories: string[];
    selectedCategory: string | null;
    colors: {
        primary: string;
        background: string;
        border: string;
        text: string;
    };
    onSelect: (category: string | null) => void;
}

export const PortfolioCategoryTabs = ({ categories, selectedCategory, colors, onSelect }: PortfolioCategoryTabsProps) => {
    return (
        <View style={{ height: 50, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, alignItems: 'center', paddingHorizontal: 16 }}
            >
                {categories.map((category) => {
                    const isActive = selectedCategory === category;
                    return (
                        <TouchableOpacity
                            key={category}
                            onPress={() => onSelect(isActive ? null : category)}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: isActive ? colors.primary : colors.border,
                                backgroundColor: isActive ? colors.primary : colors.background,
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#fff' : colors.text }}>
                                {category.replace(' (BIST)', '')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};
