import { supabase } from './supabaseClient';

/**
 * Upload portfolio backup to Supabase
 * Table: backups
 */
export const uploadBackup = async (userId: string, data: any): Promise<void> => {
    try {
        // Add metadata
        const backupData = {
            id: userId, // Use userId as the primary key for 'latest' concept
            content: data,
            cloudUpdatedAt: new Date().toISOString(),
            platform: 'mobile'
        };

        const { error } = await supabase
            .from('backups')
            .upsert(backupData);

        if (error) throw error;
        console.log('Backup uploaded successfully to Supabase');
    } catch (error) {
        console.error("Cloud Backup Error (Supabase):", error);
        throw error;
    }
};

/**
 * Download portfolio backup from Supabase
 * Returns null if no backup exists
 */
export const downloadBackup = async (userId: string): Promise<any | null> => {
    try {
        const { data, error } = await supabase
            .from('backups')
            .select('content')
            .eq('id', userId)
            .single();

        if (error) {
            console.log('No backup found in Supabase');
            return null;
        }

        return data?.content;
    } catch (error) {
        console.error("Cloud Restore Error (Supabase):", error);
        throw error;
    }
};
