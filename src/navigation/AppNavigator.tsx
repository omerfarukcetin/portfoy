import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SummaryScreen } from '../screens/SummaryScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AddInstrumentScreen } from '../screens/AddInstrumentScreen';
import { SellAssetScreen } from '../screens/SellAssetScreen';
import { AssetDetailScreen } from '../screens/AssetDetailScreen';
import { CashManagementScreen } from '../screens/CashManagementScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Text, ActivityIndicator, View, StatusBar, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { Sidebar } from '../components/web/Sidebar';
import { useSidebarState } from '../hooks/useSidebarState';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();

// Custom Tab Bar with FAB
const CustomTabBar = ({ state, descriptors, navigation }: any) => {
    const { colors } = useTheme();
    const stackNavigation = useNavigation<any>();

    return (
        <View style={[styles.tabBarContainer, { backgroundColor: colors.cardBackground }]}>
            {state.routes.map((route: any, index: number) => {
                const { options } = descriptors[route.key];
                const label = options.title || route.name;
                const isFocused = state.index === index;

                let iconName = 'circle';
                let activeColor = colors.primary;

                if (route.name === 'Summary') {
                    iconName = isFocused ? 'file-tray-full' : 'file-tray-full-outline';
                    activeColor = colors.primary;
                } else if (route.name === 'Portfolio') {
                    iconName = isFocused ? 'pie-chart' : 'pie-chart-outline';
                    activeColor = '#8E44AD';
                } else if (route.name === 'Transactions') {
                    iconName = isFocused ? 'swap-horizontal' : 'swap-horizontal-outline';
                    activeColor = '#FF9500';
                } else if (route.name === 'Favorites') {
                    iconName = isFocused ? 'star' : 'star-outline';
                    activeColor = '#FFCC00';
                }

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                // Add FAB after Portfolio (index 1)
                if (index === 2) {
                    return (
                        <React.Fragment key={route.key}>
                            {/* FAB Button */}
                            <TouchableOpacity
                                style={[styles.fabButton, { backgroundColor: colors.primary }]}
                                onPress={() => stackNavigation.navigate('AddInstrument')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add" size={32} color="#FFFFFF" />
                            </TouchableOpacity>

                            {/* Regular tab */}
                            <TouchableOpacity
                                key={route.key}
                                style={styles.tabItem}
                                onPress={onPress}
                            >
                                <Ionicons
                                    name={iconName as any}
                                    size={24}
                                    color={isFocused ? activeColor : colors.subText}
                                />
                                <Text style={[
                                    styles.tabLabel,
                                    { color: isFocused ? activeColor : colors.subText }
                                ]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        </React.Fragment>
                    );
                }

                return (
                    <TouchableOpacity
                        key={route.key}
                        style={styles.tabItem}
                        onPress={onPress}
                    >
                        <Ionicons
                            name={iconName as any}
                            size={24}
                            color={isFocused ? activeColor : colors.subText}
                        />
                        <Text style={[
                            styles.tabLabel,
                            { color: isFocused ? activeColor : colors.subText }
                        ]}>
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    tabBarContainer: {
        flexDirection: 'row',
        height: 85,
        paddingBottom: 30,
        paddingTop: 10,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 4,
    },
    fabButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -35,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
});

const TabNavigator = () => {
    const { colors, fontScale } = useTheme();
    const { startScreen } = useSettings();

    return (
        <Tab.Navigator
            initialRouteName={startScreen || 'Summary'}
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen
                name="Summary"
                component={SummaryScreen}
                options={{ title: 'Özet' }}
            />
            <Tab.Screen
                name="Portfolio"
                component={PortfolioScreen}
                options={{ title: 'Portföy' }}
            />
            <Tab.Screen
                name="Transactions"
                component={TransactionsScreen}
                options={{ title: 'İşlemler' }}
            />
            <Tab.Screen
                name="Favorites"
                component={FavoritesScreen}
                options={{ title: 'Favoriler' }}
            />
        </Tab.Navigator>
    );
};

const AuthNavigator = () => {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
    );
};

// Web-specific Stack Navigator (no tabs, sidebar instead)
const WebNavigator = () => {
    const { colors } = useTheme();
    const { isCollapsed, toggleSidebar, isLoading } = useSidebarState();

    if (isLoading) {
        return <View style={{ flex: 1, backgroundColor: colors.background }} />;
    }

    return (
        <View style={{ flex: 1, flexDirection: 'row', width: '100%', height: '100%' }}>
            <Sidebar isCollapsed={isCollapsed} />
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Toggle Button */}
                <View style={{ position: 'absolute', top: 20, left: isCollapsed ? 20 : 220, zIndex: 1000 }}>
                    <TouchableOpacity
                        onPress={toggleSidebar}
                        style={{
                            backgroundColor: colors.cardBackground,
                            padding: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                        }}
                    >
                        <Ionicons name={isCollapsed ? 'menu' : 'close'} size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Content Container to limit width on large screens */}
                <View style={{ flex: 1, maxWidth: 1200, width: '100%', alignSelf: 'center' }}>
                    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Summary">
                        <Stack.Screen name="Summary" component={SummaryScreen} />
                        <Stack.Screen name="Portfolio" component={PortfolioScreen} />
                        <Stack.Screen name="Transactions" component={TransactionsScreen} />
                        <Stack.Screen name="Favorites" component={FavoritesScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
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
                        <Stack.Screen
                            name="AssetDetail"
                            component={AssetDetailScreen}
                            options={{ presentation: 'modal', title: 'Varlık Detayı' }}
                        />
                    </Stack.Navigator>
                </View>
            </View>
        </View>
    );
};

// Mobile Navigator (with tabs)
const MainNavigator = () => {
    return (
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
            <Stack.Screen
                name="AssetDetail"
                component={AssetDetailScreen}
                options={{ presentation: 'modal', title: 'Varlık Detayı' }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
        </Stack.Navigator>
    );
};

export const AppNavigator = () => {
    const { colors, theme } = useTheme();
    const { user, isLoading } = useAuth();

    // Show loading indicator while checking auth state
    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.text, marginTop: 16 }}>Yükleniyor...</Text>
            </View>
        );
    }

    // Choose navigator based on platform
    const AppContent = user ? (Platform.OS === 'web' ? <WebNavigator /> : <MainNavigator />) : <AuthNavigator />;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar
                barStyle={theme === 'light' ? 'dark-content' : 'light-content'}
                backgroundColor={colors.background}
                translucent={false}
            />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
                <NavigationContainer>
                    {AppContent}
                </NavigationContainer>
            </SafeAreaView>
        </View>
    );
};
