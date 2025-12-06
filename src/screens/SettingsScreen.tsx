import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useSettings, AVAILABLE_INSTRUMENTS } from '../context/SettingsContext';

export const SettingsScreen = () => {
    const { colors, theme, fontSize, setTheme, setFontSize } = useTheme();
    const { resetData, clearHistory } = usePortfolio();
    const {
        marketSummaryVisible,
        toggleMarketSummary,
        selectedMarketInstruments,
        toggleMarketInstrument,
        startScreen,
        setStartScreen,
        notifications,
        updateNotifications,
        portfolioChartVisible,
        togglePortfolioChart
    } = useSettings();

    const handleReset = () => {
        Alert.alert(
            'Tüm Verileri Sıfırla',
            'Tüm portföy ve geçmiş verileri silinecek. Bu işlem geri alınamaz.',
            [
                { text: 'İptal', style: 'cancel' },
                { text: 'Sıfırla', style: 'destructive', onPress: resetData }
            ]
        );
    };

    const handleClearHistory = () => {
        Alert.alert(
            'Geçmişi Temizle',
            'Sadece portföy geçmiş grafiği verileri silinecek. Varlıklarınız korunacak.',
            [
                { text: 'İptal', style: 'cancel' },
                { text: 'Temizle', style: 'destructive', onPress: clearHistory }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Ayarlar</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Theme Selection */}
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.subText }]}>Tema</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {(['light', 'dark', 'gray', 'navy'] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[
                                    styles.compactButton,
                                    {
                                        backgroundColor: theme === t ? colors.primary : colors.cardBackground,
                                        borderColor: colors.border
                                    }
                                ]}
                                onPress={() => setTheme(t)}
                            >
                                <Text style={[
                                    styles.compactButtonText,
                                    { color: theme === t ? '#fff' : colors.text }
                                ]}>
                                    {t === 'light' ? 'Açık' : t === 'dark' ? 'Koyu' : t === 'gray' ? 'Gri' : 'Lacivert'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Font Size Selection */}
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.subText }]}>Yazı Boyutu</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {(['small', 'medium', 'large'] as const).map((size) => (
                            <TouchableOpacity
                                key={size}
                                style={[
                                    styles.compactButton,
                                    {
                                        backgroundColor: fontSize === size ? colors.primary : colors.cardBackground,
                                        borderColor: colors.border
                                    }
                                ]}
                                onPress={() => setFontSize(size)}
                            >
                                <Text style={[
                                    styles.compactButtonText,
                                    { color: fontSize === size ? '#fff' : colors.text }
                                ]}>
                                    {size === 'small' ? 'Küçük' : size === 'medium' ? 'Orta' : 'Büyük'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={[styles.section, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.subText }]}>Görünüm</Text>

                    <View style={[styles.settingItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.settingLabel, { color: colors.text }]}>Portföy Grafiği Göster</Text>
                        <Switch
                            value={portfolioChartVisible}
                            onValueChange={togglePortfolioChart}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor={portfolioChartVisible ? '#fff' : '#f4f3f4'}
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                    </View>

                    <View style={[styles.settingItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.settingLabel, { color: colors.text }]}>Piyasa Özeti Göster</Text>
                        <Switch
                            value={marketSummaryVisible}
                            onValueChange={toggleMarketSummary}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor={marketSummaryVisible ? '#fff' : '#f4f3f4'}
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                    </View>

                    {marketSummaryVisible && (
                        <View style={{ marginTop: 8 }}>
                            <Text style={{ color: colors.subText, marginBottom: 6, marginLeft: 2, fontSize: 12 }}>Görüntülenecek Enstrümanlar</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                {AVAILABLE_INSTRUMENTS.map((instrument) => (
                                    <TouchableOpacity
                                        key={instrument}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: selectedMarketInstruments.includes(instrument) ? colors.primary : colors.cardBackground,
                                                borderColor: colors.border
                                            }
                                        ]}
                                        onPress={() => toggleMarketInstrument(instrument)}
                                    >
                                        <Text style={{
                                            color: selectedMarketInstruments.includes(instrument) ? '#fff' : colors.text,
                                            fontSize: 11,
                                            fontWeight: '600'
                                        }}>
                                            {instrument}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                <View style={[styles.section, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.subText }]}>Uygulama Ayarları</Text>

                    {/* Start Screen Selection */}
                    <View style={{ marginBottom: 10 }}>
                        <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 6, fontSize: 13 }]}>Başlangıç Ekranı</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {(['Summary', 'Portfolio', 'Favorites'] as const).map((screen) => (
                                <TouchableOpacity
                                    key={screen}
                                    style={[
                                        styles.compactButton,
                                        {
                                            backgroundColor: startScreen === screen ? colors.primary : colors.cardBackground,
                                            borderColor: colors.border
                                        }
                                    ]}
                                    onPress={() => setStartScreen(screen)}
                                >
                                    <Text style={[
                                        styles.compactButtonText,
                                        { color: startScreen === screen ? '#fff' : colors.text }
                                    ]}>
                                        {screen === 'Summary' ? 'Özet' : screen === 'Portfolio' ? 'Portföy' : 'Favoriler'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Notifications */}
                    <View style={[styles.settingItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.settingLabel, { color: colors.text }]}>Bildirimler</Text>
                        <Switch
                            value={notifications.enabled}
                            onValueChange={(val) => updateNotifications('enabled', val)}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor={notifications.enabled ? '#fff' : '#f4f3f4'}
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                    </View>

                    {notifications.enabled && (
                        <>
                            <View style={[styles.settingItem, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginLeft: 15 }]}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Fiyat Alarmları</Text>
                                <Switch
                                    value={notifications.priceAlerts}
                                    onValueChange={(val) => updateNotifications('priceAlerts', val)}
                                    trackColor={{ false: '#767577', true: colors.primary }}
                                    thumbColor={notifications.priceAlerts ? '#fff' : '#f4f3f4'}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>
                            <View style={[styles.settingItem, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginLeft: 15 }]}>
                                <Text style={[styles.settingLabel, { color: colors.text }]}>Günlük Özet</Text>
                                <Switch
                                    value={notifications.dailySummary}
                                    onValueChange={(val) => updateNotifications('dailySummary', val)}
                                    trackColor={{ false: '#767577', true: colors.primary }}
                                    thumbColor={notifications.dailySummary ? '#fff' : '#f4f3f4'}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>
                        </>
                    )}
                </View>

                <View style={[styles.section, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.subText }]}>Veri Yönetimi</Text>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            style={[styles.compactButton, { backgroundColor: colors.cardBackground, borderColor: colors.border, flex: 1 }]}
                            onPress={handleClearHistory}
                        >
                            <Text style={[styles.compactButtonText, { color: colors.primary }]}>Geçmişi Temizle</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.compactButton, { backgroundColor: colors.cardBackground, borderColor: colors.border, flex: 1 }]}
                            onPress={handleReset}
                        >
                            <Text style={[styles.compactButtonText, { color: '#FF3B30' }]}>Sıfırla</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ padding: 15 }}>
                    <Text style={{ color: colors.subText, textAlign: 'center', fontSize: 12 }}>Versiyon 1.0.0</Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 15,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        padding: 15,
        paddingBottom: 40,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 6,
        height: 44, // Fixed height for consistency
    },
    settingLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    section: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        marginLeft: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 4,
        marginBottom: 4,
    },
    compactButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 36,
    },
    compactButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
