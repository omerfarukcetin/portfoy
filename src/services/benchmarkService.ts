import { CashItem } from '../types';
import { MarketDataService } from './marketData';

type PortfolioHistoryPoint = {
    date: string;
    valueTry: number;
    valueUsd: number;
};

type RawSeriesPoint = {
    date: string;
    value: number;
};

export type ComparisonPeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

export type BenchmarkSeries = {
    code: string;
    label: string;
    color: string;
    values: number[];
    latestReturn: number;
};

export type BenchmarkComparisonResult = {
    dates: string[];
    portfolio: BenchmarkSeries;
    benchmarks: BenchmarkSeries[];
    depositAnnualRate: number;
};

const DEFAULT_DEPOSIT_RATE = 45;

type BenchmarkDefinition = {
    code: string;
    label: string;
    color: string;
    symbol: string;
};

const BENCHMARKS: BenchmarkDefinition[] = [
    { code: 'BIST100', label: 'BIST 100', color: '#FF9500', symbol: 'XU100.IS' },
    { code: 'USDTRY', label: 'Dolar/TL', color: '#34C759', symbol: 'TRY=X' },
    { code: 'EURTRY', label: 'Euro/TL', color: '#0A84FF', symbol: 'EURTRY=X' },
    { code: 'GOLD', label: 'Gram Altın', color: '#FFD60A', symbol: 'GOLD_GRAM_TL' },
];

const getPeriodDays = (period: ComparisonPeriod) => {
    switch (period) {
        case '1D': return 2;
        case '1W': return 7;
        case '1M': return 30;
        case '3M': return 90;
        case '6M': return 180;
        case '1Y': return 365;
        default: return 30;
    }
};

const getFetchRange = (period: ComparisonPeriod): '5d' | '1mo' | '3mo' | '6mo' | '1y' => {
    switch (period) {
        case '1D': return '5d';
        case '1W': return '1mo';
        case '1M': return '1mo';
        case '3M': return '3mo';
        case '6M': return '6mo';
        case '1Y': return '1y';
        default: return '1mo';
    }
};

const clampPortfolioHistory = (history: PortfolioHistoryPoint[], period: ComparisonPeriod): PortfolioHistoryPoint[] => {
    if (!history || history.length === 0) {
        return [];
    }

    const days = getPeriodDays(period);
    const sliced = history.slice(-days);

    if (period === '1D' && sliced.length < 2 && history.length >= 2) {
        return history.slice(-2);
    }

    return sliced.length >= 2 ? sliced : history.slice(-Math.min(history.length, 2));
};

const normalizeToPercent = (series: RawSeriesPoint[]): number[] => {
    if (!series.length || !series[0].value) {
        return [];
    }

    const startValue = series[0].value;
    return series.map(point => ((point.value - startValue) / startValue) * 100);
};

const alignSeriesToDates = (series: RawSeriesPoint[], targetDates: string[]): RawSeriesPoint[] => {
    if (!series.length || !targetDates.length) {
        return [];
    }

    const sortedSeries = [...series].sort((a, b) => a.date.localeCompare(b.date));
    let cursor = 0;
    let lastKnown = sortedSeries[0];

    return targetDates.map(date => {
        while (cursor < sortedSeries.length && sortedSeries[cursor].date <= date) {
            lastKnown = sortedSeries[cursor];
            cursor += 1;
        }

        return {
            date,
            value: lastKnown.value,
        };
    });
};

const getDepositAnnualRate = (cashItems: CashItem[] = []) => {
    const deposits = cashItems.filter(item => item.type === 'deposit' && item.interestRate && item.interestRate > 0);
    if (deposits.length === 0) {
        return DEFAULT_DEPOSIT_RATE;
    }

    const totalAmount = deposits.reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
    if (totalAmount <= 0) {
        return deposits[0].interestRate || DEFAULT_DEPOSIT_RATE;
    }

    const weightedRate = deposits.reduce((sum, item) => sum + ((item.interestRate || 0) * item.amount), 0) / totalAmount;
    return weightedRate > 0 ? weightedRate : DEFAULT_DEPOSIT_RATE;
};

const buildDepositSeries = (dates: string[], annualRate: number): RawSeriesPoint[] => {
    if (!dates.length) {
        return [];
    }

    const dailyMultiplier = Math.pow(1 + annualRate / 100, 1 / 365);
    const start = new Date(dates[0]).getTime();

    return dates.map(date => {
        const diffDays = Math.max(0, Math.round((new Date(date).getTime() - start) / 86400000));
        return {
            date,
            value: 100 * Math.pow(dailyMultiplier, diffDays)
        };
    });
};

export const BenchmarkService = {
    getComparisonData: async (
        history: PortfolioHistoryPoint[],
        cashItems: CashItem[],
        period: ComparisonPeriod
    ): Promise<BenchmarkComparisonResult | null> => {
        const portfolioHistory = clampPortfolioHistory(history, period);

        if (portfolioHistory.length < 2) {
            return null;
        }

        const dates = portfolioHistory.map(point => point.date);
        const fetchRange = getFetchRange(period);
        const depositAnnualRate = getDepositAnnualRate(cashItems);

        const rawBenchmarks = await Promise.all(
            BENCHMARKS.map(async benchmark => {
                try {
                    const historyData = await MarketDataService.getBenchmarkHistory(benchmark.symbol, fetchRange);
                    const alignedSeries = alignSeriesToDates(historyData, dates);
                    return {
                        ...benchmark,
                        values: normalizeToPercent(alignedSeries),
                    };
                } catch (error) {
                    console.error(`Benchmark fetch failed for ${benchmark.code}:`, error);
                    return {
                        ...benchmark,
                        values: [],
                    };
                }
            })
        );

        const portfolioSeries = normalizeToPercent(
            portfolioHistory.map(point => ({
                date: point.date,
                value: point.valueTry
            }))
        );

        const fallbackLength = portfolioSeries.length;
        const benchmarks = rawBenchmarks.map(benchmark => {
            const values = benchmark.values.length === fallbackLength
                ? benchmark.values
                : new Array(fallbackLength).fill(0);

            return {
                code: benchmark.code,
                label: benchmark.label,
                color: benchmark.color,
                values,
                latestReturn: values[values.length - 1] || 0,
            };
        });

        const depositValues = normalizeToPercent(buildDepositSeries(dates, depositAnnualRate));
        benchmarks.push({
            code: 'DEPOSIT',
            label: 'TL Mevduat',
            color: '#AF52DE',
            values: depositValues,
            latestReturn: depositValues[depositValues.length - 1] || 0,
        });

        return {
            dates,
            depositAnnualRate,
            portfolio: {
                code: 'PORTFOLIO',
                label: 'Portföyüm',
                color: '#007AFF',
                values: portfolioSeries,
                latestReturn: portfolioSeries[portfolioSeries.length - 1] || 0,
            },
            benchmarks,
        };
    }
};
