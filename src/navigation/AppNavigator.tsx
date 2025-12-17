import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigation, useNavigationContainerRef } from '@react-navigation/native';
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
import { useLanguage } from '../context/LanguageContext';
import { Text, ActivityIndicator, View, StatusBar, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Sidebar } from '../components/web/Sidebar';

// Turkish page titles for web
const PAGE_TITLES: Record<string, string> = {
    'Summary': 'Özet - Portföy Cepte',
    'Portfolio': 'Portföy - Portföy Cepte',
    'Transactions': 'İşlemler - Portföy Cepte',
    'Favorites': 'Favoriler - Portföy Cepte',
    'Settings': 'Ayarlar - Portföy Cepte',
    'AddInstrument': 'Varlık Ekle - Portföy Cepte',
    'SellAsset': 'Varlık Sat - Portföy Cepte',
    'CashManagement': 'Yedek Akçe - Portföy Cepte',
    'AssetDetail': 'Varlık Detayı - Portföy Cepte',
    'Login': 'Giriş Yap - Portföy Cepte',
    'Register': 'Kayıt Ol - Portföy Cepte',
};

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

// Web-specific styles for responsive sidebar
const webStyles = StyleSheet.create({
    hamburger: {
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 999,
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 998,
    },
    sidebarMobile: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 999,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
});

const HomeTabNavigator = () => {
    const { colors } = useTheme();
    const { t } = useLanguage();

    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen
                name="Summary"
                component={SummaryScreen}
                options={{ title: t('nav.summary') }}
            />
            <Tab.Screen
                name="Portfolio"
                component={PortfolioScreen}
                options={{ title: t('nav.portfolio') }}
            />
            <Tab.Screen
                name="Transactions"
                component={TransactionsScreen}
                options={{ title: t('nav.transactions') }}
            />
            <Tab.Screen
                name="Favorites"
                component={FavoritesScreen}
                options={{ title: t('nav.favorites') }}
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
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

    // Track window width changes
    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setWindowWidth(window.width);
        });
        return () => subscription?.remove();
    }, []);

    const isMobile = windowWidth < 768;

    return (
        <View style={{ flex: 1, flexDirection: 'row', width: '100%', height: '100%' }}>
            {/* Hamburger Menu (Mobile Only) */}
            {isMobile && (
                <TouchableOpacity
                    style={[webStyles.hamburger, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={() => setSidebarVisible(true)}
                >
                    <Feather name="menu" size={24} color={colors.text} />
                </TouchableOpacity>
            )}

            {/* Sidebar - Always visible on desktop, overlay on mobile */}
            {((!isMobile) || sidebarVisible) && (
                <>
                    {/* Backdrop for mobile */}
                    {isMobile && (
                        <TouchableOpacity
                            style={webStyles.backdrop}
                            activeOpacity={1}
                            onPress={() => setSidebarVisible(false)}
                        />
                    )}
                    <View style={[isMobile && webStyles.sidebarMobile]}>
                        <Sidebar />
                    </View>
                </>
            )}

            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Content Container to limit width on large screens */}
                <View style={{ flex: 1, maxWidth: 1800, width: '100%', alignSelf: 'center' }}>
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
    const { language } = useLanguage();
    const navigationRef = useNavigationContainerRef();

    // Get page titles based on language
    const getPageTitle = (routeName: string) => {
        const APP_NAME = language === 'tr' ? 'Portföy Cepte' : 'Portfolio Pocket';
        const titles: Record<string, string> = language === 'tr' ? {
            'Summary': `Özet - ${APP_NAME}`,
            'Portfolio': `Portföy - ${APP_NAME}`,
            'Transactions': `İşlemler - ${APP_NAME}`,
            'Favorites': `Favoriler - ${APP_NAME}`,
            'Settings': `Ayarlar - ${APP_NAME}`,
            'AddInstrument': `Varlık Ekle - ${APP_NAME}`,
            'SellAsset': `Varlık Sat - ${APP_NAME}`,
            'CashManagement': `Yedek Akçe - ${APP_NAME}`,
            'AssetDetail': `Varlık Detayı - ${APP_NAME}`,
            'Login': `Giriş Yap - ${APP_NAME}`,
            'Register': `Kayıt Ol - ${APP_NAME}`,
        } : {
            'Summary': `Summary - ${APP_NAME}`,
            'Portfolio': `Portfolio - ${APP_NAME}`,
            'Transactions': `Transactions - ${APP_NAME}`,
            'Favorites': `Favorites - ${APP_NAME}`,
            'Settings': `Settings - ${APP_NAME}`,
            'AddInstrument': `Add Asset - ${APP_NAME}`,
            'SellAsset': `Sell Asset - ${APP_NAME}`,
            'CashManagement': `Cash Reserve - ${APP_NAME}`,
            'AssetDetail': `Asset Detail - ${APP_NAME}`,
            'Login': `Login - ${APP_NAME}`,
            'Register': `Register - ${APP_NAME}`,
        };
        return titles[routeName] || APP_NAME;
    };

    // Update document title on web when route changes
    useEffect(() => {
        if (Platform.OS === 'web' && navigationRef.current) {
            const unsubscribe = navigationRef.current.addListener('state', () => {
                const currentRoute = navigationRef.current?.getCurrentRoute();
                if (currentRoute) {
                    const title = getPageTitle(currentRoute.name);
                    if (typeof document !== 'undefined') {
                        document.title = title;
                    }
                }
            });
            return unsubscribe;
        }
    }, [language]);

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
                <NavigationContainer ref={navigationRef}>
                    {AppContent}
                </NavigationContainer>
            </SafeAreaView>
        </View>
    );
};
