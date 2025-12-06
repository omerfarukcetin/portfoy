import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortfolioProvider } from './src/context/PortfolioContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SettingsProvider>
          <FavoritesProvider>
            <PortfolioProvider>
              <AppNavigator />
              <StatusBar style="auto" />
            </PortfolioProvider>
          </FavoritesProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
