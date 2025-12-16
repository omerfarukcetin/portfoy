import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SIDEBAR_STATE_KEY = 'sidebar_collapsed';

export const useSidebarState = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved state on mount
    useEffect(() => {
        const loadState = async () => {
            try {
                const saved = await AsyncStorage.getItem(SIDEBAR_STATE_KEY);
                if (saved !== null) {
                    setIsCollapsed(JSON.parse(saved));
                }
            } catch (error) {
                console.log('Could not load sidebar state:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadState();
    }, []);

    // Save state when it changes
    const toggleSidebar = async () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);

        try {
            await AsyncStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(newState));
        } catch (error) {
            console.log('Could not save sidebar state:', error);
        }
    };

    return {
        isCollapsed,
        isLoading,
        toggleSidebar
    };
};
