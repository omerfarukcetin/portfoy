import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Fallback timeout in case Firebase auth is slow to respond
        const timeout = setTimeout(() => {
            if (isLoading) {
                console.log('Auth: Timeout reached, setting loading to false');
                setIsLoading(false);
            }
        }, 2000);

        const unsubscribe = onAuthStateChanged(auth, (usr) => {
            setUser(usr);
            setIsLoading(false);
            clearTimeout(timeout);
        });

        return () => {
            unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
