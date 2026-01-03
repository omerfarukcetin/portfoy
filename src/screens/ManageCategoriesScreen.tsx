import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBudget } from '../context/BudgetContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { AddCategoryModal } from '../components/AddCategoryModal';

export const ManageCategoriesScreen = () => {
    const { categories, deleteCategory } = useBudget();
    const { colors } = useTheme();
    const { t } = useLanguage();
    const navigation = useNavigation<any>();
    const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense');
    const [showAddModal, setShowAddModal] = useState(false);

    const filteredCategories = categories.filter(c => c.type === activeTab);

    const handleDelete = (id: string, name: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`"${name}" kategorisini ve bu kategoriye ait tüm işlemleri silmek istediğinize emin misiniz?`)) {
                deleteCategory(id);
            }
            return;
        }

        Alert.alert(
            'Kategoriyi Sil',
            `"${name}" kategorisini ve bu kategoriye ait tüm işlemleri silmek istediğinize emin misiniz?`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                { text: 'Sil', style: 'destructive', onPress: () => deleteCategory(id) }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Kategorileri Yönet</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === 'expense' && { backgroundColor: colors.cardBackground, borderBottomWidth: 3, borderBottomColor: '#F87171' }
                    ]}
                    onPress={() => setActiveTab('expense')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'expense' ? '#F87171' : colors.subText }]}>Gider</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === 'income' && { backgroundColor: colors.cardBackground, borderBottomWidth: 3, borderBottomColor: '#4ADE80' }
                    ]}
                    onPress={() => setActiveTab('income')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'income' ? '#4ADE80' : colors.subText }]}>Gelir</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {filteredCategories.map(cat => (
                    <View key={cat.id} style={[styles.categoryCard, { backgroundColor: colors.cardBackground }]}>
                        <View style={[styles.iconBox, { backgroundColor: (cat.color || colors.primary) + '20' }]}>
                            <Text style={{ fontSize: 24 }}>{cat.icon || '💰'}</Text>
                        </View>
                        <View style={styles.categoryInfo}>
                            <Text style={[styles.categoryName, { color: colors.text }]}>{cat.name}</Text>
                        </View>
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(cat.id, cat.name)}>
                                <Trash2 size={20} color="#F87171" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => setShowAddModal(true)}
            >
                <Plus color="#FFF" size={30} />
            </TouchableOpacity>

            <AddCategoryModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                type={activeTab}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    tabContainer: {
        flexDirection: 'row',
        marginTop: 6,
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.05)',
        height: 44,
    },
    tabButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 12,
        paddingBottom: 80,
    },
    categoryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryInfo: {
        flex: 1,
        marginLeft: 12,
    },
    categoryName: {
        fontSize: 15,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
    },
    actionButton: {
        padding: 8,
        marginLeft: 4,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    }
});
