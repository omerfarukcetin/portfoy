import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useBudget } from '../context/BudgetContext';
import { useLanguage } from '../context/LanguageContext';
import {
    Wallet,
    Plus,
    ArrowUpCircle,
    ArrowDownCircle,
    ChevronLeft,
    ChevronRight,
    Settings2,
    PieChart as PieChartIcon
} from 'lucide-react-native';
import { AddBudgetItemModal } from '../components/AddBudgetItemModal';
import { useNavigation } from '@react-navigation/native';
import { DonutChart } from '../components/DonutChart';
import { formatCurrency } from '../utils/formatting';

const { width } = Dimensions.get('window');

export const WalletScreen = () => {
    const { colors } = useTheme();
    const { items, categories, isLoading } = useBudget();
    const { t } = useLanguage();
    const navigation = useNavigation<any>();
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);

    const monthItems = useMemo(() => {
        return items.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate.getMonth() === selectedMonth.getMonth() &&
                itemDate.getFullYear() === selectedMonth.getFullYear();
        });
    }, [items, selectedMonth]);

    const stats = useMemo(() => {
        const income = monthItems
            .filter(i => i.type === 'income')
            .reduce((sum, i) => sum + i.amount, 0);
        const expense = monthItems
            .filter(i => i.type === 'expense')
            .reduce((sum, i) => sum + i.amount, 0);
        return { income, expense, balance: income - expense };
    }, [monthItems]);

    const distributionData = useMemo(() => {
        const expenseItems = monthItems.filter(i => i.type === 'expense');
        const categoryTotals: Record<string, number> = {};

        expenseItems.forEach(item => {
            categoryTotals[item.categoryId] = (categoryTotals[item.categoryId] || 0) + item.amount;
        });

        return Object.entries(categoryTotals).map(([catId, total]) => {
            const category = categories.find(c => c.id === catId);
            return {
                name: category?.name || 'Diğer',
                value: total,
                color: category?.color || colors.primary
            };
        }).sort((a, b) => b.value - a.value);
    }, [monthItems, categories, colors]);

    const changeMonth = (offset: number) => {
        const newDate = new Date(selectedMonth);
        newDate.setMonth(newDate.getMonth() + offset);
        setSelectedMonth(newDate);
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Cüzdan</Text>
                <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: colors.cardBackground }]}
                    onPress={() => navigation.navigate('ManageCategories')}
                >
                    <Settings2 size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Month Selector */}
                <View style={[styles.monthSelector, { backgroundColor: colors.cardBackground }]}>
                    <TouchableOpacity onPress={() => changeMonth(-1)}>
                        <ChevronLeft color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.monthText, { color: colors.text }]}>
                        {selectedMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity onPress={() => changeMonth(1)}>
                        <ChevronRight color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Balance Card */}
                <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
                    <Text style={styles.balanceLabel}>Aylık Bakiye</Text>
                    <Text style={styles.balanceValue}>{formatCurrency(stats.balance, 'TRY')}</Text>

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <ArrowUpCircle color="#4ADE80" size={20} />
                            <View style={styles.statInfo}>
                                <Text style={styles.statLabel}>Gelir</Text>
                                <Text style={styles.statValue}>{formatCurrency(stats.income, 'TRY')}</Text>
                            </View>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <ArrowDownCircle color="#F87171" size={20} />
                            <View style={styles.statInfo}>
                                <Text style={styles.statLabel}>Gider</Text>
                                <Text style={styles.statValue}>{formatCurrency(stats.expense, 'TRY')}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Categories Summary */}
                <View style={[styles.section, { marginTop: 20 }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Harcama Dağılımı</Text>
                        <PieChartIcon size={18} color={colors.subText} />
                    </View>
                    {distributionData.length === 0 ? (
                        <View style={[styles.emptyState, { backgroundColor: colors.cardBackground }]}>
                            <Text style={{ color: colors.subText }}>Bu ay henüz gider yok.</Text>
                        </View>
                    ) : (
                        <View style={[styles.chartContainer, { backgroundColor: colors.cardBackground }]}>
                            <DonutChart
                                data={distributionData}
                                size={180}
                                strokeWidth={24}
                                centerText={formatCurrency(stats.expense, 'TRY')}
                                centerTextFontSize={18}
                                colors={colors}
                            />
                            <View style={styles.legendContainer}>
                                {distributionData.slice(0, 5).map((item, index) => (
                                    <View key={index} style={styles.legendItem}>
                                        <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                                        <Text style={[styles.legendText, { color: colors.text }]} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text style={[styles.legendValue, { color: colors.subText }]}>
                                            %{((item.value / stats.expense) * 100).toFixed(0)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Transactions List */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 10 }]}>Son İşlemler</Text>
                    {monthItems.map(item => {
                        const category = categories.find(c => c.id === item.categoryId);
                        return (
                            <View key={item.id} style={[styles.transactionItem, { backgroundColor: colors.cardBackground }]}>
                                <View style={[styles.categoryIcon, { backgroundColor: category?.color + '20' }]}>
                                    <Text style={{ fontSize: 18 }}>{category?.icon || '💰'}</Text>
                                </View>
                                <View style={styles.transactionInfo}>
                                    <Text style={[styles.transactionName, { color: colors.text }]}>{category?.name || 'Diğer'}</Text>
                                    <Text style={[styles.transactionDate, { color: colors.subText }]}>
                                        {new Date(item.date).toLocaleDateString('tr-TR')}
                                    </Text>
                                </View>
                                <Text style={[
                                    styles.transactionAmount,
                                    { color: item.type === 'income' ? '#4ADE80' : '#F87171' }
                                ]}>
                                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, 'TRY')}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => setShowAddModal(true)}
            >
                <Plus color="#FFF" size={30} />
            </TouchableOpacity>

            <AddBudgetItemModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 100,
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 20,
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
    },
    monthText: {
        fontSize: 16,
        fontWeight: '600',
    },
    balanceCard: {
        marginHorizontal: 20,
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginBottom: 8,
    },
    balanceValue: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 24,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 16,
        width: '100%',
    },
    statItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 16,
    },
    statInfo: {
        marginLeft: 8,
    },
    statLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    statValue: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    section: {
        paddingHorizontal: 20,
        marginTop: 30,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    emptyState: {
        padding: 40,
        borderRadius: 16,
        alignItems: 'center',
    },
    chartContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        justifyContent: 'space-around',
    },
    legendContainer: {
        flex: 1,
        marginLeft: 20,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    legendColor: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    legendText: {
        fontSize: 12,
        flex: 1,
    },
    legendValue: {
        fontSize: 11,
        marginLeft: 8,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
    },
    categoryIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    transactionInfo: {
        flex: 1,
        marginLeft: 12,
    },
    transactionName: {
        fontSize: 16,
        fontWeight: '600',
    },
    transactionDate: {
        fontSize: 12,
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    }
});
