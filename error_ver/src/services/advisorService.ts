import { PortfolioItem } from '../types';

export interface Recommendation {
    id: string;
    type: 'warning' | 'opportunity' | 'info' | 'success';
    icon: string;
    title: string;
    description: string;
    action?: string;
    priority: number; // 1 = highest
}

export interface PortfolioAnalysis {
    totalValue: number;
    cashRatio: number;
    topHolding: { name: string; percentage: number } | null;
    sectorConcentration: { sector: string; percentage: number }[];
    dailyChange: number;
    weeklyChange: number;
}

// Sector mapping for Turkish stocks
const getSector = (instrumentId: string): string => {
    const id = instrumentId.toUpperCase();

    // Banks
    if (['GARAN.IS', 'AKBNK.IS', 'ISCTR.IS', 'YKBNK.IS', 'VAKBN.IS', 'HALKB.IS', 'TSKB.IS'].includes(id)) {
        return 'Bankacılık';
    }
    // Airlines
    if (['THYAO.IS', 'PGSUS.IS'].includes(id)) {
        return 'Havacılık';
    }
    // Automotive
    if (['TOASO.IS', 'FROTO.IS', 'OTKAR.IS', 'DOAS.IS'].includes(id)) {
        return 'Otomotiv';
    }
    // Energy
    if (['TUPRS.IS', 'PETKM.IS', 'AKENR.IS'].includes(id)) {
        return 'Enerji';
    }
    // Telecom
    if (['TCELL.IS', 'TTKOM.IS'].includes(id)) {
        return 'Telekomünikasyon';
    }
    // Holding
    if (['SAHOL.IS', 'KCHOL.IS', 'TAVHL.IS', 'SISE.IS'].includes(id)) {
        return 'Holding';
    }
    // Retail
    if (['BIMAS.IS', 'MGROS.IS', 'SOKM.IS'].includes(id)) {
        return 'Perakende';
    }
    // Tech/Crypto
    if (id.includes('BTC') || id.includes('ETH') || id.includes('SOL')) {
        return 'Kripto';
    }
    // US ETF
    if (['SCHG', 'VOO', 'QQQ', 'SPY', 'VTI'].includes(id.replace('.IS', ''))) {
        return 'ABD ETF';
    }
    // Gold
    if (id.includes('GOLD') || id.includes('GRAM') || id.includes('ONS')) {
        return 'Altın';
    }

    return 'Diğer';
};

interface HistoryPoint {
    date: string;
    valueTry: number;
}

export const analyzePortfolio = (
    portfolio: PortfolioItem[],
    prices: Record<string, number>,
    cashBalance: number,
    usdRate: number,
    history: HistoryPoint[] = []
): PortfolioAnalysis => {
    let totalValue = cashBalance;
    const holdings: { name: string; value: number }[] = [];
    const sectorValues: Record<string, number> = {};

    portfolio.forEach(item => {
        const price = prices[item.instrumentId] || item.averageCost;
        let value = item.amount * price;

        // Convert USD to TRY
        if (item.currency === 'USD') {
            value *= usdRate;
        }

        totalValue += value;
        holdings.push({ name: item.instrumentId, value });

        // Sector analysis
        const sector = getSector(item.instrumentId);
        sectorValues[sector] = (sectorValues[sector] || 0) + value;
    });

    // Find top holding
    const topHolding = holdings.length > 0
        ? holdings.reduce((max, h) => h.value > max.value ? h : max, holdings[0])
        : null;

    // Calculate sector concentrations
    const sectorConcentration = Object.entries(sectorValues)
        .map(([sector, value]) => ({
            sector,
            percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
        }))
        .sort((a, b) => b.percentage - a.percentage);

    // Calculate Weekly Change
    let weeklyChange = 0;
    if (history && history.length >= 7) {
        // Find point ~7 days ago
        const weekAgo = history[history.length - 7];
        if (weekAgo && weekAgo.valueTry > 0) {
            weeklyChange = ((totalValue - weekAgo.valueTry) / weekAgo.valueTry) * 100;
        }
    }

    return {
        totalValue,
        cashRatio: totalValue > 0 ? (cashBalance / totalValue) * 100 : 0,
        topHolding: topHolding ? {
            name: topHolding.name,
            percentage: totalValue > 0 ? (topHolding.value / totalValue) * 100 : 0
        } : null,
        sectorConcentration,
        dailyChange: 0, // This is calculated per item usually, or passed in
        weeklyChange
    };
};

