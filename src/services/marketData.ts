import axios from 'axios';
import { Instrument, InstrumentType } from '../types';
import { Platform } from 'react-native';

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINCAP_BASE_URL = 'https://api.coincap.io/v2';
const CRYPTOCOMPARE_BASE_URL = 'https://min-api.cryptocompare.com/data';

// ID Mapping: CoinGecko ID -> Symbol for CryptoCompare
const CRYPTO_ID_TO_SYMBOL: { [key: string]: string } = {
    'bitcoin': 'BTC',
    'ethereum': 'ETH',
    'worldcoin-wld': 'WLD',
    'worldcoin': 'WLD',
    'tether': 'USDT',
    'binancecoin': 'BNB',
    'solana': 'SOL',
    'cardano': 'ADA',
    'ripple': 'XRP',
    'polkadot': 'DOT',
    'dogecoin': 'DOGE',
};

// Crypto ID mapping: CoinGecko ID -> CoinCap ID
const CRYPTO_ID_MAP: Record<string, string> = {
    'bitcoin': 'bitcoin',
    'ethereum': 'ethereum',
    'binancecoin': 'binance-coin',
    'cardano': 'cardano',
    'solana': 'solana',
    'ripple': 'xrp',
    'dogecoin': 'dogecoin',
    'polkadot': 'polkadot',
    'avalanche-2': 'avalanche',
    'chainlink': 'chainlink',
    'polygon': 'polygon',
    'uniswap': 'uniswap',
};

// Price cache to prevent rate limiting
const priceCache: { [key: string]: { data: Partial<Instrument>, timestamp: number } } = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes default
const CRYPTO_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for crypto (increased to avoid rate limits)
const TEFAS_CACHE_TTL = 60 * 60 * 1000; // 1 hour for TEFAS

// Yahoo Finance requires a User-Agent to avoid being blocked.
// In a browser/RN environment, this is usually handled automatically, but we might need to be careful.
// If direct calls fail in RN, we might need a proxy or a different library.
// For now, we'll try direct calls.

// Supabase Cloud Data
import { supabase } from './supabaseClient';

// Import local data (Back to imported for now)
import tefasDataRaw from '../data/tefas_data.json';
const tefasData = tefasDataRaw as { lastUpdated: string; count: number; data: Record<string, { code: string; price: number; date: string }> };

// GitHub raw URL for TEFAS data (updated via GitHub Actions)
const GITHUB_TEFAS_URL = 'https://raw.githubusercontent.com/omerfarukcetin/portfoy/main/src/data/tefas_data.json';

// In-Memory cache for TEFAS data
let tefasDataCache: {
    lastUpdated: string;
    count: number;
    data: Record<string, { code: string; price: number; date: string }>
} | null = null;

