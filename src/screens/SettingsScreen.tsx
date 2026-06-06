import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView, Modal, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useSettings, AVAILABLE_INSTRUMENTS } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { exportPortfolioData, importPortfolioData } from '../utils/exportImport';
import { uploadBackup, downloadBackup } from '../services/cloudService';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
    ChevronDown,
    LogOut,
    User,
    Globe,
    Moon,
    Type,
    BarChart2,
    TrendingUp,
    Settings,
    Hash,
    Activity,
    Home,
    Cloud,
    CloudDownload,
    Upload,
    Download,
    Trash2,
    AlertCircle,
    X,
    ChevronRight
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRE_RESTORE_SNAPSHOT_KEY = 'preRestoreSnapshot';

export const SettingsScreen = () => {
    const { colors, theme, fontSize, heroSize, setTheme, setFontSize, setHeroSize, fontScale } = useTheme();
    const { language, setLanguage } = useLanguage();
    const { resetData, clearHistory, portfolios, activePortfolioId, importData } = usePortfolio();
    const { user, logout } = useAuth();
    const navigation = useNavigation<any>();
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
        togglePortfolioChart,
        riskAppetite,
        setRiskAppetite,
        cashThreshold,
        symbolCase,
        setSymbolCase
    } = useSettings();

    const [instrumentsModalVisible, setInstrumentsModalVisible] = useState(false);

    const buildRestorePreview = (data: any) => {
        const portfolioCount = Array.isArray(data?.portfolios) ? data.portfolios.length : 0;
        const assetCount = (data?.portfolios || []).reduce((sum: number, portfolio: any) => sum + (portfolio.items?.length || 0), 0);
        const cashCount = (data?.portfolios || []).reduce((sum: number, portfolio: any) => sum + (portfolio.cashItems?.length || 0), 0);
        return `${portfolioCount} portföy, ${assetCount} varlık, ${cashCount} yedek akçe kaydı yüklenecek.`;
    };

    const savePreRestoreSnapshot = async () => {
        const snapshot = {
            savedAt: new Date().toISOString(),
            portfolios,
            activePortfolioId,
        };
        await AsyncStorage.setItem(PRE_RESTORE_SNAPSHOT_KEY, JSON.stringify(snapshot));
    };

    // --- Helpers ---
    const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <View style={styles.sectionContainer}>
            <Text style={[styles.sectionHeader, { color: colors.subText }]}>{title}</Text>
            <View style={[styles.sectionContent, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                {children}
            </View>
        </View>
    );

    const Item = ({ label, value, onPress, isLast, icon, type = 'arrow', color }: { label: string, value?: string | React.ReactNode, onPress?: () => void, isLast?: boolean, icon?: any, type?: 'arrow' | 'switch' | 'none', color?: string }) => {
        const IconComponent = icon;
        return (
            <TouchableOpacity
                style={[styles.item, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={onPress}
                disabled={!onPress}
                activeOpacity={onPress ? 0.6 : 1}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {IconComponent && <IconComponent size={18} color={color || colors.text} style={{ marginRight: 12 }} />}
                    <Text style={[styles.itemLabel, { color: color || colors.text, fontSize: 15 * fontScale }]}>{label}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {typeof value === 'string' ? (
                        <Text style={[styles.itemValue, { color: colors.subText, fontSize: 15 * fontScale }]}>{value}</Text>
                    ) : (
                        value
                    )}
                    {type === 'arrow' && <ChevronRight size={18} color={colors.subText} style={{ marginLeft: 6 }} />}
                </View>
            </TouchableOpacity>
        );
    };

    const ToggleItem = ({ label, description, value, onValueChange, isLast, icon }: { label: string, description?: string, value: boolean, onValueChange: (val: boolean) => void, isLast?: boolean, icon?: any }) => {
        const IconComponent = icon;
        return (
            <View style={[styles.item, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }, { alignItems: 'center' }]}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                    {IconComponent && <IconComponent size={18} color={colors.text} style={{ marginRight: 12 }} />}
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.itemLabel, { color: colors.text, fontSize: 15 * fontScale }]}>{label}</Text>
                        {description && (
                            <Text style={{ color: colors.subText, fontSize: 11 * fontScale, marginTop: 2 }}>{description}</Text>
                        )}
                    </View>
                </View>
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={'#fff'}
                    ios_backgroundColor="#3e3e3e"
                />
            </View>
        );
    };

    // --- Actions ---
    const handleReset = () => {
        Alert.alert('Emin misiniz?', 'Tüm veriler silinecek. Bu işlem geri alınamaz.', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Sıfırla', style: 'destructive', onPress: resetData }
        ]);
    };

    const handleClearHistory = () => {
        Alert.alert('Geçmişi Temizle', 'Portföy geçmiş grafiği silinecek.', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Temizle', style: 'destructive', onPress: clearHistory }
        ]);
    };

    const handleCloudBackup = async () => {
        if (!user) return Alert.alert('Giriş Yapın', 'Yedekleme için oturum açmalısınız.');
        try {
            await uploadBackup(user.id, { version: '1.0', exportDate: new Date().toISOString(), portfolios, activePortfolioId });
            Alert.alert('Başarılı', 'Yedek alındı. ✅');
        } catch { Alert.alert('Hata', 'Yedekleme başarısız.'); }
    };

    const handleCloudRestore = async () => {
        if (!user) return Alert.alert('Giriş Yapın', 'Lütfen oturum açın.');
        Alert.alert('Dikkat', 'Mevcut veriler silinip yedek yüklenecek.', [
            { text: 'İptal', style: 'cancel' },
            {
                text: 'Yükle', style: 'destructive', onPress: async () => {
                    try {
                        const data = await downloadBackup(user.id);
                        if (!data) return Alert.alert('Bulunamadı', 'Yedek yok.');
                        const preview = buildRestorePreview(data);
                        Alert.alert(
                            'Yedeği Onayla',
                            `${preview}\n\nMevcut verilerin geri dönüş noktası bu cihazda saklanacak.`,
                            [
                                { text: 'Vazgeç', style: 'cancel' },
                                {
                                    text: 'Onayla',
                                    style: 'destructive',
                                    onPress: async () => {
                                        await savePreRestoreSnapshot();
                                        await importData(data.portfolios, data.activePortfolioId || data.portfolios?.[0]?.id || '');
                                        Alert.alert('Tamam', 'Veriler yüklendi, senkron kuyruğuna alındı ve önceki veriniz geri dönüş için saklandı.');
                                    }
                                }
                            ]
                        );
                    } catch { Alert.alert('Hata', 'İşlem başarısız.'); }
                }
            }
        ]);
    };

    const styles = StyleSheet.create({
        container: { flex: 1 },
        header: {
            paddingTop: Platform.OS === 'ios' ? 60 : 40,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 3,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0,0,0,0.05)',
        },
        headerTitle: { fontSize: 18, fontWeight: '700' },
        closeButton: { position: 'absolute', left: 20, bottom: 12 },
        content: { padding: 20, paddingBottom: 40 },
        sectionContainer: { marginBottom: 24 },
        sectionHeader: { fontSize: 12, fontWeight: '700', marginBottom: 10, marginLeft: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
        sectionContent: {
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 8,
            elevation: 2,
        },
        item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingVertical: 14 },
        itemLabel: { fontWeight: '500' },
        itemValue: { fontWeight: '400' },
        accountCard: { borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
        modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
        chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8, marginBottom: 8 }
    });

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <ChevronDown size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Ayarlar</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* 1. Account */}
                <Section title="Hesap">
                    {user ? (
                        <TouchableOpacity style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{user.email?.[0].toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontWeight: '600' }}>{user.email}</Text>
                                <Text style={{ color: colors.subText, fontSize: 12 }}>Standart Üyelik</Text>
                            </View>
                            <TouchableOpacity onPress={() => logout()} style={{ padding: 8 }}>
                                <LogOut size={20} color={colors.danger} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ) : (
                        <Item
                            label="Giriş Yap / Kayıt Ol"
                            icon={User}
                            color={colors.primary}
                            onPress={() => navigation.navigate('Login')}
                            isLast
                        />
                    )}
                </Section>

                {/* 2. Appearance */}
                <Section title="Görünüm">
                    <Item
                        label="🌐 Dil / Language"
                        icon={Globe}
                        value={language === 'tr' ? 'Türkçe' : 'English'}
                        onPress={() => {
                            setLanguage(language === 'tr' ? 'en' : 'tr');
                        }}
                    />
                    <Item
                        label="Tema"
                        icon={Moon}
                        value={theme === 'light' ? 'Açık' : theme === 'dark' ? 'Koyu' : theme === 'gray' ? 'Gri' : theme === 'navy' ? 'Lacivert' : theme === 'cream' ? 'Krem' : 'Adaçayı'}
                        onPress={() => {
                            const themes = ['light', 'dark', 'gray', 'navy', 'cream', 'sage'] as const;
                            const next = themes[(themes.indexOf(theme as any) + 1) % themes.length];
                            setTheme(next);
                        }}
                    />
                    <Item
                        label="Yazı Boyutu"
                        icon={Type}
                        value={fontSize === 'small' ? 'Küçük' : fontSize === 'medium' ? 'Orta' : 'Büyük'}
                        onPress={() => {
                            const sizes = ['small', 'medium', 'large'] as const;
                            const next = sizes[(sizes.indexOf(fontSize as any) + 1) % sizes.length];
                            setFontSize(next);
                        }}
                    />
                    <ToggleItem
                        label="Gelişim Grafiği"
                        description="Portföy değerini zamanla takip eder."
                        icon={BarChart2}
                        value={portfolioChartVisible}
                        onValueChange={togglePortfolioChart}
                    />
                    <ToggleItem
                        label="Piyasa Özeti Seridi"
                        icon={TrendingUp}
                        value={marketSummaryVisible}
                        onValueChange={toggleMarketSummary}
                    />
                    {marketSummaryVisible && (
                        <Item
                            label="Şeridi Düzenle"
                            icon={Settings}
                            value={`${selectedMarketInstruments.length} Seçili`}
                            onPress={() => setInstrumentsModalVisible(true)}
                            isLast
                        />
                    )}
                </Section>

                {/* 3. Preferences */}
                <Section title="Tercihler">
                    <Item
                        label="Hisse Formatı"
                        icon={Hash}
                        value={symbolCase === 'uppercase' ? 'THYAO' : 'Thyao'}
                        onPress={() => setSymbolCase(symbolCase === 'uppercase' ? 'titlecase' : 'uppercase')}
                    />
                    <Item
                        label="Risk İştahı"
                        icon={Activity}
                        value={riskAppetite === 'low' ? 'Düşük (%30)' : riskAppetite === 'medium' ? 'Orta (%20)' : 'Yüksek (%10)'}
                        onPress={() => {
                            const risks = ['low', 'medium', 'high'] as const;
                            const next = risks[(risks.indexOf(riskAppetite as any) + 1) % risks.length];
                            setRiskAppetite(next);
                        }}
                    />
                    <Item
                        label="Başlangıç Ekranı"
                        icon={Home}
                        value={startScreen === 'Summary' ? 'Özet' : startScreen === 'Portfolio' ? 'Portföy' : 'Favoriler'}
                        onPress={() => {
                            const screens = ['Summary', 'Portfolio', 'Favorites'] as const;
                            const next = screens[(screens.indexOf(startScreen as any) + 1) % screens.length];
                            setStartScreen(next);
                        }}
                        isLast
                    />
                </Section>

                {/* 4. Data */}
                <Section title="Veri Yönetimi">
                    <Item
                        label="Buluta Yedekle"
                        icon={Cloud}
                        onPress={handleCloudBackup}
                    />
                    <Item
                        label="Buluttan İndir"
                        icon={CloudDownload}
                        onPress={handleCloudRestore}
                    />
                    <Item
                        label="Verileri Dışa Aktar"
                        icon={Upload}
                        onPress={async () => {
                            try {
                                await exportPortfolioData(portfolios, activePortfolioId);
                                Alert.alert('Tamam', 'Dosyalara kaydedildi.');
                            } catch { }
                        }}
                    />
                    <Item
                        label="Verileri İçe Aktar"
                        icon={Download}
                        onPress={async () => {
                            Alert.alert(
                                'Dikkat',
                                'Mevcut veriler silinip yedek dosyası yüklenecek. Devam etmek istiyor musunuz?',
                                [
                                    { text: 'İptal', style: 'cancel' },
                                    {
                                        text: 'Devam Et',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                const data = await importPortfolioData();
                                                if (data) {
                                                    await importData(data.portfolios, data.activePortfolioId);
                                                    Alert.alert('Başarılı', 'Veriler başarıyla yüklendi. Lütfen uygulamayı yeniden başlatın.');
                                                }
                                            } catch (error) {
                                                console.error('Import error:', error);
                                            }
                                        }
                                    }
                                ]
                            );
                        }}
                    />
                    <Item
                        label="Geçmişi Temizle"
                        icon={Trash2}
                        onPress={handleClearHistory}
                    />
                    <Item
                        label="Tümünü Sıfırla"
                        icon={AlertCircle}
                        color={colors.danger}
                        onPress={handleReset}
                        isLast
                    />
                </Section>

                <Text style={{ textAlign: 'center', color: colors.subText, fontSize: 12, marginTop: 10 }}>v1.0.0</Text>

            </ScrollView>

            {/* Modal for Instrument Selection */}
            <Modal visible={instrumentsModalVisible} animationType="slide" transparent>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Piyasa Araçları</Text>
                            <TouchableOpacity onPress={() => setInstrumentsModalVisible(false)}>
                                <X size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {AVAILABLE_INSTRUMENTS.map((inst) => (
                                <TouchableOpacity
                                    key={inst}
                                    style={[styles.chip, { backgroundColor: selectedMarketInstruments.includes(inst) ? colors.primary : colors.background, borderColor: colors.border }]}
                                    onPress={() => toggleMarketInstrument(inst)}
                                >
                                    <Text style={{ color: selectedMarketInstruments.includes(inst) ? '#fff' : colors.text, fontSize: 13 }}>{inst}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
