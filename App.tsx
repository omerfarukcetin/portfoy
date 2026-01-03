import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortfolioProvider } from './src/context/PortfolioContext';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { BudgetProvider } from './src/context/BudgetContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
              <FavoritesProvider>
                <PortfolioProvider>
                  <BudgetProvider>
                    <AppNavigator />
                  </BudgetProvider>
                </PortfolioProvider>
              </FavoritesProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
