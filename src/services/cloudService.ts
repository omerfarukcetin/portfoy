import { supabase } from './supabaseClient';

/**
 * Upload portfolio backup to Supabase
 * Path: user's portfolios table
 */
export const uploadBackup = async (userId: string, data: any): Promise<void> => {
    try {
        // Add metadata
        const backupData = {
            ...data,
            cloudUpdatedAt: new Date().toISOString(),
            platform: 'mobile'
        };

        const { error } = await supabase
            .from('user_metadata')
            .upsert({
                id: userId,
                backup_data: backupData,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log('Backup uploaded successfully');
    } catch (error) {
        console.error("Cloud Backup Error:", error);
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
            .from('user_metadata')
            .select('backup_data')
            .eq('id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('No backup found');
                return null;
            }
            throw error;
        }

        if (data?.backup_data) {
            return data.backup_data;
        } else {
            console.log('No backup found');
            return null;
        }
    } catch (error) {
        console.error("Cloud Restore Error:", error);
        throw error;
    }
};
