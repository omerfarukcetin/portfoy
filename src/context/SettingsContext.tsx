import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextType {
    marketSummaryVisible: boolean;
    toggleMarketSummary: () => void;
    selectedMarketInstruments: string[];
    toggleMarketInstrument: (instrument: string) => void;
    startScreen: 'Summary' | 'Portfolio' | 'Favorites';
    setStartScreen: (screen: 'Summary' | 'Portfolio' | 'Favorites') => void;
    notifications: {
        enabled: boolean;
        priceAlerts: boolean;
        dailySummary: boolean;
    };
    updateNotifications: (key: 'enabled' | 'priceAlerts' | 'dailySummary', value: boolean) => void;
    portfolioChartVisible: boolean;
    togglePortfolioChart: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const AVAILABLE_INSTRUMENTS = [
    'USD/TRY',
    'Gram Altın',
    'BIST 100',
    'Gram Gümüş',
    'BTC',
    'ETH'
];

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [marketSummaryVisible, setMarketSummaryVisible] = useState(true);
    const [selectedMarketInstruments, setSelectedMarketInstruments] = useState<string[]>([
        'USD/TRY', 'Gram Altın', 'BIST 100'
    ]);
    const [startScreen, setStartScreen] = useState<'Summary' | 'Portfolio' | 'Favorites'>('Summary');
    const [notifications, setNotifications] = useState({
        enabled: false,
        priceAlerts: false,
        dailySummary: false
    });
    const [portfolioChartVisible, setPortfolioChartVisible] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const visible = await AsyncStorage.getItem('marketSummaryVisible');
            if (visible !== null) setMarketSummaryVisible(JSON.parse(visible));

            const instruments = await AsyncStorage.getItem('selectedMarketInstruments');
            if (instruments !== null) setSelectedMarketInstruments(JSON.parse(instruments));

            const screen = await AsyncStorage.getItem('startScreen');
            if (screen !== null) setStartScreen(screen as any);

            const notifs = await AsyncStorage.getItem('notifications');
            if (notifs !== null) setNotifications(JSON.parse(notifs));

            const chartVisible = await AsyncStorage.getItem('portfolioChartVisible');
            if (chartVisible !== null) setPortfolioChartVisible(JSON.parse(chartVisible));
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const toggleMarketSummary = async () => {
        const newValue = !marketSummaryVisible;
        setMarketSummaryVisible(newValue);
        await AsyncStorage.setItem('marketSummaryVisible', JSON.stringify(newValue));
    };

    const toggleMarketInstrument = async (instrument: string) => {
        let newInstruments;
        if (selectedMarketInstruments.includes(instrument)) {
            newInstruments = selectedMarketInstruments.filter(i => i !== instrument);
        } else {
            newInstruments = [...selectedMarketInstruments, instrument];
        }
        setSelectedMarketInstruments(newInstruments);
        await AsyncStorage.setItem('selectedMarketInstruments', JSON.stringify(newInstruments));
    };

    const setStartScreenValue = async (screen: 'Summary' | 'Portfolio' | 'Favorites') => {
        setStartScreen(screen);
        await AsyncStorage.setItem('startScreen', screen);
    };

    const updateNotifications = async (key: keyof typeof notifications, value: boolean) => {
        const newNotifications = { ...notifications, [key]: value };
        setNotifications(newNotifications);
        await AsyncStorage.setItem('notifications', JSON.stringify(newNotifications));
    };

    const togglePortfolioChart = async () => {
        const newValue = !portfolioChartVisible;
        setPortfolioChartVisible(newValue);
        await AsyncStorage.setItem('portfolioChartVisible', JSON.stringify(newValue));
    };

    return (
        <SettingsContext.Provider value={{
            marketSummaryVisible,
            toggleMarketSummary,
            selectedMarketInstruments,
            toggleMarketInstrument,
            startScreen,
            setStartScreen: setStartScreenValue,
            notifications,
            updateNotifications,
            portfolioChartVisible,
            togglePortfolioChart
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
