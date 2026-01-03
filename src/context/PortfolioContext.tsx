import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PortfolioItem, Instrument, CashItem, RealizedTrade, Portfolio, Dividend } from '../types';
import { MarketDataService } from '../services/marketData';
import { useAuth } from './AuthContext';
import { saveUserPortfolios, loadUserPortfolios, migrateToSupabase } from '../services/supabaseService';

interface HistoryPoint {
    date: string;
    valueTry: number;
    valueUsd: number;
}

interface PortfolioContextType {
    // Multi-portfolio support
    portfolios: Portfolio[];
    activePortfolioId: string;
    activePortfolio: Portfolio | null;

    // Legacy support (aktif portföyün verileri)
    portfolio: PortfolioItem[];
    realizedTrades: RealizedTrade[];
    history: HistoryPoint[];
    cashItems: CashItem[];
    cashBalance: number;
    totalValueTry: number;
    totalValueUsd: number;
    totalRealizedProfitTry: number;
    totalRealizedProfitUsd: number;
    dividends: Dividend[];
    totalDividendsTry: number;
    totalDividendsUsd: number;
    isLoading: boolean;

    // Real-time Pricing State
    prices: Record<string, number>;
    dailyChanges: Record<string, number>;
    lastPricesUpdate: number;
    currentUsdRate: number;

    // Multi-portfolio functions
    createPortfolio: (name: string, color: string, icon: string) => Promise<void>;
    deletePortfolio: (id: string) => Promise<void>;
    switchPortfolio: (id: string) => Promise<void>;
    renamePortfolio: (id: string, newName: string) => Promise<void>;
    updatePortfolioColor: (id: string, color: string) => Promise<void>;
    updatePortfolioIcon: (id: string, icon: string) => Promise<void>;

    // Portfolio functions (aktif portföy için)
    addToPortfolio: (instrument: Instrument, amount: number, cost: number, currency: 'USD' | 'TRY', date: number, historicalUsdRate?: number, besData?: { principal: number, stateContrib: number, stateContribYield: number, principalYield: number }, customCategory?: string, customData?: { name?: string, currentPrice?: number }, deductFromCash?: boolean) => Promise<void>;
    addAsset: (asset: Omit<PortfolioItem, 'id'>) => Promise<void>;
    updateAsset: (id: string, newAmount: number, newAverageCost: number, newDate?: number, historicalUsdRate?: number, besData?: { besPrincipal: number, besPrincipalYield: number, besStateContrib: number, besStateContribYield: number }) => Promise<void>;
    sellAsset: (id: string, amount: number, sellPrice: number, sellDate?: number, historicalRate?: number) => Promise<void>;
    deleteAsset: (id: string) => Promise<void>;
    removeFromPortfolio: (id: string) => Promise<void>;

    // Cash management functions
    addCashItem: (item: Omit<CashItem, 'id'>) => Promise<void>;
    updateCashItem: (id: string, amount: number) => Promise<void>;
    deleteCashItem: (id: string) => Promise<void>;
    updateCash: (amount: number) => Promise<void>;
    sellCashFund: (id: string, unitsToSell: number, sellPrice: number, currentUsdRate: number) => Promise<void>;

    // Dividend functions
    addDividend: (dividend: Omit<Dividend, 'id'>) => Promise<void>;
    updateDividend: (id: string, updates: Partial<Dividend>) => Promise<void>;
    deleteDividend: (id: string) => Promise<void>;

    // Other functions
    updatePortfolioTarget: (targetValue: number, currency: 'TRY' | 'USD') => Promise<void>;
    refreshAllPrices: () => Promise<void>;
    deleteRealizedTrade: (id: string) => Promise<void>;
    refreshPrices: () => Promise<void>;
    updateTotalValue: (valTry: number, valUsd: number) => void;
    resetData: () => Promise<void>;
    clearHistory: () => Promise<void>;
    importData: (portfolios: Portfolio[], activePortfolioId: string) => Promise<void>;
    getPortfolioTotalValue: () => number;
    getPortfolioDistribution: () => { name: string; value: number; color: string }[];
    updatePortfolioCash: (portfolioId: string, amount: number) => Promise<void>;
}

