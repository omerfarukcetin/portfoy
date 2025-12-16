import { db } from './firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Upload portfolio backup to Firestore
 * Path: users/{userId}/backups/latest
 */
export const uploadBackup = async (userId: string, data: any): Promise<void> => {
    try {
        // Add metadata
        const backupData = {
            ...data,
            cloudUpdatedAt: new Date().toISOString(),
            platform: 'mobile'
        };

        const docRef = doc(db, 'users', userId, 'backups', 'latest');
        await setDoc(docRef, backupData);
        console.log('Backup uploaded successfully');
    } catch (error) {
        console.error("Cloud Backup Error:", error);
        throw error;
    }
};

/**
 * Download portfolio backup from Firestore
 * Returns null if no backup exists
 */
export const downloadBackup = async (userId: string): Promise<any | null> => {
    try {
        const docRef = doc(db, 'users', userId, 'backups', 'latest');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log('No backup found');
            return null;
        }
    } catch (error) {
        console.error("Cloud Restore Error:", error);
        throw error;
    }
};
