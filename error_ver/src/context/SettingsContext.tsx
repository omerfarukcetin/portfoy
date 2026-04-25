import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RiskAppetite = 'low' | 'medium' | 'high';
type SymbolCase = 'uppercase' | 'titlecase';

export const RISK_APPETITE_THRESHOLDS: Record<RiskAppetite, number> = {
    low: 30,    // Conservative - warn if cash < 30%
    medium: 20, // Balanced - warn if cash < 20%
    high: 10,   // Aggressive - warn if cash < 10%
};

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
    riskAppetite: RiskAppetite;
    setRiskAppetite: (value: RiskAppetite) => void;
    cashThreshold: number;
    symbolCase: SymbolCase;
    setSymbolCase: (value: SymbolCase) => void;
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
    const [riskAppetite, setRiskAppetiteState] = useState<RiskAppetite>('medium');
    const [symbolCase, setSymbolCaseState] = useState<SymbolCase>('uppercase');

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

            const risk = await AsyncStorage.getItem('riskAppetite');
            if (risk !== null) setRiskAppetiteState(risk as RiskAppetite);

            const symCase = await AsyncStorage.getItem('symbolCase');
            if (symCase !== null) setSymbolCaseState(symCase as SymbolCase);
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

    const setRiskAppetite = async (value: RiskAppetite) => {
        setRiskAppetiteState(value);
        await AsyncStorage.setItem('riskAppetite', value);
    };

    const setSymbolCase = async (value: SymbolCase) => {
        setSymbolCaseState(value);
        await AsyncStorage.setItem('symbolCase', value);
    };

    const cashThreshold = RISK_APPETITE_THRESHOLDS[riskAppetite];

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
            togglePortfolioChart,
            riskAppetite,
            setRiskAppetite,
            cashThreshold,
            symbolCase,
            setSymbolCase
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