const ALL_PORTFOLIOS_ID = 'all-portfolios';

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    // Multi-portfolio state
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [activePortfolioId, setActivePortfolioId] = useState<string>('');

    // Legacy state (synced with active portfolio)
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
    const [realizedTrades, setRealizedTrades] = useState<RealizedTrade[]>([]);
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [cashItems, setCashItems] = useState<CashItem[]>([]);
    const [dividends, setDividends] = useState<Dividend[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [totalValueTry, setTotalValueTry] = useState(0);
    const [totalValueUsd, setTotalValueUsd] = useState(0);
    const [currentUsdRate, setCurrentUsdRate] = useState(30);

    // Real-time Pricing State
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [dailyChanges, setDailyChanges] = useState<Record<string, number>>({});
    const [lastPricesUpdate, setLastPricesUpdate] = useState(0);

    const priceRefreshTimer = useRef<NodeJS.Timeout | null>(null);

    // Derived active portfolio
    const activePortfolio = activePortfolioId === ALL_PORTFOLIOS_ID
        ? {
            id: ALL_PORTFOLIOS_ID,
            name: 'Tüm Portföyler',
            color: '#6366f1',
            icon: '🌍',
            createdAt: Date.now(),
            items: portfolios.flatMap(p => p.items),
            cashBalance: portfolios.reduce((sum, p) => sum + (p.cashBalance || 0), 0),
            cashItems: portfolios.flatMap(p => p.cashItems || []),
            realizedTrades: portfolios.flatMap(p => p.realizedTrades || []),
            dividends: portfolios.flatMap(p => p.dividends || []),
            history: [] // History aggregation is complex, skip for now
        } as Portfolio
        : portfolios.find(p => p.id === activePortfolioId) || null;

    // Sync legacy state ONLY when switching portfolios (not on data changes)
    useEffect(() => {
        if (activePortfolioId === ALL_PORTFOLIOS_ID) {
            console.log('🌍 All portfolios sync - aggregating data');
            const allItems = portfolios.flatMap(p => p.items);
            const allCash = portfolios.flatMap(p => p.cashItems || []);
            const allTrades = portfolios.flatMap(p => p.realizedTrades || []);
            const allDividends = portfolios.flatMap(p => p.dividends || []);

            setPortfolio(allItems);
            setCashItems(allCash);
            setRealizedTrades(allTrades);
            setDividends(allDividends);
            setHistory([]); // Multi-portfolio history aggregation not yet supported
        } else {
            const currentPortfolio = portfolios.find(p => p.id === activePortfolioId);
            if (currentPortfolio) {
                console.log('🔄 Portfolio sync - updating state for:', activePortfolioId, 'items:', currentPortfolio.items.length);
                setPortfolio(currentPortfolio.items);
                setRealizedTrades(currentPortfolio.realizedTrades);
                setHistory(currentPortfolio.history || []);
                setCashItems(currentPortfolio.cashItems);
                setDividends(currentPortfolio.dividends || []);
            }
        }
    }, [activePortfolioId, portfolios]); // Sync when ID OR data changes

    // Calculate total cash balance from cash items
    const cashBalance = cashItems.reduce((sum, item) => {
        if (item.currency === 'TRY') {
            return sum + item.amount;
        } else {
            return sum + (item.amount * currentUsdRate);
        }
    }, 0);

    // Load data on mount and when user changes (login/logout)
    useEffect(() => {
        loadData();
        fetchCurrentUsdRate();
    }, [user?.id]);

    // Setup periodic price refresh
    useEffect(() => {
        if (portfolio.length > 0) {
            refreshAllPrices();

            // Clear existing timer if any
            if (priceRefreshTimer.current) clearInterval(priceRefreshTimer.current);

            // Refresh every 60 seconds
            priceRefreshTimer.current = setInterval(() => {
                refreshAllPrices();
            }, 60 * 1000);
        }

        return () => {
            if (priceRefreshTimer.current) clearInterval(priceRefreshTimer.current);
        };
    }, [portfolio.length]);

    const fetchCurrentUsdRate = async () => {
        try {
            const rateData = await MarketDataService.getYahooPrice('TRY=X');
            if (rateData?.currentPrice) {
                setCurrentUsdRate(rateData.currentPrice);
            }
        } catch (e) {
            console.error('Failed to fetch USD rate', e);
        }
    };

    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const savePortfolios = (newPortfolios: Portfolio[] | ((prev: Portfolio[]) => Portfolio[]), newActiveId?: string) => {
        const activeId = newActiveId || activePortfolioId;

        // 1. Update LOCAL state immediately
        setPortfolios(prev => {
            const updated = typeof newPortfolios === 'function' ? newPortfolios(prev) : newPortfolios;

            // Background tasks for storage
            (async () => {
                try {
                    await AsyncStorage.setItem('portfolios', JSON.stringify(updated));
                    if (newActiveId) await AsyncStorage.setItem('activePortfolioId', newActiveId);

                    // Debounced sync to Supabase
                    if (user?.id) {
                        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
                        syncTimeoutRef.current = setTimeout(async () => {
                            try {
                                console.log('🔷 Debounced background sync to Supabase...');
                                await saveUserPortfolios(user.id, updated, activeId);
                                console.log('✅ Supabase sync completed');
                            } catch (e) {
                                console.error('❌ Supabase sync failed:', e);
                                // Notify user about sync failure
                                const errorMessage = 'Bulut senkronizasyonu başarısız oldu. Verileriniz bu cihazda güvende, ancak internet bağlantınızı kontrol etmeniz önerilir.';
                                if (Platform.OS === 'web') {
                                    window.alert(errorMessage);
                                } else {
                                    Alert.alert('Eşitleme Hatası', errorMessage);
                                }
                            }
                        }, 1000);
                    }
                } catch (e) {
                    console.error('❌ Failed to save to local storage:', e);
                }
            })();

            return updated;
        });

        if (newActiveId) setActivePortfolioId(newActiveId);
    };

    const updateActivePortfolio = async (updates: Partial<Portfolio>) => {
        if (!activePortfolioId) return;

        savePortfolios(prev => prev.map(p =>
            p.id === activePortfolioId ? { ...p, ...updates } : p
        ));
    };

    const loadData = async () => {
        try {
            setIsLoading(true);
            console.log('📥 loadData: Starting...');

            // If user is logged in, try to load from Supabase first
            if (user?.id) {
                console.log('📥 loadData: User logged in, trying Supabase:', user.id);
                try {
                    const supabaseData = await loadUserPortfolios(user.id);
                    console.log('📥 loadData: Supabase returned', supabaseData.portfolios.length, 'portfolios');

                    if (supabaseData.portfolios.length > 0) {
                        // User has data in Supabase
                        const portfolio = supabaseData.portfolios.find(p => p.id === (supabaseData.activePortfolioId || supabaseData.portfolios[0].id));
                        console.log('📥 loadData: Active portfolio has', portfolio?.items?.length || 0, 'items');

                        setPortfolios(supabaseData.portfolios);
                        setActivePortfolioId(supabaseData.activePortfolioId || supabaseData.portfolios[0].id);
                        console.log('✅ loadData: Loaded portfolios from Supabase');
                        return;
                    } else {
                        // No data in Supabase - check if we should migrate local data
                        // Only migrate if the previous local user matches current user
                        const previousUserId = await AsyncStorage.getItem('lastLoggedInUserId');

                        if (previousUserId === user.id) {
                            // Same user - migrate their local data
                            console.log('📥 loadData: Same user, checking AsyncStorage for migration...');
                            const storedPortfolios = await AsyncStorage.getItem('portfolios');
                            if (storedPortfolios) {
                                const parsedPortfolios = JSON.parse(storedPortfolios);
                                const storedActiveId = await AsyncStorage.getItem('activePortfolioId');
                                console.log('📥 loadData: Found AsyncStorage data with', parsedPortfolios.length, 'portfolios');

                                // Migrate to Supabase
                                await migrateToSupabase(user.id, parsedPortfolios, storedActiveId || 'default');
                                setPortfolios(parsedPortfolios);
                                setActivePortfolioId(storedActiveId || parsedPortfolios[0]?.id || 'default');
                                console.log('✅ loadData: Migrated local data to Supabase');
                                return;
                            }
                        } else {
                            // Different user or first time - don't migrate, start fresh
                            console.log('📥 loadData: New user, skipping local data migration');
                        }

                        // Save current user ID for future reference
                        await AsyncStorage.setItem('lastLoggedInUserId', user.id);
                    }

                    // No data anywhere - create default portfolio
                    console.log('📥 loadData: No data anywhere, creating default');
                    const defaultPortfolio: Portfolio = {
                        id: 'default',
                        name: 'Ana Portföy',
                        color: '#007AFF',
                        icon: '💼',
                        createdAt: Date.now(),
                        items: [],
                        cashBalance: 0,
                        cashItems: [],
                        realizedTrades: [],
                        dividends: [],
                        history: []
                    };
                    await savePortfolios([defaultPortfolio], 'default');
                    setActivePortfolioId('default');
                    return;
                } catch (supabaseError) {
                    console.error('❌ loadData: Supabase load error, falling back to local:', supabaseError);
                }
            } else {
                console.log('📥 loadData: User NOT logged in, using AsyncStorage only');
            }

            // Fallback: Load from AsyncStorage (for non-logged-in users or on error)
            const storedPortfolios = await AsyncStorage.getItem('portfolios');
            const storedActiveId = await AsyncStorage.getItem('activePortfolioId');

            if (storedPortfolios) {
                const parsedPortfolios = JSON.parse(storedPortfolios);
                setPortfolios(parsedPortfolios);

                if (storedActiveId && parsedPortfolios.find((p: Portfolio) => p.id === storedActiveId)) {
                    setActivePortfolioId(storedActiveId);
                } else if (parsedPortfolios.length > 0) {
                    setActivePortfolioId(parsedPortfolios[0].id);
                }
            } else {
                // No data - create default empty portfolio
                const defaultPortfolio: Portfolio = {
                    id: 'default',
                    name: 'Ana Portföy',
                    color: '#007AFF',
                    icon: '💼',
                    createdAt: Date.now(),
                    items: [],
                    cashBalance: 0,
                    cashItems: [],
                    realizedTrades: [],
                    dividends: [],
                    history: []
                };
                setPortfolios([defaultPortfolio]);
                setActivePortfolioId('default');
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Reload data when user changes
    useEffect(() => {
        loadData();
    }, [user?.id]);

    // Multi-portfolio functions
    const createPortfolio = async (name: string, color: string, icon: string) => {
        const id = Date.now().toString();
        const newPortfolio: Portfolio = {
            id,
            name,
            color,
            icon,
            createdAt: Date.now(),
            items: [],
            cashBalance: 0,
            cashItems: [],
            realizedTrades: [],
            dividends: [],
            history: []
        };

        savePortfolios(prev => [...prev, newPortfolio], id);
    };

    const deletePortfolio = async (id: string) => {
        console.log('🗑️ Attempting to delete portfolio:', id);

        savePortfolios(prev => {
            if (prev.length <= 1) {
                console.log('⚠️ Cannot delete last portfolio');
                return prev;
            }

            const filtered = prev.filter(p => p.id !== id);
            console.log('✅ Portfolio filtered from local state. Remaining:', filtered.length);
            return filtered;
        }, id === activePortfolioId ? portfolios.find(p => p.id !== id)?.id : activePortfolioId);
    };

    const switchPortfolio = async (id: string) => {
        setActivePortfolioId(id);
        await AsyncStorage.setItem('activePortfolioId', id);
    };

    const renamePortfolio = async (id: string, newName: string) => {
        savePortfolios(prev => prev.map(p =>
            p.id === id ? { ...p, name: newName } : p
        ));
    };

    const updatePortfolioColor = async (id: string, color: string) => {
        savePortfolios(prev => prev.map(p =>
            p.id === id ? { ...p, color } : p
        ));
    };

    const updatePortfolioIcon = async (id: string, icon: string) => {
        savePortfolios(prev => prev.map(p =>
            p.id === id ? { ...p, icon } : p
        ));
    };

    // Cash Management Functions
    const addCashItem = async (item: Omit<CashItem, 'id'>) => {
        savePortfolios(prev => {
            let targetId = activePortfolioId;
            if (targetId === ALL_PORTFOLIOS_ID) {
                targetId = prev.length > 0 ? prev[0].id : '';
            }

            if (!targetId) return prev;

            const newItem: CashItem = {
                ...item,
                id: Date.now().toString(),
                dateAdded: Date.now()
            };

            return prev.map(p =>
                p.id === targetId ? { ...p, cashItems: [...(p.cashItems || []), newItem] } : p
            );
        });
    };

    const updateCashItem = async (id: string, amount: number) => {
        savePortfolios(prev => prev.map(ownerPortfolio => {
            if (!(ownerPortfolio.cashItems || []).some(item => item.id === id)) return ownerPortfolio;

            const updatedItems = ownerPortfolio.cashItems.map(item =>
                item.id === id ? { ...item, amount } : item
            );
            return { ...ownerPortfolio, cashItems: updatedItems };
        }));
    };

    const deleteCashItem = async (id: string) => {
        savePortfolios(prev => prev.map(ownerPortfolio => {
            if (!(ownerPortfolio.cashItems || []).some(item => item.id === id)) return ownerPortfolio;

            const updatedItems = ownerPortfolio.cashItems.filter(item => item.id !== id);
            return { ...ownerPortfolio, cashItems: updatedItems };
        }));
    };

    const updateCash = async (amount: number) => {
        savePortfolios(prev => {
            const currentPortfolio = prev.find(p => p.id === activePortfolioId) || prev[0];
            if (!currentPortfolio) return prev;

            let defaultCash = (currentPortfolio.cashItems || []).find(item => item.type === 'cash' && item.currency === 'TRY');

            if (defaultCash) {
                const newAmount = defaultCash.amount + amount;
                if (newAmount < 0) return prev;

                const updatedItems = currentPortfolio.cashItems.map(item =>
                    item.id === defaultCash!.id ? { ...item, amount: newAmount } : item
                );
                return prev.map(p => p.id === currentPortfolio.id ? { ...p, cashItems: updatedItems } : p);
            } else if (amount > 0) {
                const newItem: CashItem = {
                    id: Date.now().toString(),
                    type: 'cash',
                    name: 'Nakit (TL)',
                    amount: amount,
                    currency: 'TRY',
                    dateAdded: Date.now()
                };
                return prev.map(p => p.id === currentPortfolio.id ? { ...p, cashItems: [...(p.cashItems || []), newItem] } : p);
            }
            return prev;
        });
    };

    const sellCashFund = async (id: string, unitsToSell: number, sellPrice: number, currentUsdRate: number) => {
        savePortfolios(prev => {
            const ownerPortfolio = prev.find(p => (p.cashItems || []).some(item => item.id === id));
            if (!ownerPortfolio) return prev;

            const fundItem = ownerPortfolio.cashItems.find(item => item.id === id);
            if (!fundItem || fundItem.type !== 'money_market_fund' || !fundItem.units || !fundItem.averageCost) return prev;

            const actualUnitsToSell = Math.min(unitsToSell, fundItem.units);
            const currentValue = actualUnitsToSell * sellPrice;
            const costBasis = actualUnitsToSell * fundItem.averageCost;
            const profitTry = currentValue - costBasis;

            const costUsd = fundItem.historicalUsdRate ? costBasis / fundItem.historicalUsdRate : costBasis / currentUsdRate;
            const valueUsd = currentValue / currentUsdRate;
            const profitUsd = valueUsd - costUsd;

            const trade: RealizedTrade = {
                id: Date.now().toString(),
                instrumentId: fundItem.instrumentId || fundItem.name,
                amount: actualUnitsToSell,
                sellPrice: sellPrice,
                buyPrice: fundItem.averageCost,
                currency: 'TRY',
                date: Date.now(),
                profit: profitTry,
                profitUsd: profitUsd,
                profitTry: profitTry,
                type: 'fund'
            };

            let updatedCashItems = [...(ownerPortfolio.cashItems || [])];

            if (actualUnitsToSell >= fundItem.units) {
                // Sell all
                updatedCashItems = updatedCashItems.filter(item => item.id !== id);
            } else {
                // Partial sell
                updatedCashItems = updatedCashItems.map(item =>
                    item.id === id ? {
                        ...item,
                        units: (item.units || 0) - actualUnitsToSell,
                        amount: ((item.units || 0) - actualUnitsToSell) * (item.averageCost || 0)
                    } : item
                );
            }

            const defaultCashIndex = updatedCashItems.findIndex(item => item.type === 'cash' && item.currency === 'TRY');

            if (defaultCashIndex !== -1) {
                updatedCashItems[defaultCashIndex] = {
                    ...updatedCashItems[defaultCashIndex],
                    amount: updatedCashItems[defaultCashIndex].amount + currentValue
                };
            } else {
                updatedCashItems.push({
                    id: Date.now().toString() + '_cash',
                    type: 'cash',
                    name: 'Nakit (TL)',
                    amount: currentValue,
                    currency: 'TRY',
                    dateAdded: Date.now()
                });
            }

            return prev.map(p =>
                p.id === ownerPortfolio.id
                    ? { ...p, cashItems: updatedCashItems, realizedTrades: [...(p.realizedTrades || []), trade] }
                    : p
            );
        });
    };

    const addAsset = async (asset: Omit<PortfolioItem, 'id'>) => {
        savePortfolios(prev => {
            let targetId = activePortfolioId;
            if (targetId === ALL_PORTFOLIOS_ID) {
                targetId = prev.length > 0 ? prev[0].id : '';
            }

            if (!targetId) return prev;

            const newItem = { ...asset, id: Date.now().toString() };
            return prev.map(p =>
                p.id === targetId ? { ...p, items: [...(p.items || []), newItem] } : p
            );
        });
    };

    const updateAsset = async (
        id: string,
        newAmount: number,
        newAverageCost: number,
        newDate?: number,
        historicalUsdRate?: number,
        besData?: {
            besPrincipal: number,
            besPrincipalYield: number,
            besStateContrib: number,
            besStateContribYield: number
        }
    ) => {
        savePortfolios(prev => prev.map(ownerPortfolio => {
            if (!ownerPortfolio.items.some(item => item.id === id)) return ownerPortfolio;

            const updatedItems = ownerPortfolio.items.map(item => {
                if (item.id === id) {
                    const updates: Partial<PortfolioItem> = {
                        amount: newAmount,
                        averageCost: newAverageCost
                    };

                    if (besData) {
                        updates.besPrincipal = besData.besPrincipal;
                        updates.besPrincipalYield = besData.besPrincipalYield;
                        updates.besStateContrib = besData.besStateContrib;
                        updates.besStateContribYield = besData.besStateContribYield;
                        updates.averageCost = besData.besPrincipal;
                    }

                    if (newDate) {
                        updates.dateAdded = newDate;
                    }

                    if (historicalUsdRate) {
                        if (item.currency === 'USD') {
                            updates.originalCostUsd = newAverageCost * newAmount;
                            updates.originalCostTry = newAverageCost * newAmount * historicalUsdRate;
                        } else {
                            updates.originalCostTry = newAverageCost * newAmount;
                            updates.originalCostUsd = newAverageCost * newAmount / historicalUsdRate;
                        }
                    }

                    return { ...item, ...updates };
                }
                return item;
            });

            return { ...ownerPortfolio, items: updatedItems };
        }));
    };

    const deleteAsset = async (id: string) => {
        savePortfolios(prev => prev.map(ownerPortfolio => {
            if (!ownerPortfolio.items.some(item => item.id === id)) return ownerPortfolio;
            return {
                ...ownerPortfolio,
                items: ownerPortfolio.items.filter(item => item.id !== id)
            };
        }));
    };

    const addToPortfolio = async (
        instrument: Instrument,
        amount: number,
        cost: number,
        currency: 'USD' | 'TRY',
        date: number,
        historicalUsdRate?: number,
        besData?: { principal: number, stateContrib: number, stateContribYield: number, principalYield: number },
        customCategory?: string,
        customData?: { name?: string, currentPrice?: number },
        deductFromCash?: boolean
    ) => {
        savePortfolios(prev => {
            const rateToUse = historicalUsdRate || currentUsdRate;
            const instrumentId = instrument.instrumentId || instrument.id;

            let targetPortfolioId = activePortfolioId;
            if (targetPortfolioId === ALL_PORTFOLIOS_ID) {
                const existingIn = prev.find(p => p.items.some(p_item =>
                    p_item.instrumentId.toUpperCase() === instrumentId.toUpperCase() &&
                    p_item.type === instrument.type
                ));
                targetPortfolioId = existingIn?.id || (prev.length > 0 ? prev[0].id : '');
            }

            if (!targetPortfolioId) return prev;

            return prev.map(targetPortfolio => {
                if (targetPortfolio.id !== targetPortfolioId) return targetPortfolio;

                const existingIndex = targetPortfolio.items.findIndex(p =>
                    p.instrumentId.toUpperCase() === instrumentId.toUpperCase() &&
                    p.type === instrument.type
                );

                let newPortfolioItems = [...targetPortfolio.items];

                if (existingIndex !== -1) {
                    const existing = targetPortfolio.items[existingIndex];
                    const totalAmount = existing.amount + amount;
                    const weightedAverageCost = ((existing.amount * existing.averageCost) + (amount * cost)) / totalAmount;

                    let totalOriginalCostUsd = (existing.originalCostUsd || 0);
                    let totalOriginalCostTry = (existing.originalCostTry || 0);

                    if (currency === 'USD') {
                        totalOriginalCostUsd += cost * amount;
                        totalOriginalCostTry += cost * amount * rateToUse;
                    } else {
                        totalOriginalCostTry += cost * amount;
                        totalOriginalCostUsd += cost * amount / rateToUse;
                    }

                    newPortfolioItems[existingIndex] = {
                        ...existing,
                        amount: totalAmount,
                        averageCost: weightedAverageCost,
                        original_cost_usd: totalOriginalCostUsd, // Fix: Use correct field names based on type
                        original_cost_try: totalOriginalCostTry,
                    } as PortfolioItem;
                    // Wait, PortfolioItem type uses camelCase: originalCostUsd, originalCostTry.
                    // Let me fix the mapping here.
                    newPortfolioItems[existingIndex] = {
                        ...existing,
                        amount: totalAmount,
                        averageCost: weightedAverageCost,
                        originalCostUsd: totalOriginalCostUsd,
                        originalCostTry: totalOriginalCostTry,
                    };
                } else {
                    const newItem: PortfolioItem = {
                        id: Date.now().toString(),
                        instrumentId,
                        amount,
                        averageCost: cost,
                        currency,
                        originalCostUsd: currency === 'USD' ? cost * amount : cost * amount / rateToUse,
                        originalCostTry: currency === 'TRY' ? cost * amount : cost * amount * rateToUse,
                        dateAdded: date,
                        type: instrument.type,
                        besPrincipal: besData?.principal,
                        besStateContrib: besData?.stateContrib,
                        besStateContribYield: besData?.stateContribYield,
                        besPrincipalYield: besData?.principalYield,
                        customCategory: customCategory,
                        customName: customData?.name,
                        customCurrentPrice: customData?.currentPrice,
                    };
                    newPortfolioItems.push(newItem);
                }

                let updatedCashItems = [...(targetPortfolio.cashItems || [])];
                if (deductFromCash && currency === 'TRY') {
                    const totalCost = amount * cost;
                    const defaultCashIndex = updatedCashItems.findIndex(i => i.type === 'cash' && i.currency === 'TRY');
                    if (defaultCashIndex !== -1) {
                        updatedCashItems[defaultCashIndex] = {
                            ...updatedCashItems[defaultCashIndex],
                            amount: updatedCashItems[defaultCashIndex].amount - totalCost
                        };
                    }
                }

                return { ...targetPortfolio, items: newPortfolioItems, cashItems: updatedCashItems };
            });
        });
    };

    const sellAsset = async (id: string, amountToSell: number, sellPrice: number, sellDate?: number, historicalRate?: number) => {
        savePortfolios(prev => {
            const ownerPortfolio = prev.find(p => p.items.some(item => item.id === id));
            if (!ownerPortfolio) return prev;

            const itemIndex = ownerPortfolio.items.findIndex(p => p.id === id);
            const item = ownerPortfolio.items[itemIndex];

            if (item.amount < amountToSell) return prev;

            const costBasis = item.averageCost * amountToSell;
            const saleProceeds = sellPrice * amountToSell;
            const profit = saleProceeds - costBasis;
            const rateToUse = historicalRate || currentUsdRate;

            let profitUsd = 0;
            let profitTry = 0;
            let proceedsTry = 0;

            if (item.currency === 'USD') {
                profitUsd = profit;
                profitTry = profit * rateToUse;
                proceedsTry = saleProceeds * rateToUse;
            } else {
                profitTry = profit;
                profitUsd = profit / rateToUse;
                proceedsTry = saleProceeds;
            }

            const trade: RealizedTrade = {
                id: Math.random().toString(36).substr(2, 9),
                instrumentId: item.instrumentId,
                amount: amountToSell,
                sellPrice,
                buyPrice: item.averageCost,
                currency: item.currency,
                date: sellDate || Date.now(),
                profit,
                profitUsd,
                profitTry,
                type: item.type
            };

            const newItems = [...ownerPortfolio.items];
            if (item.amount === amountToSell) {
                newItems.splice(itemIndex, 1);
            } else {
                newItems[itemIndex] = { ...item, amount: item.amount - amountToSell };
            }

            let updatedCashItems = [...(ownerPortfolio.cashItems || [])];
            const defaultCashIndex = updatedCashItems.findIndex(i => i.type === 'cash' && i.currency === 'TRY');

            if (defaultCashIndex !== -1) {
                updatedCashItems[defaultCashIndex] = {
                    ...updatedCashItems[defaultCashIndex],
                    amount: updatedCashItems[defaultCashIndex].amount + proceedsTry
                };
            } else {
                updatedCashItems.push({
                    id: Date.now().toString(),
                    type: 'cash',
                    name: 'Nakit (TL)',
                    amount: proceedsTry,
                    currency: 'TRY',
                    dateAdded: Date.now()
                });
            }

            return prev.map(p =>
                p.id === ownerPortfolio.id
                    ? { ...p, items: newItems, realizedTrades: [...(p.realizedTrades || []), trade], cashItems: updatedCashItems }
                    : p
            );
        });
    };

    const removeFromPortfolio = async (id: string) => {
        const ownerPortfolio = portfolios.find(p => p.items.some(item => item.id === id));
        if (!ownerPortfolio) return;

        const updatedItems = ownerPortfolio.items.filter(item => item.id !== id);
        const newPortfolios = portfolios.map(p =>
            p.id === ownerPortfolio.id ? { ...p, items: updatedItems } : p
        );
        await savePortfolios(newPortfolios);
    };

    const refreshPrices = async () => {
        setIsLoading(true);
        await fetchCurrentUsdRate();
        await refreshAllPrices();
        setIsLoading(false);
    };

    const refreshAllPrices = async () => {
        if (portfolio.length === 0) return;

        console.log('🔄 Refreshing all prices from Context...');
        const newPrices: Record<string, number> = {};
        const newDailyChanges: Record<string, number> = {};

        try {
            // Fetch USD/TRY rate
            const rateData = await MarketDataService.getYahooPrice('TRY=X');
            if (rateData && rateData.currentPrice) {
                setCurrentUsdRate(rateData.currentPrice);
            }

            // Fetch all prices in parallel using batch API
            const regularItems = portfolio.filter(item => !item.customCurrentPrice);
            const priceResults = await MarketDataService.fetchMultiplePrices(regularItems);

            for (const item of portfolio) {
                if (item.customCurrentPrice) {
                    newPrices[item.instrumentId] = item.customCurrentPrice;
                    newDailyChanges[item.instrumentId] = 0;
                    continue;
                }

                const priceData = priceResults[item.instrumentId];
                if (priceData && priceData.currentPrice) {
                    newPrices[item.instrumentId] = priceData.currentPrice;
                    newDailyChanges[item.instrumentId] = (priceData as any).change24h || 0;
                }
            }

            setPrices(prev => ({ ...prev, ...newPrices }));
            setDailyChanges(prev => ({ ...prev, ...newDailyChanges }));
            setLastPricesUpdate(Date.now());
            console.log('✅ All prices refreshed in Context');
        } catch (e) {
            console.error('❌ Failed to refresh all prices:', e);
        }
    };

    const updateTotalValue = async (valTry: number, valUsd: number) => {
        setTotalValueTry(valTry);
        setTotalValueUsd(valUsd);

        const today = new Date().toISOString().split('T')[0];
        let newHistory = [...history];

        const lastPoint = newHistory[newHistory.length - 1];
        if (!lastPoint || lastPoint.date !== today) {
            newHistory.push({ date: today, valueTry: valTry, valueUsd: valUsd });
        } else {
            if (Math.abs(lastPoint.valueTry - valTry) > 1) {
                newHistory[newHistory.length - 1] = { date: today, valueTry: valTry, valueUsd: valUsd };
            }
        }

        newHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (newHistory.length > 365) newHistory = newHistory.slice(-365);

        if (JSON.stringify(newHistory) !== JSON.stringify(history)) {
            await updateActivePortfolio({ history: newHistory });
        }
    };

    const updatePortfolioTarget = async (targetValue: number, currency: 'TRY' | 'USD') => {
        await updateActivePortfolio({
            targetValueTry: targetValue,
            targetCurrency: currency
        });
    };

    const resetData = async () => {
        try {
            // Reset only active portfolio data
            await updateActivePortfolio({
                items: [],
                realizedTrades: [],
                history: [],
                cashItems: [],
                cashBalance: 0
            });
        } catch (error) {
            console.error('Error resetting data:', error);
        }
    };

    const clearHistory = async () => {
        try {
            await updateActivePortfolio({ history: [] });
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    };

    const importData = async (newPortfolios: Portfolio[], newActivePortfolioId: string) => {
        try {
            await AsyncStorage.setItem('portfolios', JSON.stringify(newPortfolios));
            await AsyncStorage.setItem('activePortfolioId', newActivePortfolioId);
            setPortfolios(newPortfolios);
            setActivePortfolioId(newActivePortfolioId);

            // Sync legacy state with the new active portfolio
            const newActivePortfolio = newPortfolios.find(p => p.id === newActivePortfolioId);
            if (newActivePortfolio) {
                setPortfolio(newActivePortfolio.items);
                setRealizedTrades(newActivePortfolio.realizedTrades);
                setHistory(newActivePortfolio.history || []);
                setCashItems(newActivePortfolio.cashItems);
            }
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    };

    const totalRealizedProfitTry = realizedTrades.reduce((sum, t) => sum + t.profitTry, 0);
    const totalRealizedProfitUsd = realizedTrades.reduce((sum, trade) => sum + (trade.profitUsd || 0), 0);

    const totalDividendsTry = dividends.reduce((sum, div) => {
        if (div.currency === 'TRY') return sum + div.amount;
        return sum + (div.amount * currentUsdRate);
    }, 0);

    const totalDividendsUsd = dividends.reduce((sum, div) => {
        if (div.currency === 'USD') return sum + div.amount;
        return sum + (div.amount / currentUsdRate);
    }, 0);

    const getPortfolioTotalValue = () => {
        return totalValueTry;
    };

    const getPortfolioDistribution = () => {
        const distribution: { name: string; value: number; color: string }[] = [];
        const typeMap: Record<string, number> = {};

        // Group by type
        portfolio.forEach(item => {
            const typeName = getTypeName(item.type);
            const livePrice = prices[item.instrumentId] || item.customCurrentPrice || item.averageCost;

            let value = item.amount * livePrice;

            // Convert to TRY if needed
            if (item.currency === 'USD') {
                value = value * (currentUsdRate || 1);
            }

            if (item.type === 'bes') {
                value = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
            }
            // For now, let's use the cost basis or better yet, let's rely on the fact that 
            // the AI screen will fetch prices or we can pass prices to it.
            // OR, we can just use the item's cost for now as an approximation if prices aren't available,
            // but ideally we want current value.

            // Let's look at how SummaryScreen does it. It fetches prices and calculates.
            // Since AI Analysis is a separate screen, it might be better to calculate distribution THERE 
            // by fetching prices, similar to SummaryScreen.
            // BUT, the user asked for these methods to be in Context.
            // Let's implement them here but note that they might need price data.

            // Actually, for the sake of the AI Assistant which runs on the context, 
            // let's use the `totalValueTry` and `portfolio` items. 
            // Since we don't have real-time prices in context (except total), 
            // we will use the *cost* as a fallback or if we want to be accurate, 
            // we should probably move this logic to the screen where prices are available.

            // However, to satisfy the immediate lint error and provide *some* data:
            if (typeMap[typeName]) {
                typeMap[typeName] += value;
            } else {
                typeMap[typeName] = value;
            }
        });

        // Add cash
        if (cashBalance > 0) {
            typeMap['Nakit (TL)'] = cashBalance;
        }

        // Convert to array
        Object.keys(typeMap).forEach(key => {
            distribution.push({
                name: key,
                value: typeMap[key],
                color: getColorForType(key)
            });
        });

        return distribution;
    };

    const getTypeName = (type: string | undefined) => {
        switch (type) {
            case 'stock': return 'Hisse (BIST)';
            case 'crypto': return 'Kripto';
            case 'gold': return 'Altın';
            case 'forex': return 'Döviz';
            case 'fund': return 'Yatırım Fonu';
            case 'bes': return 'BES';
            default: return 'Diğer';
        }
    };

    const getColorForType = (type: string) => {
        switch (type) {
            case 'Hisse (BIST)': return '#007AFF';
            case 'Kripto': return '#FF9500';
            case 'Altın': return '#FFD700';
            case 'Döviz': return '#34C759';
            case 'Yatırım Fonu': return '#5856D6';
            case 'BES': return '#FF2D55';
            case 'Nakit (TL)': return '#8E8E93';
            default: return '#AF52DE';
        }
    };

    const deleteRealizedTrade = async (id: string) => {
        savePortfolios(prev => prev.map(p => ({
            ...p,
            realizedTrades: (p.realizedTrades || []).filter(t => t.id !== id)
        })));
    };

    const addDividend = async (dividend: Omit<Dividend, 'id'>) => {
        if (!activePortfolioId) return;
        const newDividend: Dividend = {
            ...dividend,
            id: Date.now().toString()
        };

        savePortfolios(prev => prev.map(p =>
            p.id === activePortfolioId
                ? { ...p, dividends: [...(p.dividends || []), newDividend] }
                : p
        ));
    };

    const updateDividend = async (id: string, updates: Partial<Dividend>) => {
        savePortfolios(prev => prev.map(p => ({
            ...p,
            dividends: (p.dividends || []).map(div => div.id === id ? { ...div, ...updates } : div)
        })));
    };

    const deleteDividend = async (id: string) => {
        savePortfolios(prev => prev.map(p => ({
            ...p,
            dividends: (p.dividends || []).filter(div => div.id !== id)
        })));
    };

    const updatePortfolioCash = async (portfolioId: string, amount: number) => {
        savePortfolios(prev => {
            return prev.map(p => {
                if (p.id !== portfolioId) return p;

                const cashItems = [...(p.cashItems || [])];
                const tryCashIndex = cashItems.findIndex(item => item.type === 'cash' && item.currency === 'TRY');

                if (tryCashIndex !== -1) {
                    cashItems[tryCashIndex] = {
                        ...cashItems[tryCashIndex],
                        amount: cashItems[tryCashIndex].amount + amount
                    };
                } else if (amount > 0) {
                    cashItems.push({
                        id: Date.now().toString() + '_cash',
                        type: 'cash',
                        name: 'Nakit (TL)',
                        amount: amount,
                        currency: 'TRY',
                        dateAdded: Date.now()
                    });
                }
                return { ...p, cashItems };
            });
        });
    };

    return (
        <PortfolioContext.Provider value={{
            portfolios,
            activePortfolioId,
            activePortfolio,
            portfolio,
            realizedTrades,
            history,
            cashItems,
            cashBalance,
            totalValueTry,
            totalValueUsd,
            totalRealizedProfitTry,
            totalRealizedProfitUsd,
            dividends,
            totalDividendsTry,
            totalDividendsUsd,
            isLoading,
            createPortfolio,
            deletePortfolio,
            switchPortfolio,
            renamePortfolio,
            updatePortfolioColor,
            updatePortfolioIcon,
            addToPortfolio,
            addAsset,
            updateAsset,
            sellAsset,
            deleteAsset,
            removeFromPortfolio,
            addCashItem,
            updateCashItem,
            deleteCashItem,
            updateCash,
            sellCashFund,
            refreshPrices,
            updateTotalValue,
            resetData,
            clearHistory,
            importData,
            getPortfolioTotalValue,
            getPortfolioDistribution,
            refreshAllPrices,
            prices,
            dailyChanges,
            lastPricesUpdate,
            currentUsdRate,
            addDividend,
            updateDividend,
            deleteDividend,
            updatePortfolioTarget,
            deleteRealizedTrade,
            updatePortfolioCash
        }}>
            {children}
        </PortfolioContext.Provider>
    );
};

export const usePortfolio = () => {
    const context = useContext(PortfolioContext);
    if (!context) {
        throw new Error('usePortfolio must be used within a PortfolioProvider');
    }
    return context;
};
