import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PortfolioItem } from '../types';

export const ExcelService = {
    exportPortfolioToExcel: async (
        portfolio: PortfolioItem[],
        currentPrices: Record<string, number>,
        usdRate: number,
        portfolioName: string = 'Portfoy'
    ) => {
        try {
            // Prepare data for Excel
            const data = portfolio.map((item) => {
                const currentPrice = currentPrices[item.instrumentId] || item.averageCost;
                let totalValue = item.amount * currentPrice;
                let costTry = item.amount * item.averageCost;

                if (item.currency === 'USD') {
                    totalValue *= usdRate;
                    costTry *= usdRate; // Assuming average cost is also in USD for USD assets
                }

                const profitLoss = totalValue - costTry;
                const profitLossPercent = costTry > 0 ? (profitLoss / costTry) * 100 : 0;

                return {
                    'Varlık Adı': item.customName || item.instrumentId,
                    'Sembol': item.instrumentId,
                    'Tür': item.type,
                    'Miktar': item.amount,
                    'Ortalama Maliyet': item.averageCost,
                    'Güncel Fiyat': currentPrice,
                    'Döviz': item.currency,
                    'Toplam Değer (TL)': parseFloat(totalValue.toFixed(2)),
                    'Kâr/Zarar (TL)': parseFloat(profitLoss.toFixed(2)),
                    'Kâr/Zarar (%)': parseFloat(profitLossPercent.toFixed(2)),
                };
            });

            // Create Worksheet
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Portföy Detay');

            // Generate File Content
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const fileName = `${portfolioName.replace(/\s/g, '_')}_Portfoy_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`;

            if (Platform.OS === 'web') {
                // Web download
                const buf = Buffer.from(wbout, 'base64');
                const blob = new Blob([buf], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                // Mobile save & share
                const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
                await FileSystem.writeAsStringAsync(fileUri, wbout, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, {
                        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        dialogTitle: 'Portföy Excelini Paylaş',
                        UTI: 'com.microsoft.excel.xlsx',
                    });
                }
            }
            return true;
        } catch (error) {
            console.error('Excel Export Error:', error);
            return false;
        }
    },
};