export const generateRecommendations = (
    portfolio: PortfolioItem[],
    prices: Record<string, number>,
    dailyChanges: Record<string, number>,
    cashBalance: number,
    usdRate: number,
    history: HistoryPoint[] = [], // New param
    cashThreshold: number = 20
): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    const analysis = analyzePortfolio(portfolio, prices, cashBalance, usdRate, history);

    // 0. Weekly Performance Insight
    if (analysis.weeklyChange < -3) {
        recommendations.push({
            id: 'weekly_drop',
            type: 'info',
            icon: '📉',
            title: 'Haftalık Düşüş',
            description: `Portföyünüz son 1 haftada %${Math.abs(analysis.weeklyChange).toFixed(1)} değer kaybetti. Piyasalar dalgalı olabilir.`,
            action: 'Panik satışından kaçının',
            priority: 2
        });
    } else if (analysis.weeklyChange > 3) {
        recommendations.push({
            id: 'weekly_gain',
            type: 'success',
            icon: '📈',
            title: 'Haftalık Yükseliş',
            description: `Portföyünüz son 1 haftada %${analysis.weeklyChange.toFixed(1)} değer kazandı.`,
            priority: 2
        });
    }

    // 1. Concentration Risk
    if (analysis.topHolding && analysis.topHolding.percentage > 30) {
        recommendations.push({
            id: 'concentration',
            type: 'warning',
            icon: '⚠️',
            title: 'Konsantrasyon Riski',
            description: `${analysis.topHolding.name} portföyünüzün %${analysis.topHolding.percentage.toFixed(0)}'ini oluşturuyor.`,
            action: 'Çeşitlendirme düşünebilirsiniz',
            priority: 1
        });
    }

    // 2. Single Sector Concentration
    if (analysis.sectorConcentration.length > 0 && analysis.sectorConcentration[0].percentage > 50) {
        recommendations.push({
            id: 'sector_concentration',
            type: 'warning',
            icon: '📊',
            title: 'Sektör Yoğunluğu',
            description: `Portföyünüzün %${analysis.sectorConcentration[0].percentage.toFixed(0)}'i ${analysis.sectorConcentration[0].sector} sektöründe.`,
            action: 'Farklı sektörlere yatırım düşünün',
            priority: 2
        });
    }

    // 3. High Cash Ratio (using user's risk appetite threshold)
    if (analysis.cashRatio > cashThreshold) {
        recommendations.push({
            id: 'high_cash',
            type: 'opportunity',
            icon: '💰',
            title: 'Yatırım Fırsatı',
            description: `Nakit oranınız %${analysis.cashRatio.toFixed(0)} (eşik: %${cashThreshold}). Yatırım fırsatlarını değerlendirebilirsiniz.`,
            action: 'Piyasaları inceleyin',
            priority: 3
        });
    }

    // 4. Sector Opportunities (sectors with big daily drops)
    const sectorDrops: Record<string, number[]> = {};
    portfolio.forEach(item => {
        const change = dailyChanges[item.instrumentId] || 0;
        const sector = getSector(item.instrumentId);
        if (!sectorDrops[sector]) sectorDrops[sector] = [];
        sectorDrops[sector].push(change);
    });

    Object.entries(sectorDrops).forEach(([sector, changes]) => {
        const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
        if (avgChange < -3 && sector !== 'Diğer') {
            recommendations.push({
                id: `sector_opp_${sector}`,
                type: 'opportunity',
                icon: '🎯',
                title: `${sector} Fırsatı`,
                description: `${sector} sektörü bugün ortalama %${Math.abs(avgChange).toFixed(1)} düştü.`,
                action: 'Sektöre yatırım fırsatı olabilir',
                priority: 3
            });
        }
    });

    // 4. Big Daily Drops - Buying Opportunity
    portfolio.forEach(item => {
        const change = dailyChanges[item.instrumentId] || 0;
        if (change < -5) {
            recommendations.push({
                id: `drop_${item.instrumentId}`,
                type: 'opportunity',
                icon: '📉',
                title: 'Alım Fırsatı',
                description: `${item.instrumentId} bugün %${Math.abs(change).toFixed(1)} düştü.`,
                action: 'Pozisyon artırma fırsatı olabilir',
                priority: 4
            });
        }
    });

    // 5. Big Daily Gains
    portfolio.forEach(item => {
        const change = dailyChanges[item.instrumentId] || 0;
        if (change > 5) {
            recommendations.push({
                id: `gain_${item.instrumentId}`,
                type: 'success',
                icon: '🚀',
                title: 'Güçlü Performans',
                description: `${item.instrumentId} bugün %${change.toFixed(1)} yükseldi!`,
                priority: 5
            });
        }
    });

    // 6. No Crypto Warning (for diversification)
    const hasCrypto = portfolio.some(item =>
        ['BTC', 'ETH', 'SOL', 'AVAX'].some(c => item.instrumentId.toUpperCase().includes(c))
    );
    if (!hasCrypto && portfolio.length >= 5) {
        recommendations.push({
            id: 'no_crypto',
            type: 'info',
            icon: '₿',
            title: 'Kripto Çeşitlendirmesi',
            description: 'Portföyünüzde kripto para bulunmuyor.',
            action: 'Bitcoin veya Ethereum küçük bir pozisyon düşünebilirsiniz',
            priority: 6
        });
    }

    // 7. Portfolio Performance Summary
    if (portfolio.length > 0) {
        const totalDailyChange = portfolio.reduce((sum, item) => {
            const change = dailyChanges[item.instrumentId] || 0;
            const price = prices[item.instrumentId] || item.averageCost;
            let value = item.amount * price;
            if (item.currency === 'USD') value *= usdRate;
            return sum + (value * change / 100);
        }, 0);

        if (totalDailyChange > 0) {
            recommendations.push({
                id: 'daily_summary',
                type: 'success',
                icon: '📈',
                title: 'Bugünün Özeti',
                description: `Portföyünüz bugün ₺${totalDailyChange.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} kazandı!`,
                priority: 0
            });
        } else if (totalDailyChange < 0) {
            recommendations.push({
                id: 'daily_summary',
                type: 'info',
                icon: '📉',
                title: 'Bugünün Özeti',
                description: `Portföyünüz bugün ₺${Math.abs(totalDailyChange).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} kaybetti.`,
                action: 'Uzun vadeli düşünün, panik satışından kaçının',
                priority: 0
            });
        }
    }

    // Sort by priority
    return recommendations.sort((a, b) => a.priority - b.priority);
};

