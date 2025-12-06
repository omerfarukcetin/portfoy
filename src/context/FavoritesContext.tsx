import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Instrument } from '../types';

interface FavoritesContextType {
    favorites: Instrument[];
    addFavorite: (instrument: Instrument) => Promise<void>;
    removeFavorite: (id: string) => Promise<void>;
    isFavorite: (id: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
    const [favorites, setFavorites] = useState<Instrument[]>([]);

    useEffect(() => {
        loadFavorites();
    }, []);

    const loadFavorites = async () => {
        try {
            const stored = await AsyncStorage.getItem('favorites');
            if (stored) {
                setFavorites(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    };

    const saveFavorites = async (newFavorites: Instrument[]) => {
        try {
            await AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
            setFavorites(newFavorites);
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    };

    const addFavorite = async (instrument: Instrument) => {
        const newFavorites = [...favorites, instrument];
        await saveFavorites(newFavorites);
    };

    const removeFavorite = async (id: string) => {
        const newFavorites = favorites.filter(fav => fav.id !== id);
        await saveFavorites(newFavorites);
    };

    const isFavorite = (id: string) => {
        return favorites.some(fav => fav.id === id);
    };

    return (
        <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite }}>
            {children}
        </FavoritesContext.Provider>
    );
};

export const useFavorites = () => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within FavoritesProvider');
    }
    return context;
};
