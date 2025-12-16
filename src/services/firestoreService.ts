import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    onSnapshot,
    query,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Portfolio } from '../types';

// Firestore collection references
const getUserPortfoliosRef = (userId: string) =>
    collection(db, 'users', userId, 'portfolios');

const getUserDocRef = (userId: string) =>
    doc(db, 'users', userId);

/**
 * Save all portfolios for a user to Firestore
 */
export const saveUserPortfolios = async (userId: string, portfolios: Portfolio[], activePortfolioId: string): Promise<void> => {
    try {
        const batch = writeBatch(db);

        // Save user metadata (active portfolio ID)
        const userDocRef = getUserDocRef(userId);
        batch.set(userDocRef, {
            activePortfolioId,
            updatedAt: Date.now()
        }, { merge: true });

        // Get existing portfolios to handle deletions
        const existingSnapshot = await getDocs(getUserPortfoliosRef(userId));
        const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id));
        const newIds = new Set(portfolios.map(p => p.id));

        // Delete removed portfolios
        for (const id of existingIds) {
            if (!newIds.has(id)) {
                const portfolioRef = doc(db, 'users', userId, 'portfolios', id);
                batch.delete(portfolioRef);
            }
        }

        // Save/update all portfolios
        for (const portfolio of portfolios) {
            const portfolioRef = doc(db, 'users', userId, 'portfolios', portfolio.id);
            batch.set(portfolioRef, {
                ...portfolio,
                updatedAt: Date.now()
            });
        }

        await batch.commit();
        console.log('✅ Portfolios saved to Firestore');
    } catch (error) {
        console.error('❌ Error saving portfolios to Firestore:', error);
        throw error;
    }
};

/**
 * Load all portfolios for a user from Firestore
 */
export const loadUserPortfolios = async (userId: string): Promise<{ portfolios: Portfolio[], activePortfolioId: string }> => {
    try {
        // Get user metadata
        const userDocRef = getUserDocRef(userId);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();
        const activePortfolioId = userData?.activePortfolioId || '';

        // Get all portfolios
        const portfoliosSnapshot = await getDocs(getUserPortfoliosRef(userId));
        const portfolios: Portfolio[] = [];

        portfoliosSnapshot.forEach((doc) => {
            const data = doc.data();
            portfolios.push({
                id: data.id || doc.id,
                name: data.name || 'Portföy',
                color: data.color || '#007AFF',
                icon: data.icon || '💼',
                createdAt: data.createdAt || Date.now(),
                items: data.items || [],
                cashBalance: data.cashBalance || 0,
                cashItems: data.cashItems || [],
                realizedTrades: data.realizedTrades || [],
                history: data.history || []
            });
        });

        console.log(`✅ Loaded ${portfolios.length} portfolios from Firestore`);
        return { portfolios, activePortfolioId };
    } catch (error) {
        console.error('❌ Error loading portfolios from Firestore:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time portfolio updates
 */
export const subscribeToPortfolios = (
    userId: string,
    onUpdate: (portfolios: Portfolio[]) => void
) => {
    const q = query(getUserPortfoliosRef(userId));

    return onSnapshot(q, (snapshot) => {
        const portfolios: Portfolio[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            portfolios.push({
                id: data.id || doc.id,
                name: data.name || 'Portföy',
                color: data.color || '#007AFF',
                icon: data.icon || '💼',
                createdAt: data.createdAt || Date.now(),
                items: data.items || [],
                cashBalance: data.cashBalance || 0,
                cashItems: data.cashItems || [],
                realizedTrades: data.realizedTrades || [],
                history: data.history || []
            });
        });
        onUpdate(portfolios);
    });
};

/**
 * Migrate data from AsyncStorage to Firestore (one-time operation)
 */
export const migrateToFirestore = async (userId: string, portfolios: Portfolio[], activePortfolioId: string): Promise<void> => {
    try {
        // Check if user already has data in Firestore
        const existingData = await loadUserPortfolios(userId);
        if (existingData.portfolios.length > 0) {
            console.log('ℹ️ User already has Firestore data, skipping migration');
            return;
        }

        // Save legacy data to Firestore
        if (portfolios.length > 0) {
            await saveUserPortfolios(userId, portfolios, activePortfolioId);
            console.log('✅ Migration to Firestore completed');
        }
    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    }
};
