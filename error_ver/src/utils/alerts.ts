import { Platform, Alert } from 'react-native';

/**
 * Platform-aware alert function
 * Uses native Alert on mobile, window.alert/confirm on web
 */
export const showAlert = (title: string, message?: string, buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}>) => {
    if (Platform.OS === 'web') {
        if (buttons && buttons.length > 1) {
            // Confirmation dialog
            const confirmButton = buttons.find(b => b.style === 'destructive' || b.style === 'default');
            const fullMessage = message ? `${title}\n\n${message}` : title;

            if (window.confirm(fullMessage)) {
                confirmButton?.onPress?.();
            } else {
                const cancelButton = buttons.find(b => b.style === 'cancel');
                cancelButton?.onPress?.();
            }
        } else {
            // Simple alert
            const fullMessage = message ? `${title}\n\n${message}` : title;
            window.alert(fullMessage);
            buttons?.[0]?.onPress?.();
        }
    } else {
        // Native Alert
        if (buttons) {
            Alert.alert(title, message, buttons);
        } else {
            Alert.alert(title, message);
        }
    }
};
