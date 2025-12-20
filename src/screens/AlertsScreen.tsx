import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Switch, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAlerts } from '../context/AlertContext';
import { Plus, BellOff, Trash2, XCircle } from 'lucide-react-native';
import { formatCurrency } from '../utils/formatting';

export const AlertsScreen = () => {
    const { colors } = useTheme();
    const { alerts, settings, addAlert, removeAlert, toggleAlert, updateSettings } = useAlerts();

    const [modalVisible, setModalVisible] = useState(false);
    const [newAlert, setNewAlert] = useState({
        instrumentId: '',
        instrumentName: '',
        type: 'below' as 'above' | 'below',
        targetPrice: '',
        currency: 'TRY' as 'TRY' | 'USD',
    });

    const handleAddAlert = async () => {
        if (!newAlert.instrumentId || !newAlert.targetPrice) {
            Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
            return;
        }

        await addAlert({
            instrumentId: newAlert.instrumentId.toUpperCase(),
            instrumentName: newAlert.instrumentName || newAlert.instrumentId.toUpperCase(),
            type: newAlert.type,
            targetPrice: parseFloat(newAlert.targetPrice.replace(',', '.')),
            currency: newAlert.currency,
        });

        setModalVisible(false);
        setNewAlert({
            instrumentId: '',
            instrumentName: '',
            type: 'below',
            targetPrice: '',
            currency: 'TRY',
        });
    };

    const handleDeleteAlert = (id: string, name: string) => {
        Alert.alert(
            'Alarmı Sil',
            `"${name}" alarmını silmek istiyor musunuz?`,
            [
                { text: 'İptal', style: 'cancel' },
                { text: 'Sil', style: 'destructive', onPress: () => removeAlert(id) },
            ]
        );
    };

    const activeAlerts = alerts.filter(a => a.isActive);
    const triggeredAlerts = alerts.filter(a => a.triggeredAt);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Alarmlar</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Settings Card */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>⚙️ Ayarlar</Text>

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>Günlük Özet</Text>
                            <Text style={[styles.settingDesc, { color: colors.subText }]}>Her sabah portföy özeti</Text>
                        </View>
                        <Switch
                            value={settings.dailySummaryEnabled}
                            onValueChange={(value) => updateSettings({ dailySummaryEnabled: value })}
                            trackColor={{ false: colors.border, true: colors.primary }}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>Büyük Hareket Uyarısı</Text>
                            <Text style={[styles.settingDesc, { color: colors.subText }]}>%{settings.bigMoveThreshold}+ değişimde bildir</Text>
                        </View>
                        <Switch
                            value={settings.bigMoveAlertEnabled}
                            onValueChange={(value) => updateSettings({ bigMoveAlertEnabled: value })}
                            trackColor={{ false: colors.border, true: colors.primary }}
                        />
                    </View>
                </View>

                {/* Active Alerts */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>🔔 Aktif Alarmlar</Text>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.primary }]}
                        onPress={() => setModalVisible(true)}
                    >
                        <Plus size={20} color="#fff" />
                        <Text style={styles.addButtonText}>Yeni</Text>
                    </TouchableOpacity>
                </View>

                {activeAlerts.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <BellOff size={48} color={colors.subText} />
                        <Text style={[styles.emptyText, { color: colors.subText }]}>Henüz alarm yok</Text>
                        <Text style={[styles.emptyDesc, { color: colors.subText }]}>Fiyat alarmı eklemek için "Yeni" butonuna tıklayın</Text>
                    </View>
                ) : (
                    activeAlerts.map(alert => (
                        <View key={alert.id} style={[styles.alertCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            <View style={styles.alertLeft}>
                                <Text style={[styles.alertSymbol, { color: colors.text }]}>{alert.instrumentName}</Text>
                                <Text style={[styles.alertCondition, { color: colors.subText }]}>
                                    {alert.type === 'above' ? '📈 Üstüne çıkarsa:' : '📉 Altına düşerse:'}
                                    {' '}{formatCurrency(alert.targetPrice || 0, alert.currency)}
                                </Text>
                            </View>
                            <View style={styles.alertActions}>
                                <Switch
                                    value={alert.isActive}
                                    onValueChange={() => toggleAlert(alert.id)}
                                    trackColor={{ false: colors.border, true: colors.success }}
                                />
                                <TouchableOpacity onPress={() => handleDeleteAlert(alert.id, alert.instrumentName)}>
                                    <Trash2 size={22} color={colors.danger} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}

                {/* Triggered Alerts */}
                {triggeredAlerts.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>✅ Tetiklenen Alarmlar</Text>
                        {triggeredAlerts.map(alert => (
                            <View key={alert.id} style={[styles.alertCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, opacity: 0.6 }]}>
                                <View style={styles.alertLeft}>
                                    <Text style={[styles.alertSymbol, { color: colors.text }]}>{alert.instrumentName}</Text>
                                    <Text style={[styles.alertCondition, { color: colors.subText }]}>
                                        {new Date(alert.triggeredAt!).toLocaleDateString('tr-TR')} tarihinde tetiklendi
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => removeAlert(alert.id)}>
                                    <XCircle size={24} color={colors.subText} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </>
                )}
            </ScrollView>

            {/* Add Alert Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Fiyat Alarmı</Text>

                        <Text style={[styles.label, { color: colors.subText }]}>Sembol</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={newAlert.instrumentId}
                            onChangeText={(text) => setNewAlert({ ...newAlert, instrumentId: text, instrumentName: text })}
                            placeholder="THYAO, BTC, GLDGR..."
                            placeholderTextColor={colors.subText}
                            autoCapitalize="characters"
                        />

                        <Text style={[styles.label, { color: colors.subText }]}>Koşul</Text>
                        <View style={styles.typeButtons}>
                            <TouchableOpacity
                                style={[styles.typeButton, newAlert.type === 'below' && { backgroundColor: colors.primary }]}
                                onPress={() => setNewAlert({ ...newAlert, type: 'below' })}
                            >
                                <Text style={[styles.typeButtonText, { color: newAlert.type === 'below' ? '#fff' : colors.text }]}>
                                    📉 Altına düşerse
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeButton, newAlert.type === 'above' && { backgroundColor: colors.primary }]}
                                onPress={() => setNewAlert({ ...newAlert, type: 'above' })}
                            >
                                <Text style={[styles.typeButtonText, { color: newAlert.type === 'above' ? '#fff' : colors.text }]}>
                                    📈 Üstüne çıkarsa
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { color: colors.subText }]}>Hedef Fiyat</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, flex: 1 }]}
                                value={newAlert.targetPrice}
                                onChangeText={(text) => setNewAlert({ ...newAlert, targetPrice: text })}
                                placeholder="200.00"
                                placeholderTextColor={colors.subText}
                                keyboardType="numeric"
                            />
                            <TouchableOpacity
                                style={[styles.currencyButton, { backgroundColor: newAlert.currency === 'TRY' ? colors.primary : colors.background }]}
                                onPress={() => setNewAlert({ ...newAlert, currency: newAlert.currency === 'TRY' ? 'USD' : 'TRY' })}
                            >
                                <Text style={{ color: newAlert.currency === 'TRY' ? '#fff' : colors.text, fontWeight: '600' }}>
                                    {newAlert.currency === 'TRY' ? '₺' : '$'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: colors.border }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={{ color: colors.text, fontWeight: '600' }}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                                onPress={handleAddAlert}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Ekle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerTitle: { fontSize: 24, fontWeight: '700' },
    scrollContent: { padding: 16, paddingBottom: 100 },
    card: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 18, fontWeight: '700' },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    settingLabel: { fontSize: 15, fontWeight: '600' },
    settingDesc: { fontSize: 12, marginTop: 2 },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    emptyCard: {
        padding: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
    emptyDesc: { fontSize: 13, textAlign: 'center', marginTop: 4 },
    alertCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    alertLeft: { flex: 1 },
    alertSymbol: { fontSize: 16, fontWeight: '700' },
    alertCondition: { fontSize: 13, marginTop: 4 },
    alertActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        padding: 20,
        borderRadius: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 13, marginBottom: 6, fontWeight: '600' },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        marginBottom: 16,
        fontSize: 16,
    },
    typeButtons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    typeButton: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    typeButtonText: { fontWeight: '600' },
    currencyButton: {
        width: 48,
        height: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
});
