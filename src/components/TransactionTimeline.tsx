import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { Feather } from '@expo/vector-icons';

interface Transaction {
    id: string;
    type: 'buy' | 'sell';
    amount: number;
    price: number;
    date: string;
    total: number;
}

interface TransactionTimelineProps {
    // MVP: Just show current position
    currentAmount: number;
    averageCost: number;
    currency: 'TRY' | 'USD';
    // Future: transactions?: Transaction[];
}

export const TransactionTimeline: React.FC<TransactionTimelineProps> = ({
    currentAmount,
    averageCost,
    currency
}) => {
    const { colors, fontScale } = useTheme();

    // MVP: Create a single "Initial Purchase" entry
    const totalCost = currentAmount * averageCost;

    return (
        <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text, fontSize: 16 * fontScale }]}>İşlem Geçmişi</Text>
                <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.badgeText, { color: colors.primary, fontSize: 11 * fontScale }]}>
                        1 İşlem
                    </Text>
                </View>
            </View>

            {/* Timeline Item */}
            <View style={styles.timelineItem}>
                {/* Left: Icon + Line */}
                <View style={styles.timelineLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
                        <Feather name="arrow-down-circle" size={20} color={colors.success} />
                    </View>
                    {/* Vertical line (hidden for last item in future) */}
                    <View style={[styles.verticalLine, { backgroundColor: 'transparent' }]} />
                </View>

                {/* Right: Transaction Details */}
                <View style={[styles.transactionCard, { backgroundColor: colors.background }]}>
                    <View style={styles.transactionHeader}>
                        <View>
                            <Text style={[styles.transactionType, { color: colors.success, fontSize: 14 * fontScale }]}>
                                İlk Alım
                            </Text>
                            <Text style={[styles.transactionDate, { color: colors.subText, fontSize: 12 * fontScale }]}>
                                Mevcut Pozisyon
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.transactionAmount, { color: colors.text, fontSize: 14 * fontScale }]}>
                                {currentAmount} Adet
                            </Text>
                            <Text style={[styles.transactionPrice, { color: colors.subText, fontSize: 12 * fontScale }]}>
                                @ {formatCurrency(averageCost, currency)}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.transactionFooter}>
                        <Text style={[styles.footerLabel, { color: colors.subText, fontSize: 12 * fontScale }]}>
                            Toplam Maliyet
                        </Text>
                        <Text style={[styles.footerValue, { color: colors.text, fontSize: 14 * fontScale }]}>
                            {formatCurrency(totalCost, currency)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Future Feature Notice */}
            <View style={[styles.notice, { backgroundColor: colors.background }]}>
                <Feather name="info" size={14} color={colors.subText} />
                <Text style={[styles.noticeText, { color: colors.subText, fontSize: 11 * fontScale }]}>
                    Detaylı işlem geçmişi yakında eklenecek
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontWeight: '700',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontWeight: '600',
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    timelineLeft: {
        alignItems: 'center',
        marginRight: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    verticalLine: {
        width: 2,
        flex: 1,
        marginTop: 4,
    },
    transactionCard: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
    },
    transactionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    transactionType: {
        fontWeight: '700',
        marginBottom: 2,
    },
    transactionDate: {
        fontWeight: '500',
    },
    transactionAmount: {
        fontWeight: '700',
    },
    transactionPrice: {
        fontWeight: '500',
        marginTop: 2,
    },
    divider: {
        height: 1,
        marginVertical: 8,
        opacity: 0.1,
    },
    transactionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerLabel: {
        fontWeight: '500',
    },
    footerValue: {
        fontWeight: '700',
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 8,
        borderRadius: 8,
        marginTop: 4,
    },
    noticeText: {
        fontStyle: 'italic',
    }
});