// Fetch full snapshot - Priority: GitHub > Supabase > Local file
const fetchTefasSnapshot = async () => {
    if (tefasDataCache) return tefasDataCache; // Return memory cache if available

    // 1. Try GitHub first (most up-to-date via GitHub Actions)
    try {
        console.log('🔍 Fetching TEFAS data from GitHub...');
        const response = await fetch(GITHUB_TEFAS_URL, {
            cache: 'no-cache',
            headers: { 'Accept': 'application/json' }
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

    // 2. Try Supabase
    try {
        const { data, error } = await supabase
            .from('tefas_funds')
            .select('*');

        if (!error && data && data.length > 0) {
            // Convert array to Record format
            const fundRecord: Record<string, { code: string; price: number; date: string }> = {};
            data.forEach((fund: any) => {
                fundRecord[fund.code] = {
                    code: fund.code,
                    price: Number(fund.price),
                    date: fund.date
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
        console.warn("⚠️ Supabase TEFAS fetch failed, using local data...", error);
    }

    // 3. Use local file as last resort
    console.log('📦 Using local TEFAS data file');
    return null; // Will fall back to tefasData import
};

const TEFAS_BASE_URL = 'https://www.tefas.gov.tr/api/DB';
let cookiesWarmedUp = false;

const fetchTefasData = async (endpoint: string, data: any) => {
    try {
        // Warm up cookies if needed (once per session)
        if (!cookiesWarmedUp) {
            try {
                await fetch('https://www.tefas.gov.tr/TarihselVeriler.aspx', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                    }
                });
                cookiesWarmedUp = true;
            } catch (e) {
                console.warn('TEFAS warmup failed:', e);
            }
        }

        // Convert data to URL params (Form Data)
        // TEFAS expects x-www-form-urlencoded
        const formData = new URLSearchParams();
        for (const key in data) {
            formData.append(key, data[key]);
        }

        const response = await fetch(`${TEFAS_BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Referer': 'https://www.tefas.gov.tr/TarihselVeriler.aspx',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
                // Cookie: Let OS handle it
            },
            body: formData.toString()
        });

        if (!response.ok) {
            console.error(`TEFAS Response Status: ${response.status}`);
            throw new Error(`TEFAS API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`TEFAS request failed for ${endpoint}:`, error);
        return null;
    }
};

const getCachedOrFetch = async (
    cacheKey: string,
    fetchFn: () => Promise<Partial<Instrument> | null>,
    ttl: number = CACHE_TTL
): Promise<Partial<Instrument> | null> => {
    const now = Date.now();
    const cached = priceCache[cacheKey];

    // Return stale cache immediately if available
    if (cached) {
        // If cache is still fresh, just return it
        if (now - cached.timestamp < ttl) {
            return cached.data;
        }

        // Cache is stale, but return it immediately and refresh in background
        fetchFn().then(freshData => {
            if (freshData) {
                priceCache[cacheKey] = { data: freshData, timestamp: Date.now() };
            }
        }).catch(err => {
            console.warn(`Background refresh failed for ${cacheKey}:`, err.message);
        });

        return cached.data;
    }

    // No cache, fetch now
    const data = await fetchFn();
    if (data) {
        priceCache[cacheKey] = { data, timestamp: now };
    }
    return data;
};

export const MarketDataService = {
    /**
     * Fetch prices for multiple instruments in parallel
     * @param instruments Array of portfolio items to fetch prices for
     * @returns Object mapping instrumentId to price data
     */
    fetchMultiplePrices: async (instruments: any[]): Promise<Record<string, Partial<Instrument>>> => {
        const results: Record<string, Partial<Instrument>> = {};

        // Batch instruments into groups to avoid rate limiting (max 10 parallel)
        const batchSize = 10;
        const batches: any[][] = [];
        for (let i = 0; i < instruments.length; i += batchSize) {
            batches.push(instruments.slice(i, i + batchSize));
        }

        // Process each batch
        for (const batch of batches) {
            const promises = batch.map(async (item) => {
                const id = item.instrumentId.toUpperCase();
                let priceData: Partial<Instrument> | null = null;

                try {
                    // Skip custom assets - they have manual prices
                    if (item.customCurrentPrice || item.instrumentId.startsWith('custom_')) {
                        priceData = {
                            symbol: item.instrumentId,
                            name: item.customName || item.instrumentId,
                            currentPrice: item.customCurrentPrice || item.averageCost,
                            currency: 'TRY',
                            lastUpdated: Date.now()
                        };
                    }
                    // Crypto - check by instrumentId or type
                    else if (item.type === 'crypto' || CRYPTO_ID_TO_SYMBOL[item.instrumentId]) {
                        priceData = await MarketDataService.getCryptoPrice(item.instrumentId.toLowerCase());
                    }
                    // Gold types
                    else if (id.includes('GOLD_') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) {
                        const subtypeMap: Record<string, any> = {
                            'GOLD_GRAM': 'gram', 'GRAM': 'gram',
                            'GOLD_GRAM_22': 'gram22', 'GRAM22': 'gram22',
                            'GOLD_QUARTER': 'quarter', 'CEYREK': 'quarter',
                            'GOLD_HALF': 'half', 'YARIM': 'half',
                            'GOLD_FULL': 'full', 'TAM': 'full',
                            'GOLD_ONS': 'ons', 'ONS': 'ons'
                        };
                        const subtype = subtypeMap[id];
                        if (subtype) {
                            priceData = await MarketDataService.getGoldPrice(subtype);
                        }
                    }
                    // Silver types
                    else if (id.includes('SILVER_') || id.includes('GUMUS_')) {
                        const subtype = id.includes('ONS') ? 'ons' : 'gram';
                        priceData = await MarketDataService.getSilverPrice(subtype);
                    }
                    // TEFAS Funds
                    else if (item.type === 'fund') {
                        priceData = await MarketDataService.getTefasPrice(item.instrumentId);
                    }
                    // BES (Individual Pension) - Fixed Price
                    else if (item.type === 'bes') {
                        priceData = {
                            symbol: 'BES',
                            name: 'Bireysel Emeklilik',
                            currentPrice: 1.0, // Unit price is 1
                            currency: 'TRY',
                            lastUpdated: Date.now()
                        };
                    }
                    // Forex / Döviz - Map common symbols to Yahoo codes
                    else if (item.type === 'forex' || ['USD', 'EUR', 'GBP', 'RUB', 'CHF', 'CAD', 'AUD', 'JPY'].includes(id)) {
                        const yahooSymbol = id === 'USD' ? 'TRY=X' : `${id}TRY=X`;
                        priceData = await MarketDataService.getYahooPrice(yahooSymbol);
                        if (priceData) {
                            priceData.name = id === 'USD' ? 'Amerikan Doları' : id;
                            priceData.symbol = id;
                            priceData.type = 'forex';
                        }
                    }
                    // Stocks and others
                    else {
                        priceData = await MarketDataService.getYahooPrice(item.instrumentId);
                        // Fallback to crypto if Yahoo fails (only if not already crypto, BES, or Fund)
                        if (!priceData || !priceData.currentPrice) {
                            if (!CRYPTO_ID_TO_SYMBOL[item.instrumentId] &&
                                item.type !== 'crypto' &&
                                item.type !== 'bes' &&
                                item.type !== 'fund') {
                                // console.log(`🔍 Trying crypto for: ${item.symbol} (ID: ${item.instrumentId})`);
                                const cryptoData = await MarketDataService.getCryptoPrice(item.instrumentId.toLowerCase());
                                if (cryptoData && cryptoData.currentPrice) {
                                    priceData = cryptoData;
                                }
                            }
                        }
                    }

                    if (priceData && priceData.currentPrice) {
                        results[item.instrumentId] = priceData;
                    }
                } catch (error) {
                    console.error(`Error fetching price for ${item.instrumentId}:`, error);
                }
            });

            // Wait for current batch to complete before starting next
            await Promise.all(promises);
        }

        return results;
    },

    /**
     * Preload common market data (USD, Gold, Silver, BIST, BTC, ETH)
     * This can be called on app startup to populate cache
     */
    preloadMarketData: async (): Promise<void> => {
        try {
            await Promise.all([
                MarketDataService.getYahooPrice('TRY=X'),
                MarketDataService.getGoldPrice('gram'),
                MarketDataService.getSilverPrice('gram'),
                MarketDataService.getYahooPrice('XU100.IS'),
                MarketDataService.getCryptoPrice('bitcoin'),
                MarketDataService.getCryptoPrice('ethereum'),
            ]);
        } catch (error) {
            console.warn('Preload market data failed:', error);
        }
    },

    /**
     * Fetch price for a stock, forex, or gold using Yahoo Finance
     * @param symbol Yahoo Finance symbol (e.g., THYAO.IS, TRY=X)
     */
    getYahooPrice: async (symbol: string): Promise<Partial<Instrument> | null> => {
        try {
            // Detect web platform for CORS proxy
            const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';

            let url = `${YAHOO_BASE_URL}/${symbol}?interval=1d&range=1d`;

            // Use CORS proxy for web - try multiple proxies
            if (isWeb) {
                // Try cors.eu.org first
                url = `https://cors.eu.org/${url}`;
            }

            const response = await fetch(url, {
                headers: isWeb ? {} : {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                }
            });

            if (!response.ok) {
                console.error(`Yahoo Finance Error for ${symbol}: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            const result = data.chart.result[0];

            if (!result) return null;

            const meta = result.meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose;
            const change = ((price - prevClose) / prevClose) * 100;

            return {
                currentPrice: price,
                currency: meta.currency,
                lastUpdated: Date.now(),
                change24h: change,
            };
        } catch (error) {
            console.error(`Error fetching Yahoo Finance data for ${symbol}:`, error);
            return null;
        }
    },

    /**
     * Fetch price for crypto using CryptoCompare API (primary) with CoinGecko fallback
     * @param id CoinGecko coin id (e.g., bitcoin, ethereum, worldcoin-wld)
     */
    getCryptoPrice: async (id: string): Promise<Partial<Instrument> | null> => {
        const cacheKey = `CRYPTO_${id.toUpperCase()}`;

        return getCachedOrFetch(cacheKey, async () => {
            // Convert CoinGecko ID to symbol for CryptoCompare
            const symbol = CRYPTO_ID_TO_SYMBOL[id] || id.toUpperCase();

            // Try CryptoCompare first
            try {
                const response = await axios.get(`${CRYPTOCOMPARE_BASE_URL}/pricemultifull`, {
                    params: {
                        fsyms: symbol,
                        tsyms: 'USD'
                    }
                });

                const data = response.data?.RAW?.[symbol]?.USD;
                if (!data) throw new Error('No data from CryptoCompare');

                const currentPrice = data.PRICE;
                const change24h = data.CHANGEPCT24HOUR;

                console.log(`✅ CryptoCompare: ${symbol} (${id}) = $${currentPrice.toFixed(4)}`);

                return {
                    currentPrice,
                    currency: 'USD',
                    lastUpdated: Date.now(),
                    change24h,
                };
            } catch (cryptoCompareError) {
                console.warn(`CryptoCompare failed for ${symbol}, trying CoinGecko fallback...`);

                // Fallback to CoinGecko
                try {
                    const response = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, {
                        params: {
                            ids: id,
                            vs_currencies: 'usd',
                            include_24hr_change: true,
                        },
                    });

                    const data = response.data[id];
                    if (!data) throw new Error('No data from CoinGecko');

                    console.log(`✅ CoinGecko fallback: ${id} = $${data.usd}`);

                    return {
                        currentPrice: data.usd,
                        currency: 'USD',
                        lastUpdated: Date.now(),
                        change24h: data.usd_24h_change || 0,
                    };
                } catch (coinGeckoError: any) {
                    if (coinGeckoError.response?.status === 429) {
                        console.error(`❌ Both CryptoCompare and CoinGecko failed for ${id} (rate limit)`);
                    } else {
                        console.error(`❌ Both APIs failed for ${id}:`, coinGeckoError.message);
                    }
                    return null;
                }
            }
        }, CRYPTO_CACHE_TTL);
    },

    /**
     * Search for cryptocurrencies using CoinGecko API
     * @param query Search query (e.g., "bitcoin", "ethereum")
     * @returns Array of matching cryptocurrencies with id, name, symbol, and logo
     */
    searchCrypto: async (query: string): Promise<Array<{
        id: string;
        name: string;
        symbol: string;
        thumb: string;
        large: string;
    }>> => {
        if (!query || query.trim().length < 2) {
            return [];
        }

        try {
            const response = await axios.get(`${COINGECKO_BASE_URL}/search`, {
                params: { query: query.trim() }
            });

            if (response.data && response.data.coins) {
                // Normalize IDs (CoinGecko sometimes returns variations)
                const normalizedCoins = response.data.coins.map((coin: any) => {
                    let normalizedId = coin.id;

                    // IMPORTANT: worldcoin-wld is the CORRECT ID for Worldcoin (WLD)
                    // Don't normalize it!
                    // 'worldcoin' (without -wld) is a different, old coin

                    return {
                        ...coin,
                        id: normalizedId
                    };
                });

                // Return top 10 results
                return normalizedCoins.slice(0, 10);
            }

            return [];
        } catch (error) {
            console.error('Error searching crypto:', error);
            return [];
        }
    },

    /**
     * Get price for specific gold types based on XAU/TRY or XAU/USD
     */
    getGoldPrice: async (subtype: 'gram' | 'gram22' | 'quarter' | 'half' | 'full' | 'ons'): Promise<Partial<Instrument> | null> => {
        // Fetch XAU/USD and USD/TRY to calculate Gram Gold in TRY
        // Formula: (XAU/USD * USD/TRY) / 31.1035 = Gram Gold TRY
        try {
            let xauUsd = await MarketDataService.getYahooPrice('GC=F'); // Gold Futures

            // Fallback to Spot Gold if Futures fail
            if (!xauUsd) {
                console.log('Gold Futures failed, trying Spot Gold (XAU=X)...');
                xauUsd = await MarketDataService.getYahooPrice('XAU=X');
            }

            const usdTry = await MarketDataService.getYahooPrice('TRY=X');

            if (!xauUsd?.currentPrice || !usdTry?.currentPrice) return null;

            const gramTry = (xauUsd.currentPrice * usdTry.currentPrice) / 31.1035;
            let price = 0;
            let name = '';

            switch (subtype) {
                case 'gram':
                    price = gramTry;
                    name = 'Gram Altın';
                    break;
                case 'gram22':
                    price = gramTry * 0.916; // 22 Ayar (0.916 saflık)
                    name = '22 Ayar Gram Altın';
                    break;
                case 'quarter':
                    price = gramTry * 1.605; // Approx multiplier for Quarter
                    name = 'Çeyrek Altın';
                    break;
                case 'half':
                    price = gramTry * 3.21;
                    name = 'Yarım Altın';
                    break;
                case 'full':
                    price = gramTry * 6.42;
                    name = 'Tam Altın';
                    break;
                case 'ons':
                    price = xauUsd.currentPrice;
                    name = 'Ons Altın';
                    return {
                        currentPrice: price,
                        currency: 'USD',
                        lastUpdated: Date.now(),
                        change24h: xauUsd.change24h
                    };
            }

            return {
                currentPrice: price,
                currency: 'TRY',
                lastUpdated: Date.now(),
                change24h: xauUsd.change24h // Approx change
            };

        } catch (e) {
            console.error('Error fetching gold price', e);
            return null;
        }
    },

    getSilverPrice: async (subtype: 'gram' | 'ons'): Promise<Partial<Instrument> | null> => {
        try {
            let xagUsd = await MarketDataService.getYahooPrice('SI=F'); // Silver Futures

            // Fallback to Spot Silver if Futures fail
            if (!xagUsd) {
                console.log('Silver Futures failed, trying Spot Silver (XAG=X)...');
                xagUsd = await MarketDataService.getYahooPrice('XAG=X');
            }

            const usdTry = await MarketDataService.getYahooPrice('TRY=X');

            if (!xagUsd?.currentPrice || !usdTry?.currentPrice) return null;

            if (subtype === 'ons') {
                return {
                    currentPrice: xagUsd.currentPrice,
                    currency: 'USD',
                    lastUpdated: Date.now(),
                    change24h: xagUsd.change24h
                };
            }

            // Gram Silver
            const gramTry = (xagUsd.currentPrice * usdTry.currentPrice) / 31.1035;
            return {
                currentPrice: gramTry,
                currency: 'TRY',
                lastUpdated: Date.now(),
                change24h: xagUsd.change24h
            };
        } catch (e) {
            console.error('Error fetching silver price', e);
            return null;
        }
    },

    /**
     * Fetch TEFAS Fund Price with improved error handling and caching
     * Uses RapidAPI TEFAS endpoint
     */
    getTefasPrice: async (code: string): Promise<Partial<Instrument> | null> => {
        const upperCode = code.toUpperCase();

        // 1. Try Firebase Cloud Data first (Fast & Automated)
        const cloudData = await fetchTefasSnapshot();

        if (cloudData && cloudData.data && cloudData.data[upperCode]) {
            const fund = cloudData.data[upperCode];
            return {
                symbol: upperCode,
                name: upperCode,
                currentPrice: Number(fund.price),
                change24h: 0,
                lastUpdated: new Date(fund.date).getTime()
            };
        }

        // 2. Fallback to Local JSON (Backup if Cloud fails)
        if (tefasData && tefasData.data && tefasData.data[upperCode]) {
            const fund = tefasData.data[upperCode];
            // console.log(`✅ Using local TEFAS data for ${upperCode}`);
            return {
                symbol: upperCode,
                name: upperCode,
                currentPrice: Number(fund.price),
                change24h: 0,
                lastUpdated: new Date(fund.date).getTime()
            };
        }

        // 3. Fallback to Direct API (Slow, but covers non-indexed funds)
        const cacheKey = `TEFAS_${upperCode}`;

        return getCachedOrFetch(cacheKey, async () => {
            try {
                // Fetch last 30 days to ensure we get the latest price (sometimes funds don't update for a few days)
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - 30);

                // Format dates as YYYY-MM-DD
                const formatDate = (date: Date) => date.toISOString().split('T')[0];

                const data = await fetchTefasData('BindHistoryInfo', {
                    fontip: "ALL",
                    bastarih: formatDate(startDate),
                    bittarih: formatDate(endDate),
                    fonkod: upperCode
                });

                if (data && data.data && data.data.length > 0) {
                    const sorted = data.data.sort((a: any, b: any) => new Date(b.TARIH).getTime() - new Date(a.TARIH).getTime());
                    const currentPrice = sorted[0].FIYAT;

                    // Calculate 24h change if possible
                    let change24h = 0;
                    if (sorted.length >= 2) {
                        const prevPrice = sorted[1].FIYAT;
                        if (prevPrice > 0) {
                            change24h = ((currentPrice - prevPrice) / prevPrice) * 100;
                        }
                    }

                    // console.log(`✅ TEFAS (Direct): ${code} = ₺${currentPrice}`);

                    return {
                        symbol: upperCode,
                        name: sorted[0].FONUNVAN,
                        currentPrice: currentPrice,
                        currency: 'TRY',
                        lastUpdated: new Date(sorted[0].TARIH).getTime(),
                        change24h: change24h
                    };
                }

                console.warn(`⚠️ TEFAS: No data found for ${code}`);
                return null;
            } catch (error: any) {
                console.error(`❌ TEFAS error for ${code}:`, error.message);
                return null;
            }
        }, TEFAS_CACHE_TTL);
    },

    getHistoricalPrice: async (symbol: string, date: number): Promise<number> => {
        // Skip for BES and Funds (User request: No historical data needed)
        // Check if it's BES
        if (symbol === 'BES' || symbol.startsWith('BES_')) return 0;

        // Check if it is a TEFAS Fund
        const upperCode = symbol.toUpperCase();
        if (tefasData && tefasData.data && tefasData.data[upperCode]) {
            // It is a fund, don't use Yahoo
            return 0;
        }

        // Yahoo Finance Chart API can give historical data
        // https://query1.finance.yahoo.com/v8/finance/chart/SYMBOL?period1=TIMESTAMP&period2=TIMESTAMP&interval=1d
        try {
            const period1 = Math.floor(date / 1000);
            const period2 = period1 + 86400; // +1 day
            // Note: Yahoo symbol might need adjustment (e.g. .IS)
            const response = await axios.get(`${YAHOO_BASE_URL}/${symbol}?period1=${period1}&period2=${period2}&interval=1d`);

            if (response.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.[0]) {
                return response.data.chart.result[0].indicators.quote[0].close[0];
            }

            return 0;
        } catch (error) {
            // Silently fail for historical price - not critical
            return 0;
        }
    },

    /**
     * Get historical USD/TRY rate for a specific date
     * @param date Timestamp in milliseconds
     */
    getHistoricalRate: async (date: number): Promise<number | null> => {
        try {
            // Convert to seconds for Yahoo API
            // Yahoo expects period1 and period2 in seconds.
            // We want the close price of that specific day.
            // If we ask for period1=startOfDay and period2=endOfDay, we should get it.

            // Adjust date to be 12:00 PM to avoid timezone issues with start of day
            const d = new Date(date);
            d.setHours(12, 0, 0, 0);
            const timestamp = Math.floor(d.getTime() / 1000);

            const period1 = timestamp - 86400; // -1 day buffer
            const period2 = timestamp + 86400; // +1 day buffer

            // Use CORS proxy on web (similar to getYahooPrice)
            const isWeb = Platform.OS === 'web';
            let url = `${YAHOO_BASE_URL}/TRY=X?period1=${period1}&period2=${period2}&interval=1d&events=history`;

            if (isWeb) {
                url = `https://cors.eu.org/${url}`;
            }

            const response = await fetch(url, {
                headers: isWeb ? {} : {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                }
            });

            if (!response.ok) {
                console.error(`Historical rate fetch error: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            const result = data.chart.result[0];
            if (result && result.indicators.quote[0].close) {
                const timestamps = result.timestamp;
                const closes = result.indicators.quote[0].close;

                // Find the close price closest to our target date
                // We want the price for 'date'.
                // Yahoo returns timestamps for market close.

                // Simple approach: Take the first non-null value found in the range
                const rate = closes.find((c: number) => c != null && c > 0);
                console.log('✅ Historical USD/TRY rate fetched:', rate);
                return rate || null;
            }
            return null;
        } catch (error) {
            console.error('Error fetching historical rate:', error);
            return null;
        }
    },

    /**
     * Get Top Performing TEFAS Funds (Daily)
     */
    getTopPerformingFunds: async (): Promise<any[]> => {
        try {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const formatDate = (date: Date) => date.toISOString().split('T')[0];

            const data = await fetchTefasData('BindComparisonFundReturns', {
                calismatipi: 2,
                fontip: "YAT",
                siralama: 1,
                bastarih: formatDate(yesterday),
                bittarih: formatDate(today),
                kurucukod: ""
            });

            if (data && data.data && data.data.length > 0) {
                // Sort by daily return (GUNLUKGETIRI) descending
                const funds = data.data.sort((a: any, b: any) => b.GUNLUKGETIRI - a.GUNLUKGETIRI);

                // Take top 5
                return funds.slice(0, 5).map((f: any) => ({
                    code: f.FONKODU,
                    name: f.FONUNVANI,
                    return: f.GUNLUKGETIRI
                }));
            }
            throw new Error('No data returned');
        } catch (error) {
            console.error('Error fetching top funds, using fallback:', error);
            // Fallback to popular funds if API fails (to avoid showing nothing)
            return [
                { code: 'TTE', name: 'İş Portföy Teknoloji Karma Fon', return: 2.45 },
                { code: 'MAC', name: 'Marmara Capital Hisse Senedi Fonu', return: 1.87 },
                { code: 'AFT', name: 'Ak Portföy Yeni Teknolojiler Yabancı Hisse Senedi Fonu', return: 1.54 },
                { code: 'YAY', name: 'Yapı Kredi Portföy Yabancı Teknoloji Sektörü Hisse Senedi Fonu', return: 1.23 },
                { code: 'TI2', name: 'İş Portföy BIST Teknoloji Ağırlıklı Sınırlamalı Endeks Hisse Senedi Fonu', return: 1.12 }
            ];
        }
    },

    /**
     * Get TEFAS Fund price
     */
    getFundPrice: async (code: string): Promise<Partial<Instrument> | null> => {
        return await MarketDataService.getTefasPrice(code);
    },

    /**
     * Get detailed fund analysis including asset allocation (from TEFAS)
     * Mimics GetAllFundAnalyzeData
     */
    getFundDetail: async (code: string, type: string = 'YAT'): Promise<any> => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1); // Default 1 month

        try {
            const data = await fetchTefasData('GetAllFundAnalyzeData', {
                fonTip: type,
                fonKod: code.toUpperCase(),
                bastarih: startDate.toLocaleDateString('tr-TR'), // DD.MM.YYYY format required? Python says so.
                bittarih: endDate.toLocaleDateString('tr-TR')
            });
            return data;
        } catch (error) {
            console.error(`Error getting fund detail for ${code}:`, error);
            return null;
        }
    },

    /**
     * Get historical price data for a fund
     */
    getFundHistory: async (code: string, startDate: Date, endDate: Date): Promise<any[]> => {
        try {
            const formatDate = (date: Date) => date.toISOString().split('T')[0];

            const data = await fetchTefasData('BindHistoryInfo', {
                fontip: "ALL",
                bastarih: formatDate(startDate),
                bittarih: formatDate(endDate),
                fonkod: code.toUpperCase()
            });

            if (data && data.data) {
                return data.data.map((item: any) => ({
                    date: item.TARIH,
                    price: item.FIYAT
                }));
            }
            return [];
        } catch (error) {
            console.error(`Error getting fund history for ${code}:`, error);
            return [];
        }
    },

    /**
     * Search for instruments (Unified search)
     */
    /**
     * Search for instruments (Unified search)
     */
    searchInstruments: async (query: string, category: 'BIST' | 'ABD' | 'ALTIN' | 'KRIPTO' | 'FON' | 'BES' | 'DÖVİZ' = 'ABD'): Promise<Instrument[]> => {
        // BES Manual Entry
        if (category === 'BES') {
            return [{
                id: `BES_${Date.now()}`,
                symbol: 'BES',
                name: 'Bireysel Emeklilik',
                type: 'bes',
                currency: 'TRY',
                currentPrice: 1, // Unit price 1, user enters total value as amount
                lastUpdated: Date.now()
            }];
        }

        // Gold/Silver Fixed List
        if (category === 'ALTIN') {
            const metals: Instrument[] = [
                { id: 'GOLD_GRAM', symbol: 'GRAM', name: 'Gram Altın', type: 'gold', currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'GOLD_GRAM_22', symbol: 'GRAM22', name: '22 Ayar Gram Altın', type: 'gold', currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'GOLD_QUARTER', symbol: 'CEYREK', name: 'Çeyrek Altın', type: 'gold', currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'GOLD_HALF', symbol: 'YARIM', name: 'Yarım Altın', type: 'gold', currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'GOLD_FULL', symbol: 'TAM', name: 'Tam Altın', type: 'gold', currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'GOLD_ONS', symbol: 'ONS', name: 'Ons Altın', type: 'gold', currency: 'USD', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'SILVER_GRAM', symbol: 'GUMUS_GRAM', name: 'Gram Gümüş', type: 'metal', currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'SILVER_ONS', symbol: 'GUMUS_ONS', name: 'Ons Gümüş', type: 'metal', currency: 'USD', currentPrice: 0, lastUpdated: Date.now() }
            ];
            return metals.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));
        }

        // TEFAS Funds - Use data from GitHub/Supabase
        if (category === 'FON') {
            try {
                // Get TEFAS data from cache or fetch
                const cloudData = await fetchTefasSnapshot();
                const searchQuery = query.toLowerCase().trim();

                // Priority: Supabase/GitHub data, then local file
                if (cloudData && cloudData.data) {
                    const results: Instrument[] = [];

                    for (const [code, fund] of Object.entries(cloudData.data) as [string, any][]) {
                        const fundName = fund.name || code;
                        if (code.toLowerCase().includes(searchQuery) ||
                            fundName.toLowerCase().includes(searchQuery)) {
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
                        if (results.length >= 50) break; // Limit results
                    }

                    return results;
                }

                // Fallback to local TEFAS data
                if (tefasData && tefasData.data) {
                    const results: Instrument[] = [];

                    for (const [code, fund] of Object.entries(tefasData.data) as [string, any][]) {
                        const fundName = fund.name || code;
                        if (code.toLowerCase().includes(searchQuery) ||
                            fundName.toLowerCase().includes(searchQuery)) {
                            results.push({
                                id: code,
                                symbol: code,
                                name: fundName,
                                type: 'fund',
                                currency: 'TRY',
                                currentPrice: fund.price || 0,
                                dailyChange: fund.dailyChange || 0,
                                lastUpdated: Date.now()
                            });
                        }
                        if (results.length >= 50) break;
                    }

                    return results;
                }

                // If no data, return manual entry option
                return [{
                    id: query.toUpperCase(),
                    symbol: query.toUpperCase(),
                    name: `${query.toUpperCase()} (Manuel)`,
                    type: 'fund',
                    currency: 'TRY',
                    currentPrice: 0,
                    lastUpdated: Date.now()
                }];
            } catch (error) {
                console.error('Fund search error:', error);
                return [{
                    id: query.toUpperCase(),
                    symbol: query.toUpperCase(),
                    name: `${query.toUpperCase()} (Manuel)`,
                    type: 'fund',
                    currency: 'TRY',
                    currentPrice: 0,
                    lastUpdated: Date.now()
                }];
            }
        }

        // Forex / Döviz Fixed List
        if (category === 'DÖVİZ') {
            const currencies: Instrument[] = [
                { id: 'USD', symbol: 'USD', name: 'Amerikan Doları', type: 'forex' as any, currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'EUR', symbol: 'EUR', name: 'Euro', type: 'forex' as any, currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'GBP', symbol: 'GBP', name: 'İngiliz Sterlini', type: 'forex' as any, currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'RUB', symbol: 'RUB', name: 'Rus Rublesi', type: 'forex' as any, currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'CHF', symbol: 'CHF', name: 'İsviçre Frangı', type: 'forex' as any, currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'CAD', symbol: 'CAD', name: 'Kanada Doları', type: 'forex' as any, currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'AUD', symbol: 'AUD', name: 'Avustralya Doları', type: 'forex' as any, currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
                { id: 'JPY', symbol: 'JPY', name: 'Japon Yeni', type: 'forex' as any, currency: 'TRY', currentPrice: 0, lastUpdated: Date.now() },
            ];
            return currencies.filter(c =>
                c.name.toLowerCase().includes(query.toLowerCase()) ||
                c.symbol.toLowerCase().includes(query.toLowerCase())
            );
        }

        // Crypto
        if (category === 'KRIPTO') {
            try {
                const response = await axios.get(`https://api.coingecko.com/api/v3/search?query=${query}`);
                return response.data.coins.map((coin: any) => ({
                    id: coin.id,
                    symbol: coin.symbol.toUpperCase(),
                    name: coin.name,
                    type: 'crypto',
                    currency: 'USD',
                    currentPrice: 0,
                    lastUpdated: Date.now()
                }));
            } catch (error) {
                console.error('Crypto search error:', error);
                return [];
            }
        }

        // Stocks (Yahoo Finance or local list)
        // Web platformunda CORS problemi var, yerel listeyi kullan
        if (Platform.OS === 'web') {
            try {
                // Use local stock data for web platform
                const { BIST_STOCKS, US_STOCKS } = await import('../data/stocks');
                const stockList = category === 'BIST' ? BIST_STOCKS : US_STOCKS;
                const searchQuery = query.toLowerCase().trim();

                let results = stockList
                    .filter(stock =>
                        stock.symbol.toLowerCase().includes(searchQuery) ||
                        stock.name.toLowerCase().includes(searchQuery)
                    )
                    .slice(0, 50) // Limit results for performance
                    .map(stock => ({
                        id: stock.symbol,
                        symbol: stock.symbol,
                        name: stock.name,
                        type: 'stock' as const,
                        currency: category === 'BIST' ? 'TRY' : 'USD',
                        currentPrice: 0,
                        lastUpdated: Date.now()
                    }));

                // If no results found and query looks like a stock symbol, 
                // add it as a custom entry (allows adding stocks not in our list)
                if (results.length === 0 && searchQuery.length >= 3) {
                    const symbol = category === 'BIST'
                        ? (searchQuery.toUpperCase().endsWith('.IS') ? searchQuery.toUpperCase() : `${searchQuery.toUpperCase()}.IS`)
                        : searchQuery.toUpperCase();

                    results.push({
                        id: symbol,
                        symbol: symbol,
                        name: `${searchQuery.toUpperCase()} (Manuel)`,
                        type: 'stock' as const,
                        currency: category === 'BIST' ? 'TRY' : 'USD',
                        currentPrice: 0,
                        lastUpdated: Date.now()
                    });
                }

                return results;
            } catch (error) {
                console.error('Web stock search error:', error);
                return [];
            }
        }

        // Native: Yahoo Finance API kullan
        try {
            let searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=20&newsCount=0`;
            const response = await axios.get(searchUrl);

            return response.data.quotes
                .filter((quote: any) => {
                    if (category === 'BIST') {
                        return quote.symbol.endsWith('.IS') && (quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF');
                    }
                    if (category === 'ABD') {
                        return (quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF') && !quote.symbol.includes('.');
                    }
                    return false;
                })
                .map((quote: any) => ({
                    id: quote.symbol,
                    symbol: quote.symbol,
                    name: quote.shortname || quote.longname || quote.symbol,
                    type: 'stock',
                    currency: category === 'BIST' ? 'TRY' : 'USD',
                    currentPrice: 0,
                    lastUpdated: Date.now()
                }));
        } catch (error) {
            console.error('Stock search error:', error);
            return [];
        }
    },

    /**
     * Get historical USD/TRY rate for a specific date
     * @param date Timestamp in milliseconds
     */
    getHistoricalUsdTryRate: async (date: number): Promise<number | null> => {
        try {
            const dateObj = new Date(date);
            const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

            // Frankfurter API is good for historical forex
            // https://api.frankfurter.app/2020-01-01?from=USD&to=TRY
            const response = await axios.get(`https://api.frankfurter.app/${dateStr}`, {
                params: {
                    from: 'USD',
                    to: 'TRY',
                }
            });

            return response.data.rates.TRY;
        } catch (error) {
            console.error('Error fetching historical rate:', error);
            // Fallback to current rate or null
            return null;
        }
    },

    /**
     * Get historical data for benchmarks (BIST100, USD, Gold)
     * Returns array of { date, value }
     */
    getBenchmarkHistory: async (symbol: string, range: '1mo' | '3mo' | '1y' = '1mo'): Promise<{ date: string, value: number }[]> => {
        try {
            // Special handling for Gold - use Gram Gold TL instead of GC=F
            if (symbol === 'GOLD_GRAM_TL') {
                return await MarketDataService.getGoldGramTLHistory(range);
            }

            // Yahoo Finance Chart API
            // symbol: XU100.IS (BIST), TRY=X (USD)
            const interval = '1d';
            const response = await fetch(`${YAHOO_BASE_URL}/${symbol}?interval=${interval}&range=${range}`);

            if (!response.ok) {
                console.error(`Failed to fetch benchmark history for ${symbol}`);
                return [];
            }

            const data = await response.json();
            const result = data.chart.result[0];
            if (!result) return [];

            const timestamps = result.timestamp;
            const closePrices = result.indicators.quote[0].close;

            const history = timestamps.map((ts: number, index: number) => ({
                date: new Date(ts * 1000).toISOString().split('T')[0],
                value: closePrices[index] || 0
            })).filter((item: any) => item.value > 0);

            return history;
        } catch (error) {
            console.error('Error fetching benchmark history:', error);
            return [];
        }
    },

    /**
     * Get historical Gram Gold prices in TL
     * Calculates using XAU/USD * USD/TRY / 31.1035
     */
    getGoldGramTLHistory: async (range: '1mo' | '3mo' | '1y' = '1mo'): Promise<{ date: string, value: number }[]> => {
        try {
            const interval = '1d';

            // Fetch Gold USD and USD/TRY historical data
            const [goldResponse, usdResponse] = await Promise.all([
                fetch(`${YAHOO_BASE_URL}/GC=F?interval=${interval}&range=${range}`),
                fetch(`${YAHOO_BASE_URL}/TRY=X?interval=${interval}&range=${range}`)
            ]);

            if (!goldResponse.ok || !usdResponse.ok) {
                console.error('Failed to fetch gold or USD/TRY data');
                return [];
            }

            const goldData = await goldResponse.json();
            const usdData = await usdResponse.json();

            const goldResult = goldData.chart.result[0];
            const usdResult = usdData.chart.result[0];

            if (!goldResult || !usdResult) return [];

            const goldTimestamps = goldResult.timestamp;
            const goldPrices = goldResult.indicators.quote[0].close;
            const usdPrices = usdResult.indicators.quote[0].close;

            // Create a map of USD/TRY rates by date
            const usdRateMap: Record<string, number> = {};
            usdResult.timestamp.forEach((ts: number, index: number) => {
                const date = new Date(ts * 1000).toISOString().split('T')[0];
                usdRateMap[date] = usdPrices[index] || 0;
            });

            // Calculate Gram Gold TL for each date
            const history = goldTimestamps.map((ts: number, index: number) => {
                const date = new Date(ts * 1000).toISOString().split('T')[0];
                const goldUsd = goldPrices[index] || 0;
                const usdTry = usdRateMap[date] || 0;

                if (goldUsd === 0 || usdTry === 0) return null;

                // Convert oz to gram: 1 oz = 31.1035 grams
                const gramGoldTL = (goldUsd * usdTry) / 31.1035;

                return {
                    date,
                    value: gramGoldTL
                };
            }).filter((item): item is { date: string, value: number } => item !== null && item.value > 0);

            return history;
        } catch (error) {
            console.error('Error fetching gold gram TL history:', error);
            return [];
        }
    },
};
