import React from 'react';
import { View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface GradientCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>; // New prop for inner styles (padding etc)
    onPress?: () => void;
    onLongPress?: () => void;
    /**
     * 'primary': Highlight card (Header) - Always dark/vibrant for contrast
     * 'secondary': Standard card (Stats, Lists) - Adapts to theme (Light/Dark)
     */
    variant?: 'primary' | 'secondary';
    customColors?: [string, string, ...string[]];
    activeOpacity?: number;
}

export const GradientCard: React.FC<GradientCardProps> = ({
    children,
    style,
    contentStyle,
    onPress,
    onLongPress,
    variant = 'secondary',
    customColors,
    activeOpacity = 0.8
}) => {
    const { theme, colors } = useTheme();

    const getGradientColors = (): [string, string, ...string[]] => {
        if (customColors) return customColors;

        if (variant === 'primary') {
            // Header Card: Lighter Blue/Royal
            return ['#1e3c72', '#2a5298'];
        }

        // Secondary
        if (theme === 'light') {
            return ['#ffffff', '#f8fafc'];
        } else {
            return ['#141E30', '#243B55'];
        }
    };

    const gradientColors = getGradientColors();

    const Container = onPress || onLongPress ? TouchableOpacity : View;

    // We apply 'style' (margins, width, borders) to the Container.
    // We apply 'contentStyle' (padding, alignment) to the Gradient.
    // Container needs overflow: 'hidden' to clip the gradient if borderRadius is used.

    return (
        <Container
            activeOpacity={onPress || onLongPress ? activeOpacity : undefined}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.container, styles.shadow, style, { overflow: 'hidden' }]}
        >
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradient, contentStyle]}
            >
                {children}
            </LinearGradient>
        </Container>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        backgroundColor: 'transparent', // Ensure no background interferes
    },
    gradient: {
        // borderRadius: 16, // Removed because Container clips it
        padding: 16,
        width: '100%',
        flex: 1, // Fill container
    },
    shadow: {
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    }
});
