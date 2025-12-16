import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'gray' | 'navy';
type FontSize = 'small' | 'medium' | 'large';
type HeroSize = 'compact' | 'normal';

interface ThemeColors {
    primary: string;
    background: string;
    cardBackground: string;
    text: string;
    subText: string;
    border: string;
    success: string;
    danger: string;
    warning: string;
    inputBackground: string;
}

interface FontSizes {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    '2xl': number;
}

const lightColors: ThemeColors = {
    primary: '#007AFF',
    background: '#F2F2F7',
    cardBackground: '#FFFFFF',
    text: '#000000',
    subText: '#8E8E93',
    border: '#E5E5EA',
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9500',
    inputBackground: '#F2F2F7',
};

const darkColors: ThemeColors = {
    primary: '#0A84FF',
    background: '#000000',
    cardBackground: '#1C1C1E',
    text: '#FFFFFF',
    subText: '#8E8E93',
    border: '#38383A',
    success: '#30D158',
    danger: '#FF453A',
    warning: '#FF9F0A',
    inputBackground: '#1C1C1E',
};

const grayColors: ThemeColors = {
    primary: '#9CA3AF',
    background: '#1F2937',
    cardBackground: '#374151',
    text: '#F9FAFB',
    subText: '#9CA3AF',
    border: '#4B5563',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    inputBackground: '#4B5563',
};

const navyColors: ThemeColors = {
    primary: '#38BDF8', // Sky 400
    background: '#0F172A', // Slate 900
    cardBackground: '#1E293B', // Slate 800
    text: '#F8FAFC', // Slate 50
    subText: '#94A3B8', // Slate 400
    border: '#334155', // Slate 700
    success: '#4ADE80', // Green 400
    danger: '#F87171', // Red 400
    warning: '#FBBF24', // Amber 400
    inputBackground: '#1E293B',
};

import { Platform } from 'react-native';

// Base font sizes (Larger on web)
const isWeb = Platform.OS === 'web';

const baseFontSizes: FontSizes = {
    xs: isWeb ? 13 : 11,
    sm: isWeb ? 15 : 13,
    base: isWeb ? 17 : 15,
    lg: isWeb ? 20 : 18,
    xl: isWeb ? 26 : 24,
    '2xl': isWeb ? 34 : 32,
};

// Font scale multipliers
const fontScales = {
    small: 0.9,
    medium: 1.0,
    large: 1.1,
};

// Hero size options
const heroSizes = {
    compact: 28,
    normal: 32,
};

interface ThemeContextType {
    theme: Theme;
    fontSize: FontSize;
    heroSize: HeroSize;
    colors: ThemeColors;
    fontScale: number;
    fonts: FontSizes;
    heroFontSize: number;
    toggleTheme: () => void;
    setTheme: (newTheme: Theme) => void;
    setFontSize: (size: FontSize) => void;
    setHeroSize: (size: HeroSize) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>('light');
    const [fontSize, setFontSizeState] = useState<FontSize>('medium');
    const [heroSize, setHeroSizeState] = useState<HeroSize>('normal');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('theme');
            const savedFontSize = await AsyncStorage.getItem('fontSize');
            const savedHeroSize = await AsyncStorage.getItem('heroSize');
            if (savedTheme) setThemeState(savedTheme as Theme);
            if (savedFontSize) setFontSizeState(savedFontSize as FontSize);
            if (savedHeroSize) setHeroSizeState(savedHeroSize as HeroSize);
        } catch (error) {
            console.error('Failed to load theme', error);
        }
    };

    const setTheme = async (newTheme: Theme) => {
        setThemeState(newTheme);
        await AsyncStorage.setItem('theme', newTheme);
    };

    const setFontSize = async (size: FontSize) => {
        setFontSizeState(size);
        await AsyncStorage.setItem('fontSize', size);
    };

    const setHeroSize = async (size: HeroSize) => {
        setHeroSizeState(size);
        await AsyncStorage.setItem('heroSize', size);
    };

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };

    const colors = theme === 'dark' ? darkColors : theme === 'gray' ? grayColors : theme === 'navy' ? navyColors : lightColors;
    const fontScale = fontScales[fontSize];

    // Calculate scaled font sizes
    const fonts: FontSizes = {
        xs: Math.round(baseFontSizes.xs * fontScale),
        sm: Math.round(baseFontSizes.sm * fontScale),
        base: Math.round(baseFontSizes.base * fontScale),
        lg: Math.round(baseFontSizes.lg * fontScale),
        xl: Math.round(baseFontSizes.xl * fontScale),
        '2xl': Math.round(baseFontSizes['2xl'] * fontScale),
    };

    const heroFontSize = Math.round(heroSizes[heroSize] * fontScale);

    return (
        <ThemeContext.Provider value={{
            theme,
            fontSize,
            heroSize,
            colors,
            fontScale,
            fonts,
            heroFontSize,
            toggleTheme,
            setTheme,
            setFontSize,
            setHeroSize
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
