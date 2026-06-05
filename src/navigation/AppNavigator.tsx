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
import { AssetDetailScreen } from '../screens/AssetDetailScreen';
import { CashManagementScreen } from '../screens/CashManagementScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ManageCategoriesScreen } from '../screens/ManageCategoriesScreen';
import { DividendsScreen } from '../screens/DividendsScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Text, ActivityIndicator, View, StatusBar, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import {
    LayoutDashboard,
    PieChart,
    Repeat,
    Star,
    Plus,
    Settings,
    Briefcase,
    List,
    Home,
    Wallet
} from 'lucide-react-native';
import { Sidebar } from '../components/web/Sidebar';

// Turkish page titles for web
const PAGE_TITLES: Record<string, string> = {
    'Summary': 'Özet - Portföy Cepte',
    'Portfolio': 'Portföy - Portföy Cepte',
    'Transactions': 'İşlemler - Portföy Cepte',
    'Favorites': 'Favoriler - Portföy Cepte',
    'Settings': 'Ayarlar - Portföy Cepte',
    'AddInstrument': 'Varlık Ekle - Portföy Cepte',
    'CashManagement': 'Yedek Akçe - Portföy Cepte',
    'ManageCategories': 'Kategorileri Yönet - Portföy Cepte',
    'AssetDetail': 'Varlık Detayı - Portföy Cepte',
    'Login': 'Giriş Yap - Portföy Cepte',
    'Register': 'Kayıt Ol - Portföy Cepte',
    'Dividends': 'Temettüler - Portföy Cepte',
    'Wallet': 'Cüzdan - Portföy Cepte',
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
                let Icon: any = LayoutDashboard;

                if (route.name === 'Summary') {
                    Icon = LayoutDashboard;
                    activeColor = colors.primary;
                } else if (route.name === 'Portfolio') {
                    Icon = PieChart;
                    activeColor = '#8E44AD';
                } else if (route.name === 'Transactions') {
                    Icon = Repeat;
                    activeColor = '#FF9500';
                } else if (route.name === 'Favorites') {
                    Icon = Star;
                    activeColor = '#FFCC00';
                } else if (route.name === 'Wallet') {
                    Icon = Wallet;
                    activeColor = '#10B981';
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
                                <Plus size={32} color="#FFFFFF" strokeWidth={3} />
                            </TouchableOpacity>

                            {/* Regular tab */}
                            <TouchableOpacity
                                key={route.key}
                                style={styles.tabItem}
                                onPress={onPress}
                            >
                                <Icon
                                    size={22}
                                    color={isFocused ? activeColor : colors.subText}
                                    strokeWidth={isFocused ? 2.5 : 2}
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
                        <Icon
                            size={22}
                            color={isFocused ? activeColor : colors.subText}
                            strokeWidth={isFocused ? 2.5 : 2}
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
    // Bottom Tab Bar for Mobile Web
    bottomTabBar: {
        flexDirection: 'row',
        height: 70,
        paddingBottom: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 2,
    },
    addButtonTab: {
        backgroundColor: '#007AFF',
        width: 56,
        height: 56,
        borderRadius: 28,
        marginTop: -20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
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
                options={{ title: 'Özet' }}
            />
            <Tab.Screen
                name="Portfolio"
                component={PortfolioScreen}
                options={{ title: 'Portföy' }}
            />
            <Tab.Screen
                name="Wallet"
                component={WalletScreen}
                options={{ title: 'Cüzdan' }}
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
    const navigation = useNavigation<any>();
    const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
    const [activeTab, setActiveTab] = useState('Summary');

    // Track window width changes
    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setWindowWidth(window.width);
        });
        return () => subscription?.remove();
    }, []);

    const isMobile = windowWidth < 768;

    const mobileMenuItems = [
        { name: 'Summary', label: 'Özet', Icon: LayoutDashboard },
        { name: 'Portfolio', label: 'Portföy', Icon: PieChart },
        { name: 'Wallet', label: 'Cüzdan', Icon: Wallet },
        { name: 'AddInstrument', label: 'Ekle', Icon: Plus },
        { name: 'Transactions', label: 'İşlemler', Icon: Repeat },
    ];

    const handleTabPress = (tabName: string) => {
        setActiveTab(tabName);
        navigation.navigate(tabName);
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Main Content Area */}
            <View style={{ flex: 1, flexDirection: 'row' }}>
                {/* Sidebar - Desktop only */}
                {!isMobile && <Sidebar />}

                {/* Content */}
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ flex: 1, maxWidth: 1800, width: '100%', alignSelf: 'center' }}>
                        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Summary">
                            <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Özet' }} />
                            <Stack.Screen name="Portfolio" component={PortfolioScreen} options={{ title: 'Portföy' }} />
                            <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'İşlemler' }} />
                            <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favoriler' }} />
                            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
                            <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Cüzdan' }} />
                            <Stack.Screen
                                name="AddInstrument"
                                component={AddInstrumentScreen}
                                options={{ presentation: 'modal', title: 'Varlık Ekle' }}
                            />
                            <Stack.Screen
                                name="CashManagement"
                                component={CashManagementScreen}
                                options={{ presentation: 'modal', title: 'Yedek Akçe' }}
                            />
                            <Stack.Screen
                                name="AssetDetail"
                                component={AssetDetailScreen}
                                options={{ presentation: 'modal', title: 'Varlık Detayı' }}
                            />
                            <Stack.Screen name="Dividends" component={DividendsScreen} options={{ title: 'Temettüler' }} />
                            <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} options={{ title: 'Kategorileri Yönet' }} />
                        </Stack.Navigator>
                    </View>
                </View>
            </View>

            {/* Bottom Tab Bar - Mobile only */}
            {
                isMobile && (
                    <View style={[webStyles.bottomTabBar, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
                        {mobileMenuItems.map((item) => {
                            const isActive = activeTab === item.name;
                            const isAddButton = item.name === 'AddInstrument';
                            return (
                                <TouchableOpacity
                                    key={item.name}
                                    style={[webStyles.tabItem, isAddButton && webStyles.addButtonTab]}
                                    onPress={() => handleTabPress(item.name)}
                                >
                                    <item.Icon
                                        size={isAddButton ? 28 : 22}
                                        color={isAddButton ? '#fff' : (isActive ? colors.primary : colors.subText)}
                                        strokeWidth={isActive || isAddButton ? 2.5 : 2}
                                    />
                                    {!isAddButton && (
                                        <Text style={[webStyles.tabLabel, { color: isActive ? colors.primary : colors.subText }]}>
                                            {item.label}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )
            }
        </View >
    );
};

// Mobile Navigator (with tabs)
const MainNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={HomeTabNavigator} />
            <Stack.Screen
                name="AddInstrument"
                component={AddInstrumentScreen}
                options={{ presentation: 'modal', title: 'Varlık Ekle' }}
            />
            <Stack.Screen
                name="CashManagement"
                component={CashManagementScreen}
                options={{ presentation: 'modal', title: 'Yedek Akçe' }}
            />
            <Stack.Screen
                name="AssetDetail"
                component={AssetDetailScreen}
                options={{ presentation: 'modal', title: 'Varlık Detayı' }}
            />
            <Stack.Screen name="Dividends" component={DividendsScreen} options={{ title: 'Temettüler' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
            <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} options={{ title: 'Kategorileri Yönet' }} />
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
        const APP_NAME = 'Portföy Cepte';
        const titles: Record<string, string> = {
            'Summary': `Özet - ${APP_NAME}`,
            'Portfolio': `Portföy - ${APP_NAME}`,
            'Transactions': `İşlemler - ${APP_NAME}`,
            'Favorites': `Favoriler - ${APP_NAME}`,
            'Settings': `Ayarlar - ${APP_NAME}`,
            'AddInstrument': `Varlık Ekle - ${APP_NAME}`,
            'CashManagement': `Yedek Akçe - ${APP_NAME}`,
            'AssetDetail': `Varlık Detayı - ${APP_NAME}`,
            'Login': `Giriş Yap - ${APP_NAME}`,
            'Register': `Kayıt Ol - ${APP_NAME}`,
            'Dividends': `Temettüler - ${APP_NAME}`,
            'Main': APP_NAME,
        };

        // If language is not Turkish, we still prefer Turkish titles as per user request
        return titles[routeName] || APP_NAME;
    };

    // Update document title on web when route changes
    useEffect(() => {
        if (Platform.OS === 'web' && navigationRef.current) {
            // Set initial title
            const setInitialTitle = () => {
                const currentRoute = navigationRef.current?.getCurrentRoute();
                if (currentRoute) {
                    document.title = getPageTitle(currentRoute.name);
                } else {
                    document.title = 'Portföy Cepte';
                }
            };

            // Small delay to ensure navigator is ready
            const timer = setTimeout(setInitialTitle, 100);

            const unsubscribe = navigationRef.current.addListener('state', () => {
                const currentRoute = navigationRef.current?.getCurrentRoute();
                if (currentRoute) {
                    const title = getPageTitle(currentRoute.name);
                    if (typeof document !== 'undefined') {
                        document.title = title;
                    }
                }
            });
            return () => {
                unsubscribe();
                clearTimeout(timer);
            };
        }
    }, [language, navigationRef]);

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
