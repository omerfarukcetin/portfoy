import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Alert, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface SwipeableTransactionItemProps {
    children: React.ReactNode;
    onDelete: () => void;
    onPress?: () => void;
}

export const SwipeableTransactionItem: React.FC<SwipeableTransactionItemProps> = ({
    children,
    onDelete,
    onPress
}) => {
    const { colors } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);

    const handleDelete = () => {
        // Trigger haptic feedback
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        Alert.alert(
            'İşlemi Sil',
            'Bu işlemi silmek istediğinizden emin misiniz?',
            [
                {
                    text: 'İptal',
                    style: 'cancel',
                    onPress: () => swipeableRef.current?.close()
                },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: () => {
                        if (Platform.OS !== 'web') {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                        onDelete();
                    }
                }
            ]
        );
    };

    const renderRightActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const scale = dragX.interpolate({
            inputRange: [-100, -50, 0],
            outputRange: [1, 0.9, 0.8],
            extrapolate: 'clamp'
        });

        return (
            <Animated.View style={[styles.deleteContainer, { transform: [{ scale }] }]}>
                <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: colors.danger }]}
                    onPress={handleDelete}
                    activeOpacity={0.8}
                >
                    <Feather name="trash-2" size={22} color="#fff" />
                    <Text style={styles.deleteText}>Sil</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            overshootRight={false}
            friction={2}
            onSwipeableWillOpen={() => {
                if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
            }}
        >
            <TouchableOpacity
                activeOpacity={onPress ? 0.7 : 1}
                onPress={onPress}
                style={{ backgroundColor: colors.cardBackground }}
            >
                {children}
            </TouchableOpacity>
        </Swipeable>
    );
};

const styles = StyleSheet.create({
    deleteContainer: {
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 10,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        minWidth: 80,
        height: '90%',
    },
    deleteText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});
