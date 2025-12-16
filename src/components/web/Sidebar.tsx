import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = () => {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const { user, logout } = useAuth();

    // Get current route name safely with error handling
    // FIX: Removing useNavigationState completely to prevent crash as per user experience
    const currentRoute = 'Summary';

    const menuItems = [
        { name: 'Summary', label: 'Özet', icon: 'home' },
        { name: 'Portfolio', label: 'Portföy', icon: 'briefcase' },
        { name: 'Transactions', label: 'İşlemler', icon: 'list' },
        { name: 'Favorites', label: 'Favoriler', icon: 'star' },
        { name: 'Settings', label: 'Ayarlar', icon: 'settings' },
    ];

    const handleLogout = async () => {
        await logout();
    };

    return (
        <View style={[styles.sidebar, { backgroundColor: colors.cardBackground, borderRightColor: colors.border }]}>
            {/* Logo */}
            <View style={styles.logo}>
                <Text style={[styles.logoText, { color: colors.primary }]}>Portföy</Text>
                <Text style={[styles.logoSubtext, { color: colors.subText }]}>Cepte</Text>
            </View>

            {/* Navigation */}
            <View style={styles.nav}>
                {menuItems.map((item) => {
                    const isActive = currentRoute === item.name;
                    return (
                        <TouchableOpacity
                            key={item.name}
                            style={[
                                styles.navItem,
                                isActive && { backgroundColor: colors.primary + '20' }
                            ]}
                            onPress={() => navigation.navigate(item.name)}
                        >
                            <Feather
                                name={item.icon as any}
                                size={18}
                                color={isActive ? colors.primary : colors.subText}
                            />
                            <Text
                                style={[
                                    styles.navLabel,
                                    { color: isActive ? colors.primary : colors.text }
                                ]}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* User Profile */}
            {user && (
                <View style={[styles.userProfile, { borderTopColor: colors.border }]}>
                    <View style={styles.userInfo}>
                        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                            <Text style={styles.avatarText}>
                                {user.email?.charAt(0).toUpperCase() || 'U'}
                            </Text>
                        </View>
                        <View style={styles.userDetails}>
                            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                                {user.email?.split('@')[0]}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.logoutButton, { backgroundColor: colors.danger + '20' }]}
                        onPress={handleLogout}
                    >
                        <Feather name="log-out" size={16} color={colors.danger} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    sidebar: {
        width: 200, // Reduced from 240
        height: '100%',
        borderRightWidth: 1,
        padding: 16, // Reduced from 20
        flexDirection: 'column',
    },
    logo: {
        marginBottom: 24, // Reduced from 32
        paddingBottom: 16,
    },
    logoText: {
        fontSize: 20, // Reduced from 24
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    logoSubtext: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 0,
    },
    nav: {
        flex: 1,
        gap: 4,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10, // Reduced from 12
        borderRadius: 8,
        gap: 10,
    },
    navLabel: {
        fontSize: 14, // Reduced from 15
        fontWeight: '500',
    },
    userProfile: {
        borderTopWidth: 1,
        paddingTop: 16,
        gap: 12,
        flexDirection: 'row', // Horizontal verify
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        overflow: 'hidden'
    },
    avatar: {
        width: 32, // Reduced
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    userDetails: {
        flex: 1,
    },
    userName: {
        fontSize: 13,
        fontWeight: '600',
    },
    logoutButton: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        borderRadius: 8,
        // Icon only logout for compactness
    },
});