/**
 * Generate AI-powered insight for a specific asset
 */
export interface AssetInsight {
    icon: string;
    type: 'success' | 'warning' | 'info' | 'danger';
    title: string;
    message: string;
}

export const generateAssetInsight = (
    currentPrice: number,
    averageCost: number,
    change24h: number,
    amount: number
): AssetInsight => {
    const profitLoss = (currentPrice - averageCost) * amount;
    const profitPercent = ((currentPrice - averageCost) / averageCost) * 100;

    // Rule 1: Strong Profit Position (>50%)
    if (profitPercent > 50) {
        return {
            icon: '🎯',
            type: 'success',
            title: 'Güçlü Kâr Pozisyonu',
            message: `Ortalamanız (${averageCost.toFixed(2)}) güncel fiyatın %${Math.abs(profitPercent).toFixed(1)} altında. Kâr realizasyonu için ideal pozisyondasınız.`
        };
    }

    // Rule 2: Moderate Profit (20-50%)
    if (profitPercent > 20 && profitPercent <= 50) {
        return {
            icon: '✅',
            type: 'success',
            title: 'Kârlı Pozisyon',
            message: `%${profitPercent.toFixed(1)} kâr marjındasınız. Pozisyonunuzu koruyabilir veya kısmi kâr realizasyonu yapabilirsiniz.`
        };
    }

    // Rule 3: Small Profit (0-20%)
    if (profitPercent > 0 && profitPercent <= 20) {
        return {
            icon: '📊',
            type: 'info',
            title: 'Dengeli Pozisyon',
            message: `Ortalamanıza yakın seyrediyor (%${profitPercent.toFixed(1)} kâr). Sabırlı olun, uzun vadeli düşünün.`
        };
    }

    // Rule 4: Small Loss (0 to -10%)
    if (profitPercent < 0 && profitPercent >= -10) {
        return {
            icon: '⚠️',
            type: 'warning',
            title: 'Hafif Zarar Bölgesi',
            message: `Ortalamanızın %${Math.abs(profitPercent).toFixed(1)} altında. Ortalama düşürmek için ek alım fırsatı olabilir.`
        };
    }

    // Rule 5: Moderate Loss (-10% to -25%)
    if (profitPercent < -10 && profitPercent >= -25) {
        return {
            icon: '🔴',
            type: 'danger',
            title: 'Dikkat: Zarar Pozisyonu',
            message: `%${Math.abs(profitPercent).toFixed(1)} zarar var. Temel analizi gözden geçirin, panik satışından kaçının.`
        };
    }

    // Rule 6: Heavy Loss (<-25%)
    if (profitPercent < -25) {
        return {
            icon: '🚨',
            type: 'danger',
            title: 'Yüksek Zarar',
            message: `%${Math.abs(profitPercent).toFixed(1)} zarar. Stop-loss stratejinizi gözden geçirmeniz önerilir.`
        };
    }

    // Rule 7: High Volatility (>5% daily change)
    if (Math.abs(change24h) > 5) {
        const direction = change24h > 0 ? 'yükseldi' : 'düştü';
        return {
            icon: '🔥',
            type: 'warning',
            title: 'Yüksek Volatilite',
            message: `Son 24 saatte %${Math.abs(change24h).toFixed(1)} ${direction}. Dikkatli olun, ani fiyat hareketleri var.`
        };
    }

    // Default: Neutral
    return {
        icon: '💡',
        type: 'info',
        title: 'Stabil Pozisyon',
        message: 'Varlığınız dengeli seyrediyor. Uzun vadeli stratejinize sadık kalın.'
    };
};
