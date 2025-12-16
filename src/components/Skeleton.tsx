import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    style?: ViewStyle;
    borderRadius?: number;
}

export const Skeleton = ({ width = '100%', height = 20, style, borderRadius = 4 }: SkeletonProps) => {
    const { colors } = useTheme();
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );

        animation.start();

        return () => animation.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: colors.border, // Using border color as base skeleton color
                    opacity,
                },
                style,
            ]}
        />
    );
};

const styles = StyleSheet.create({
    skeleton: {
        // Base styles if needed
    },
});
