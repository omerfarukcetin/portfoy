import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    style?: ViewStyle;
    borderRadius?: number;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const Skeleton = ({ width = '100%', height = 20, style, borderRadius = 8 }: SkeletonProps) => {
    const { colors, theme } = useTheme();
    const translateX = useSharedValue(-1);

    useEffect(() => {
        translateX.value = withRepeat(
            withTiming(1, {
                duration: 1500,
                easing: Easing.ease,
            }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: translateX.value * (typeof width === 'number' ? width : 300),
                },
            ],
        };
    });

    // Dynamic colors based on theme
    const baseColor = theme === 'light' ? '#E1E9EE' : colors.border;
    const shimmerColor = theme === 'light' ? '#F6F7F8' : colors.cardBackground;

    return (
        <View
            style={[
                styles.container,
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: baseColor,
                    overflow: 'hidden',
                },
                style,
            ]}
        >
            <AnimatedLinearGradient
                colors={[baseColor, shimmerColor, baseColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                    StyleSheet.absoluteFillObject,
                    animatedStyle,
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
});
