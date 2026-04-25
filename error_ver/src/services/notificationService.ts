import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export class NotificationService {
    private static instance: NotificationService;

    private constructor() { }

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    // Request permission for notifications
    async requestPermissions(): Promise<boolean> {
        if (!Device.isDevice) {
            console.log('Push notifications only work on physical devices');
            return false;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Notification permission not granted');
            return false;
        }

        // Android specific channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Portföy Bildirimleri',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#007AFF',
            });
        }

        return true;
    }

    // Send immediate local notification
    async sendLocalNotification(title: string, body: string, data?: any): Promise<string> {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: true,
            },
            trigger: null, // Immediate
        });
        return id;
    }

    // Schedule daily summary notification
    async scheduleDailySummary(hour: number = 8, minute: number = 0): Promise<string | null> {
        // Cancel existing daily summary
        await this.cancelDailySummary();

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: '📊 Günlük Portföy Özeti',
                body: 'Portföyünüzün güncel durumunu görmek için tıklayın.',
                data: { type: 'daily_summary' },
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            },
        });

        await AsyncStorage.setItem('dailySummaryNotificationId', id);
        return id;
    }

    // Cancel daily summary
    async cancelDailySummary(): Promise<void> {
        const existingId = await AsyncStorage.getItem('dailySummaryNotificationId');
        if (existingId) {
            await Notifications.cancelScheduledNotificationAsync(existingId);
            await AsyncStorage.removeItem('dailySummaryNotificationId');
        }
    }

    // Send price alert notification
    async sendPriceAlert(instrumentName: string, price: number, currency: string, alertType: 'above' | 'below' | 'target'): Promise<string> {
        let body = '';
        const priceStr = currency === 'TRY' ? `₺${price.toLocaleString('tr-TR')}` : `$${price.toLocaleString('en-US')}`;

        switch (alertType) {
            case 'above':
                body = `${instrumentName} belirlediğiniz fiyatın üzerine çıktı: ${priceStr}`;
                break;
            case 'below':
                body = `${instrumentName} belirlediğiniz fiyatın altına düştü: ${priceStr}`;
                break;
            case 'target':
                body = `${instrumentName} hedef fiyatına ulaştı: ${priceStr}`;
                break;
        }

        return this.sendLocalNotification('🔔 Fiyat Alarmı', body, { type: 'price_alert' });
    }

    // Send big move alert
    async sendBigMoveAlert(instrumentName: string, changePercent: number): Promise<string> {
        const direction = changePercent > 0 ? '📈 yükseldi' : '📉 düştü';
        const body = `${instrumentName} %${Math.abs(changePercent).toFixed(1)} ${direction}`;

        return this.sendLocalNotification('⚠️ Büyük Hareket', body, { type: 'big_move' });
    }

    // Get all scheduled notifications
    async getScheduledNotifications() {
        return await Notifications.getAllScheduledNotificationsAsync();
    }

    // Cancel all notifications
    async cancelAllNotifications(): Promise<void> {
        await Notifications.cancelAllScheduledNotificationsAsync();
    }
}

export const notificationService = NotificationService.getInstance();
