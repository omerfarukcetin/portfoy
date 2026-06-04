import { Instrument } from '../../types';
import tefasDataRaw from '../../data/tefas_data.json';
import { supabase } from '../supabaseClient';

type TefasFund = {
    code: string;
    price: number;
    date: string;
    dailyChange?: number;
    daily_change?: number;
    name?: string;
};

export type TefasSnapshot = {
    lastUpdated: string;
    count: number;
    data: Record<string, TefasFund>;
};

const GITHUB_TEFAS_URL = 'https://raw.githubusercontent.com/omerfarukcetin/portfoy/main/src/data/tefas_data.json';

export const localTefasData = tefasDataRaw as TefasSnapshot;

let tefasDataCache: TefasSnapshot | null = null;

export const fetchTefasSnapshot = async (): Promise<TefasSnapshot | null> => {
    if (tefasDataCache) {
        return tefasDataCache;
    }

    try {
        console.log('🔍 Fetching TEFAS data from GitHub...');
        const response = await fetch(GITHUB_TEFAS_URL, {
            cache: 'no-cache',
            headers: { Accept: 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.data && Object.keys(data.data).length > 0) {
                tefasDataCache = {
                    lastUpdated: data.lastUpdated || new Date().toISOString(),
                    count: data.count || Object.keys(data.data).length,
                    data: data.data
                };
                console.log(`✅ GitHub TEFAS Data Loaded: ${tefasDataCache.count} funds (${data.lastUpdated})`);
                return tefasDataCache;
            }
        }
    } catch (error) {
        console.warn('⚠️ GitHub TEFAS fetch failed, trying Supabase...', error);
    }

    try {
        const { data, error } = await supabase
            .from('tefas_funds')
            .select('*');

        if (!error && data && data.length > 0) {
            const fundRecord: Record<string, TefasFund> = {};
            data.forEach((fund: any) => {
                fundRecord[fund.code] = {
                    code: fund.code,
                    price: Number(fund.price),
                    date: fund.date,
                    dailyChange: fund.daily_change || 0,
                    name: fund.name || ''
                };
            });

            tefasDataCache = {
                lastUpdated: new Date().toISOString(),
                count: data.length,
                data: fundRecord
            };
            console.log(`🔷 Supabase TEFAS Data Loaded: ${data.length} funds`);
            return tefasDataCache;
        }
    } catch (error) {
        console.warn('⚠️ Supabase TEFAS fetch failed, using local data...', error);
    }

    console.log('📦 Using local TEFAS data file');
    return null;
};

export const searchLocalTefasFunds = (query: string, limit: number = 50): Instrument[] => {
    const searchQuery = query.toLowerCase().trim();
    const results: Instrument[] = [];

    for (const [code, fund] of Object.entries(localTefasData.data) as [string, TefasFund][]) {
        const fundName = fund.name || code;
        if (code.toLowerCase().includes(searchQuery) || fundName.toLowerCase().includes(searchQuery)) {
            results.push({
                id: code,
                symbol: code,
                name: fundName,
                type: 'fund',
                currency: 'TRY',
                currentPrice: fund.price || 0,
                dailyChange: fund.dailyChange || fund.daily_change || 0,
                lastUpdated: Date.now()
            });
        }

        if (results.length >= limit) {
            break;
        }
    }

    return results;
};

export const searchSnapshotTefasFunds = (snapshot: TefasSnapshot, query: string, limit: number = 50): Instrument[] => {
    const searchQuery = query.toLowerCase().trim();
    const results: Instrument[] = [];

    for (const [code, fund] of Object.entries(snapshot.data) as [string, TefasFund][]) {
        const fundName = fund.name || code;
        if (code.toLowerCase().includes(searchQuery) || fundName.toLowerCase().includes(searchQuery)) {
            results.push({
                id: code,
                symbol: code,
                name: fundName,
                type: 'fund',
                currency: 'TRY',
                currentPrice: fund.price || 0,
                dailyChange: fund.daily_change || fund.dailyChange || 0,
                lastUpdated: Date.now()
            });
        }

        if (results.length >= limit) {
            break;
        }
    }

    return results;
};
