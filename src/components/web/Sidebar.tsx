import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = () => {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const { user, logout } = useAuth();
    const [currentRoute, setCurrentRoute] = useState('Summary');

    // Track route changes on web using multiple methods
    useEffect(() => {
        const updateCurrentRoute = () => {
            // Method 1: Try window.location
            if (Platform.OS === 'web') {
                const path = window.location.hash || window.location.pathname;
                const routeMatch = path.match(/\/(Summary|Portfolio|Transactions|Favorites|Settings)/i);
                if (routeMatch) {
                    const newRoute = routeMatch[1];
                    if (newRoute !== currentRoute) {
                        setCurrentRoute(newRoute);
                    }
                    return;
                }
            }

            // Method 2: Fallback to navigation.getState()
            try {
                const state = navigation.getState();
                const routes = state?.routes || [];
                const currentRouteObj = routes[state.index];
                if (currentRouteObj?.name) {
                    const newRoute = currentRouteObj.name;
                    if (newRoute !== currentRoute) {
                        setCurrentRoute(newRoute);
                    }
                }
            } catch (e) {
                // Silent fallback
            }
        };

        updateCurrentRoute();
        const unsubscribe = navigation.addListener('state', updateCurrentRoute);
        return unsubscribe;
    }, [navigation, currentRoute]);

    // Menu items organized by section
    const mainMenuItems = [
        { name: 'Summary', label: 'Genel Bakış', icon: 'grid', iconType: 'feather' },
        { name: 'Portfolio', label: 'Portföy', icon: 'pie-chart', iconType: 'feather' },
        { name: 'Transactions', label: 'İşlemler', icon: 'repeat', iconType: 'feather' },
        { name: 'Favorites', label: 'Takip Listesi', icon: 'heart', iconType: 'feather' },
    ];

    const preferenceItems = [
        { name: 'Settings', label: 'Ayarlar', icon: 'settings', iconType: 'feather' },
    ];

    const handleLogout = async () => {
        await logout();
    };

    const renderNavItem = (item: any) => {
        const isActive = currentRoute === item.name;
        return (
            <TouchableOpacity
                key={item.name}
                style={[
                    styles.navItem,
                    isActive && [styles.navItemActive, { backgroundColor: colors.primary + '15' }]
                ]}
                onPress={() => navigation.navigate(item.name)}
            >
                <View style={[
                    styles.iconContainer,
                    isActive && [styles.iconContainerActive, { backgroundColor: colors.primary + '20' }]
                ]}>
                    <Feather
                        name={item.icon as any}
                        size={18}
                        color={isActive ? colors.primary : colors.subText}
                    />
                </View>
                <Text
                    style={[
                        styles.navLabel,
                        { color: isActive ? colors.primary : colors.text },
                        isActive && styles.navLabelActive
                    ]}
                >
                    {item.label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.sidebar, { backgroundColor: colors.cardBackground, borderRightColor: colors.border }]}>
            {/* Logo */}
            <View style={styles.logo}>
                <View style={styles.logoRow}>
                    <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
                        <Text style={styles.logoIconText}>P</Text>
                    </View>
                    <View>
                        <Text style={styles.logoText}>
                            <Text style={{ color: colors.primary }}>Portföy</Text>
                            <Text style={{ color: colors.success }}>Cepte</Text>
                        </Text>
                        <Text style={[styles.logoSubtext, { color: colors.subText }]}>YATIRIM ASİSTANI</Text>
                    </View>
                </View>
            </View>

            {/* Main Menu Section */}
            <View style={styles.nav}>
                <Text style={[styles.sectionLabel, { color: colors.subText }]}>MENÜ</Text>
                {mainMenuItems.map(renderNavItem)}

                {/* Preferences Section */}
                <Text style={[styles.sectionLabel, { color: colors.subText, marginTop: 24 }]}>TERCİHLER</Text>
                {preferenceItems.map(renderNavItem)}
            </View>

            {/* User Profile */}
            {user && (
                <View style={[styles.userProfile, { borderTopColor: colors.border }]}>
                    <View style={styles.userInfo}>
                        <View style={[styles.avatar, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <Feather name="file-text" size={16} color={colors.subText} />
                        </View>
                        <View style={styles.userDetails}>
                            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                                {user.email?.split('@')[0] || 'Kullanıcı'}
                            </Text>
                            <Text style={[styles.userRole, { color: colors.subText }]}>Pro Üyelik</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogout}
                    >
                        <Feather name="log-out" size={18} color={colors.subText} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    sidebar: {
        width: 220,
        height: '100%',
        borderRightWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 20,
        flexDirection: 'column',
    },
    logo: {
        marginBottom: 32,
        paddingBottom: 0,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoIconText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    logoText: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    logoSubtext: {
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 1,
        marginTop: 2,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    nav: {
        flex: 1,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        gap: 12,
        marginBottom: 4,
    },
    navItemActive: {
        borderRadius: 10,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainerActive: {
        // Active icon container style
    },
    navLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    navLabelActive: {
        fontWeight: '600',
    },
    userProfile: {
        borderTopWidth: 1,
        paddingTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        overflow: 'hidden',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userDetails: {
        flex: 1,
    },
    userName: {
        fontSize: 13,
        fontWeight: '600',
    },
    userRole: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
    logoutButton: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
});
