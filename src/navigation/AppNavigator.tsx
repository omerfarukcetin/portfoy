import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SummaryScreen } from '../screens/SummaryScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AddInstrumentScreen } from '../screens/AddInstrumentScreen';
import { SellAssetScreen } from '../screens/SellAssetScreen';
import { CashManagementScreen } from '../screens/CashManagementScreen';
import { useTheme } from '../context/ThemeContext';
import { Text } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

import { AIAnalysisScreen } from '../screens/AIAnalysisScreen';
import { useSettings } from '../context/SettingsContext';

const TabNavigator = () => {
    const { colors, fontScale } = useTheme();
    const { startScreen } = useSettings();

    return (
        <Tab.Navigator
            initialRouteName={startScreen || 'Summary'}
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.cardBackground,
                    borderTopColor: colors.border,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.subText,
                tabBarLabelStyle: {
                    fontSize: 13 * fontScale, // Increased from default 11
                    fontWeight: '600',
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName = '';
                    if (route.name === 'Summary') iconName = '📊';
                    else if (route.name === 'Portfolio') iconName = '💼';
                    else if (route.name === 'AIAnalysis') iconName = '🤖';
                    else if (route.name === 'Transactions') iconName = '📝';
                    else if (route.name === 'Favorites') iconName = '⭐';
                    else if (route.name === 'Settings') iconName = '⚙️';
                    return <Text style={{ fontSize: 20 }}>{iconName}</Text>;
                },
            })}
        >
            <Tab.Screen name="Summary" component={SummaryScreen} options={{ title: 'Özet' }} />
            <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ title: 'Portföy' }} />
            <Tab.Screen name="AIAnalysis" component={AIAnalysisScreen} options={{ title: 'Asistan' }} />
            <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'İşlemler' }} />
            <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favoriler' }} />
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
        </Tab.Navigator>
    );
};

export const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Main" component={TabNavigator} />
                <Stack.Screen
                    name="AddInstrument"
                    component={AddInstrumentScreen}
                    options={{ presentation: 'modal' }}
                />
                <Stack.Screen
                    name="SellAsset"
                    component={SellAssetScreen}
                    options={{ title: 'Varlık Sat', presentation: 'modal' }}
                />
                <Stack.Screen
                    name="CashManagement"
                    component={CashManagementScreen}
                    options={{ presentation: 'modal' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
