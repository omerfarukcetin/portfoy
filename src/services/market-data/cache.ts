import { Instrument } from '../../types';

type CacheEntry = {
    data: Partial<Instrument>;
    timestamp: number;
};

const priceCache: Record<string, CacheEntry> = {};

export const DEFAULT_CACHE_TTL = 30 * 60 * 1000;
export const CRYPTO_CACHE_TTL = 30 * 60 * 1000;
export const TEFAS_CACHE_TTL = 60 * 60 * 1000;

export const getCachedOrFetch = async (
    cacheKey: string,
    fetchFn: () => Promise<Partial<Instrument> | null>,
    ttl: number = DEFAULT_CACHE_TTL
): Promise<Partial<Instrument> | null> => {
    const now = Date.now();
    const cached = priceCache[cacheKey];

    if (cached) {
        if (now - cached.timestamp < ttl) {
            return cached.data;
        }

        fetchFn().then(freshData => {
            if (freshData) {
                priceCache[cacheKey] = { data: freshData, timestamp: Date.now() };
            }
        }).catch(err => {
            console.warn(`Background refresh failed for ${cacheKey}:`, err.message);
        });

        return cached.data;
    }

    const data = await fetchFn();
    if (data) {
        priceCache[cacheKey] = { data, timestamp: now };
    }

    return data;
};
