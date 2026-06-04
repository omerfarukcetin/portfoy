import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

type AddInstrumentCategory = 'BIST' | 'ABD' | 'EMTIA' | 'KRIPTO' | 'FON' | 'BES' | 'DIGER' | 'NAKIT' | 'DÖVİZ';

interface CategoryTabsProps {
    activeCategory: AddInstrumentCategory;
    colors: {
        primary: string;
        subText: string;
    };
    onCategorySelect: (category: AddInstrumentCategory) => void;
    onCashManagementPress: () => void;
}

const CATEGORY_OPTIONS = ['BIST', 'ABD', 'EMTIA', 'KRIPTO', 'FON', 'BES', 'DÖVİZ', 'NAKİT', 'DİĞER'] as const;

export const CategoryTabs = ({ activeCategory, colors, onCategorySelect, onCashManagementPress }: CategoryTabsProps) => {
    return (
        <View style={{ height: 50, marginBottom: 15 }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4, alignItems: 'center' }}
            >
                {CATEGORY_OPTIONS.map((cat) => {
                    const catKey = cat === 'DİĞER' ? 'DIGER' : cat === 'NAKİT' ? 'NAKIT' : cat;
                    const isActive = activeCategory === catKey;

                    return (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                {
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 16,
                                    backgroundColor: isActive ? colors.primary : '#00000010',
                                },
                            ]}
                            onPress={() => {
                                if (cat === 'NAKİT') {
                                    onCashManagementPress();
                                } else {
                                    onCategorySelect(catKey);
                                }
                            }}
                        >
                            <Text style={{ color: isActive ? '#fff' : colors.subText, fontWeight: '600' }}>{cat}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};
