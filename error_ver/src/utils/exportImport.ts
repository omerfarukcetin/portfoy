import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

export interface ExportData {
    version: string;
    exportDate: string;
    portfolios: any[];
    activePortfolioId: string;
}

/**
 * Export portfolio data to JSON file and share it
 */
export const exportPortfolioData = async (portfolios: any[], activePortfolioId: string): Promise<void> => {
    try {
        const exportData: ExportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            portfolios,
            activePortfolioId
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const fileName = `portfoy_yedek_${new Date().toISOString().split('T')[0]}.json`;
        const fileUri = FileSystem.documentDirectory + fileName;

        // Write to file
        await FileSystem.writeAsStringAsync(fileUri, jsonString);

        // Share the file
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/json',
                dialogTitle: 'Portföy Verilerini Kaydet',
                UTI: 'public.json'
            });
        } else {
            Alert.alert('Başarılı', `Dosya kaydedildi: ${fileName}`);
        }
    } catch (error) {
        console.error('Export error:', error);
        Alert.alert('Hata', 'Dışa aktarma başarısız oldu');
        throw error;
    }
};

/**
 * Pick and import portfolio data from JSON file
 */
export const importPortfolioData = async (): Promise<ExportData | null> => {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'application/json',
            copyToCacheDirectory: true
        });

        if (result.canceled) {
            return null;
        }

        const fileUri = result.assets[0].uri;
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const data = JSON.parse(fileContent);

        // Validate data
        if (!validateImportData(data)) {
            Alert.alert('Hata', 'Geçersiz dosya formatı');
            return null;
        }

        return data;
    } catch (error) {
        console.error('Import error:', error);
        Alert.alert('Hata', 'İçe aktarma başarısız oldu. Dosya formatını kontrol edin.');
        return null;
    }
};

/**
 * Validate imported data structure
 */
export const validateImportData = (data: any): data is ExportData => {
    if (!data || typeof data !== 'object') return false;
    if (!data.version || !data.exportDate) return false;
    if (!Array.isArray(data.portfolios)) return false;
    if (!data.activePortfolioId) return false;

    // Check if portfolios have required fields
    for (const portfolio of data.portfolios) {
        if (!portfolio.id || !portfolio.name || !Array.isArray(portfolio.items)) {
            return false;
        }
    }

    return true;
};
