import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PriceAlert, NotificationSettings, PortfolioItem } from '../types';
import { notificationService } from '../services/notificationService';
import { MarketDataService } from '../services/marketData';
import { usePortfolio } from './PortfolioContext';

interface AlertContextType {
    alerts: PriceAlert[];
    settings: NotificationSettings;
    addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'isActive'>) => Promise<void>;
    removeAlert: (id: string) => Promise<void>;
    toggleAlert: (id: string) => Promise<void>;
    updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
    checkAlerts: () => Promise<void>;
    isLoading: boolean;
}

const defaultSettings: NotificationSettings = {
    dailySummaryEnabled: false,
    dailySummaryTime: '08:00',
    bigMoveAlertEnabled: true,
    bigMoveThreshold: 5,
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlerts = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlerts must be used within AlertProvider');
    }
    return context;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
    const [isLoading, setIsLoading] = useState(true);
    const { portfolio } = usePortfolio();
    const lastPricesRef = useRef<{ [key: string]: number }>({});

    // Load alerts and settings on mount
    useEffect(() => {
        loadData();
    }, []);

    // Setup daily summary notification when settings change
    useEffect(() => {
        if (settings.dailySummaryEnabled) {
            const [hour, minute] = settings.dailySummaryTime.split(':').map(Number);
            notificationService.scheduleDailySummary(hour, minute);
        } else {
            notificationService.cancelDailySummary();
        }
    }, [settings.dailySummaryEnabled, settings.dailySummaryTime]);

    // Check alerts periodically when app is open
    useEffect(() => {
        const interval = setInterval(() => {
            checkAlerts();
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [alerts, portfolio]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [storedAlerts, storedSettings] = await Promise.all([
                AsyncStorage.getItem('priceAlerts'),
                AsyncStorage.getItem('notificationSettings'),
            ]);

            if (storedAlerts) {
                setAlerts(JSON.parse(storedAlerts));
            }
            if (storedSettings) {
                setSettings({ ...defaultSettings, ...JSON.parse(storedSettings) });
            }

            // Request notification permissions
            await notificationService.requestPermissions();
        } catch (error) {
            console.error('Failed to load alert data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveAlerts = async (newAlerts: PriceAlert[]) => {
        await AsyncStorage.setItem('priceAlerts', JSON.stringify(newAlerts));
        setAlerts(newAlerts);
    };

    const saveSettings = async (newSettings: NotificationSettings) => {
        await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
        setSettings(newSettings);
    };

    const addAlert = async (alertData: Omit<PriceAlert, 'id' | 'createdAt' | 'isActive'>) => {
        const newAlert: PriceAlert = {
            ...alertData,
            id: Date.now().toString(),
            createdAt: Date.now(),
            isActive: true,
        };
        await saveAlerts([...alerts, newAlert]);
    };

    const removeAlert = async (id: string) => {
        await saveAlerts(alerts.filter(a => a.id !== id));
    };

    const toggleAlert = async (id: string) => {
        await saveAlerts(
            alerts.map(a => (a.id === id ? { ...a, isActive: !a.isActive } : a))
        );
    };

    const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
        await saveSettings({ ...settings, ...newSettings });
    };

    const checkAlerts = async () => {
        const activeAlerts = alerts.filter(a => a.isActive && !a.triggeredAt);
        if (activeAlerts.length === 0) return;

        try {
            // Get unique instrument IDs
            const instrumentIds = [...new Set(activeAlerts.map(a => a.instrumentId))];

            // Fetch current prices - create mock portfolio items for price fetching
            const mockItems: PortfolioItem[] = instrumentIds.map(id => ({
                id,
                instrumentId: id,
                amount: 1,
                averageCost: 0,
                currency: 'TRY',
                dateAdded: Date.now(),
            }));

            const prices = await MarketDataService.fetchMultiplePrices(mockItems);

            // Check each alert
            for (const alert of activeAlerts) {
                const priceData = prices[alert.instrumentId];
                if (!priceData?.currentPrice) continue;

                const currentPrice = priceData.currentPrice;
                let shouldTrigger = false;

                switch (alert.type) {
                    case 'above':
                        if (alert.targetPrice && currentPrice >= alert.targetPrice) {
                            shouldTrigger = true;
                        }
                        break;
                    case 'below':
                        if (alert.targetPrice && currentPrice <= alert.targetPrice) {
                            shouldTrigger = true;
                        }
                        break;
                    case 'target':
                        if (alert.targetPrice && Math.abs(currentPrice - alert.targetPrice) / alert.targetPrice < 0.01) {
                            shouldTrigger = true;
                        }
                        break;
                    case 'change_percent':
                        if (alert.basePrice && alert.changePercent) {
                            const changePercent = ((currentPrice - alert.basePrice) / alert.basePrice) * 100;
                            if (Math.abs(changePercent) >= alert.changePercent) {
                                shouldTrigger = true;
                            }
                        }
                        break;
                }

                if (shouldTrigger) {
                    await notificationService.sendPriceAlert(
                        alert.instrumentName,
                        currentPrice,
                        alert.currency,
                        alert.type === 'change_percent' ? 'above' : alert.type
                    );

                    // Mark as triggered
                    await saveAlerts(
                        alerts.map(a => (a.id === alert.id ? { ...a, triggeredAt: Date.now(), isActive: false } : a))
                    );
                }
            }

            // Check big move alerts for portfolio items
            if (settings.bigMoveAlertEnabled) {
                for (const item of portfolio) {
                    const priceData = prices[item.instrumentId];
                    if (!priceData?.currentPrice) continue;

                    const lastPrice = lastPricesRef.current[item.instrumentId];
                    if (lastPrice) {
                        const changePercent = ((priceData.currentPrice - lastPrice) / lastPrice) * 100;
                        if (Math.abs(changePercent) >= settings.bigMoveThreshold) {
                            await notificationService.sendBigMoveAlert(item.instrumentId, changePercent);
                        }
                    }
                    lastPricesRef.current[item.instrumentId] = priceData.currentPrice;
                }
            }
        } catch (error) {
            console.error('Error checking alerts:', error);
        }
    };

    return (
        <AlertContext.Provider
            value={{
                alerts,
                settings,
                addAlert,
                removeAlert,
                toggleAlert,
                updateSettings,
                checkAlerts,
                isLoading,
            }}
        >
            {children}
        </AlertContext.Provider>
    );
};
