import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Platform, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PortfolioItem, Instrument, CashItem, RealizedTrade, Portfolio, Dividend } from '../types';
import { MarketDataService } from '../services/marketData';
import { useAuth } from './AuthContext';
import { saveUserPortfolios, loadUserPortfolios, migrateToSupabase } from '../services/supabaseService';
import { supabase } from '../services/supabaseClient';

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
    totalCostBasisTry: number;
    dailyProfit: number;
    totalRealizedProfitTry: number;
    totalRealizedProfitUsd: number;
    dividends: Dividend[];
    totalDividendsTry: number;
    totalDividendsUsd: number;
    isLoading: boolean;
    isSyncing: boolean;
    syncError: string | null;
    lastSyncAt: number | null;

    // Real-time Pricing State
    prices: Record<string, number>;
    dailyChanges: Record<string, number>;
    fundPrices: Record<string, number>;
    priceCurrencies: Record<string, string>;
    lastPricesUpdate: number;
    currentUsdRate: number;

    // Multi-portfolio functions
    createPortfolio: (name: string, color: string, icon: string, mode?: 'standard' | 'unitized', initialPrice?: number) => Promise<void>;
    addCapital: (portfolioId: string, amount: number) => Promise<void>;
    deletePortfolio: (id: string) => Promise<void>;
    switchPortfolio: (id: string) => Promise<void>;
    renamePortfolio: (id: string, newName: string) => Promise<void>;
    updatePortfolioColor: (id: string, color: string) => Promise<void>;
    updatePortfolioIcon: (id: string, icon: string) => Promise<void>;

    // Portfolio functions (aktif portföy için)
    addToPortfolio: (instrument: Instrument, amount: number, cost: number, currency: 'USD' | 'TRY', date: number, historicalUsdRate?: number, besData?: { principal: number, stateContrib: number, stateContribYield: number, principalYield: number }, customCategory?: string, customData?: { name?: string, currentPrice?: number }, deductFromCash?: boolean) => Promise<void>;
    addAsset: (asset: Omit<PortfolioItem, 'id'>) => Promise<void>;
    updateAsset: (id: string, newAmount: number, newAverageCost: number, newDate?: number, historicalUsdRate?: number, besData?: { besPrincipal: number, besPrincipalYield: number, besStateContrib: number, besStateContribYield: number }) => Promise<void>;
    sellAsset: (id: string, amount: number, sellPrice: number, sellDate?: number, historicalRate?: number, destinationCashId?: string, taxRate?: number, commissionRate?: number) => Promise<void>;
    deleteAsset: (id: string) => Promise<void>;
    removeFromPortfolio: (id: string) => Promise<void>;

    // Cash management functions
    addCashItem: (item: Omit<CashItem, 'id'>) => Promise<void>;
    updateCashItem: (id: string, amount: number) => Promise<void>;
    deleteCashItem: (id: string) => Promise<void>;
    updateCash: (amount: number) => Promise<void>;
    sellCashFund: (id: string, unitsToSell: number, sellPrice: number, currentUsdRate: number, taxRate?: number, sellDate?: number) => Promise<void>;

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
    const [totalCostBasisTry, setTotalCostBasisTry] = useState(0);
    const [dailyProfit, setDailyProfit] = useState(0);
    const [currentUsdRate, setCurrentUsdRate] = useState(30);

    // Real-time Pricing State
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [priceCurrencies, setPriceCurrencies] = useState<Record<string, string>>({});
    const [fundPrices, setFundPrices] = useState<Record<string, number>>({});
    const [dailyChanges, setDailyChanges] = useState<Record<string, number>>({});
    const [lastPricesUpdate, setLastPricesUpdate] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

    const priceRefreshTimer = useRef<NodeJS.Timeout | null>(null);
    const loadDataTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingSyncData = useRef<{ portfolios: Portfolio[], activeId: string } | null>(null);
    const syncInFlightRef = useRef(false);
    const serverReloadQueuedRef = useRef(false);
    const isInitialized = useRef<boolean>(false);

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

    // Setup periodic price refresh — also trigger on portfolio content change
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
    }, [portfolio]); // FIX: Watch full portfolio array, not just length, so price refresh triggers on content changes too

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

    const persistLocalState = async (nextPortfolios: Portfolio[], nextActiveId: string) => {
        await AsyncStorage.setItem('portfolios', JSON.stringify(nextPortfolios));
        await AsyncStorage.setItem('activePortfolioId', nextActiveId);
    };

    const applyLoadedState = async (nextPortfolios: Portfolio[], nextActiveId: string) => {
        setPortfolios(nextPortfolios);
        setActivePortfolioId(nextActiveId);
        await persistLocalState(nextPortfolios, nextActiveId);
        setLastSyncAt(Date.now());
    };

    const flushPendingSync = async () => {
        if (!user?.id || syncInFlightRef.current || !pendingSyncData.current) return;

        const dataToSync = pendingSyncData.current;
        pendingSyncData.current = null;
        syncInFlightRef.current = true;
        setIsSyncing(true);
        setSyncError(null);

        try {
            console.log('🚀 Syncing portfolios to Supabase...');
            const savedPortfolios = await saveUserPortfolios(user.id, dataToSync.portfolios, dataToSync.activeId);

            if (!pendingSyncData.current) {
                await applyLoadedState(savedPortfolios, dataToSync.activeId);
            }

            console.log('✅ Supabase sync completed');
        } catch (e) {
            console.error('❌ Supabase sync failed:', e);
            pendingSyncData.current = dataToSync;
            setSyncError('Bulut senkronizasyonu başarısız oldu. Veriniz cihazda saklandı ancak diğer cihazlara henüz ulaşmadı.');
        } finally {
            syncInFlightRef.current = false;

            if (serverReloadQueuedRef.current && user?.id) {
                serverReloadQueuedRef.current = false;
                loadData();
            }

            if (pendingSyncData.current) {
                setTimeout(() => {
                    flushPendingSync();
                }, 300);
            } else {
                setIsSyncing(false);
            }
        }
    };

    const scheduleSync = (data: { portfolios: Portfolio[], activeId: string }, immediate: boolean = false) => {
        pendingSyncData.current = data;

        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
        }

        if (!user?.id) return;

        if (immediate) {
            void flushPendingSync();
            return;
        }

        syncTimeoutRef.current = setTimeout(() => {
            void flushPendingSync();
        }, 150);
    };

    const triggerImmediateSync = async () => {
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
        }
        await flushPendingSync();
    };

    // Listen for app state changes to sync data when app goes to background
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                triggerImmediateSync();
            }
        });
        return () => subscription.remove();
    }, [user?.id]);

    const savePortfolios = (newPortfolios: Portfolio[] | ((prev: Portfolio[]) => Portfolio[]), newActiveId?: string) => {
        if (!isInitialized.current) {
            console.warn('⚠️ Blocked savePortfolios: App is not initialized yet');
            return;
        }

        const activeId = newActiveId || activePortfolioId;

        setPortfolios(prev => {
            const updatedRaw = typeof newPortfolios === 'function' ? newPortfolios(prev) : newPortfolios;

            if (prev.length > 0 && updatedRaw.length === 0) {
                console.error('❌ CRITICAL ERROR: Attempted to save empty portfolio list over non-empty list. Blocking.');
                return prev;
            }

            const updated = updatedRaw.map(p => ({ ...p, updatedAt: Date.now() }));

            void persistLocalState(updated, activeId).catch(e => {
                console.error('❌ Failed to save to local storage:', e);
            });

            scheduleSync({ portfolios: updated, activeId });

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

    const createInitialPortfolio = () => {
        const defaultPortfolio: Portfolio = {
            id: 'default',
            name: 'Ana Portföy',
            color: '#007AFF',
            icon: '💼',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            items: [],
            cashBalance: 0,
            cashItems: [],
            realizedTrades: [],
            dividends: [],
            history: []
        };
        setPortfolios([defaultPortfolio]);
        setActivePortfolioId('default');
        void persistLocalState([defaultPortfolio], 'default').catch(error => {
            console.error('Failed to persist initial portfolio', error);
        });
    };

    // Listen for Web visibility changes
    useEffect(() => {
        if (Platform.OS === 'web' && user?.id) {
            const handleBeforeUnload = () => {
                if (pendingSyncData.current) {
                    // Trigger immediate sync on tab close
                    triggerImmediateSync();
                }
            };

            const handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    triggerImmediateSync();
                }
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }
    }, [user?.id]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const storedPortfolios = await AsyncStorage.getItem('portfolios');
            const storedActiveId = await AsyncStorage.getItem('activePortfolioId');
            const localPortfolios: Portfolio[] = storedPortfolios ? JSON.parse(storedPortfolios) : [];
            const localActiveId = storedActiveId || localPortfolios[0]?.id || '';

            if (user?.id) {
                console.log('📥 loadData: User logged in, fetching from Supabase...');
                try {
                    const supabaseData = await loadUserPortfolios(user.id);
                    const cloudPortfolios = supabaseData.portfolios;

                    if (cloudPortfolios.length > 0) {
                        let finalActiveId = supabaseData.activePortfolioId || localActiveId;
                        if (!cloudPortfolios.some(p => p.id === finalActiveId)) {
                            finalActiveId = cloudPortfolios[0].id;
                        }

                        await applyLoadedState(cloudPortfolios, finalActiveId);
                    } else if (localPortfolios.length > 0) {
                        console.log('📤 loadData: Cloud empty, migrating existing local data to Supabase...');
                        await migrateToSupabase(user.id, localPortfolios, localActiveId);
                        await applyLoadedState(localPortfolios, localActiveId);
                        scheduleSync({ portfolios: localPortfolios, activeId: localActiveId }, true);
                    } else {
                        createInitialPortfolio();
                    }

                    isInitialized.current = true;
                    return;
                } catch (supabaseError) {
                    console.error('❌ loadData: Supabase load error, falling back to local:', supabaseError);
                }
            }

            if (localPortfolios.length > 0) {
                await applyLoadedState(localPortfolios, localActiveId);
            } else {
                createInitialPortfolio();
            }
            isInitialized.current = true;
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setIsLoading(false);
        }
    };

    const debouncedLoadData = () => {
        if (loadDataTimeoutRef.current) clearTimeout(loadDataTimeoutRef.current);
        loadDataTimeoutRef.current = setTimeout(() => {
            void loadData();
        }, 250);
    };

    // Realtime subscription for cross-device sync-complete signal
    useEffect(() => {
        if (!user?.id) return;

        console.log('🔷 Realtime: Subscribing to user_metadata sync signal...');
        const channel = supabase
            .channel(`portfolio_sync_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_metadata',
                    filter: `id=eq.${user.id}`
                },
                () => {
                    if (syncInFlightRef.current) {
                        serverReloadQueuedRef.current = true;
                    } else {
                        console.log('🔄 Realtime: Sync complete signal detected, reloading from server...');
                        debouncedLoadData();
                    }
                }
            )
            .subscribe((status: string) => {
                console.log('📡 Realtime status:', status);
            });

        return () => {
            console.log('🔷 Realtime: Unsubscribing...');
            supabase.removeChannel(channel);
            if (loadDataTimeoutRef.current) clearTimeout(loadDataTimeoutRef.current);
        };
    }, [user?.id]);


    // Multi-portfolio functions
    const createPortfolio = async (name: string, color: string, icon: string, mode: 'standard' | 'unitized' = 'standard', initialPrice: number = 1.0) => {
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
            history: [],
            trackingMode: mode,
            totalUnits: 0,
            initialUnitPrice: initialPrice
        };

        savePortfolios(prev => [...prev, newPortfolio], id);
    };

    const addCapital = async (portfolioId: string, amount: number) => {
        savePortfolios(prev => prev.map(p => {
            if (p.id === portfolioId) {
                const mode = p.trackingMode || 'standard';
                if (mode === 'unitized') {
                    // Calculate current total value to get current unit price
                    // This is a simplified calculation here, might need full aggregation
                    // But we can approximate with previous value or current state
                    const currentTotalValue = ((p.cashItems || []).reduce((sum, ci) => sum + ci.amount, 0)) + 
                        p.items.reduce((sum, item) => {
                            const price = prices[item.instrumentId] || item.averageCost;
                            return sum + (item.amount * price * (item.currency === 'USD' ? currentUsdRate : 1));
                        }, 0);
                    
                    const currentUnits = p.totalUnits || 0;
                    const initialPrice = p.initialUnitPrice || 1.0;
                    
                    let newUnits = 0;
                    if (currentUnits === 0 || currentTotalValue === 0) {
                        newUnits = amount / initialPrice;
                    } else {
                        const unitPrice = currentTotalValue / currentUnits;
                        newUnits = amount / unitPrice;
                    }
                    
                    // Update cash items
                    let updatedCashItems = [...(p.cashItems || [])];
                    const defaultCashIndex = updatedCashItems.findIndex(ci => ci.type === 'cash' && ci.currency === 'TRY');
                    
                    if (defaultCashIndex !== -1) {
                        updatedCashItems[defaultCashIndex] = {
                            ...updatedCashItems[defaultCashIndex],
                            amount: updatedCashItems[defaultCashIndex].amount + amount
                        };
                    } else {
                        updatedCashItems.push({
                            id: Date.now().toString(),
                            type: 'cash',
                            name: 'Nakit (TL)',
                            amount: amount,
                            currency: 'TRY',
                            dateAdded: Date.now()
                        });
                    }
                    
                    return {
                        ...p,
                        cashItems: updatedCashItems,
                        cashBalance: (p.cashBalance || 0) + amount, // Keep for legacy
                        totalUnits: currentUnits + newUnits
                    };
                } else {
                    // Standard portfolio - just update cash
                    let updatedCashItems = [...(p.cashItems || [])];
                    const defaultCashIndex = updatedCashItems.findIndex(ci => ci.type === 'cash' && ci.currency === 'TRY');
                    
                    if (defaultCashIndex !== -1) {
                        updatedCashItems[defaultCashIndex] = {
                            ...updatedCashItems[defaultCashIndex],
                            amount: updatedCashItems[defaultCashIndex].amount + amount
                        };
                    } else {
                        updatedCashItems.push({
                            id: Date.now().toString(),
                            type: 'cash',
                            name: 'Nakit (TL)',
                            amount: amount,
                            currency: 'TRY',
                            dateAdded: Date.now()
                        });
                    }
                    
                    return {
                        ...p,
                        cashItems: updatedCashItems,
                        cashBalance: (p.cashBalance || 0) + amount
                    };
                }
            }
            return p;
        }));
    };

    const deletePortfolio = async (id: string) => {
        console.log('🗑️ Deleting portfolio:', id);

        // Determine new active ID if we're deleting the current one
        let nextActiveId = activePortfolioId;
        if (id === activePortfolioId) {
            const other = portfolios.find(p => p.id !== id);
            nextActiveId = other ? other.id : '';
        }

        savePortfolios(prev => {
            if (prev.length <= 1) {
                Alert.alert('Hata', 'Son kalan portföyü silemezsiniz.');
                return prev;
            }
            return prev.filter(p => p.id !== id);
        }, nextActiveId);
    };

    const switchPortfolio = async (id: string) => {
        setActivePortfolioId(id);
        await persistLocalState(portfolios, id);
        scheduleSync({ portfolios, activeId: id }, true);
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

            return prev.map(p => {
                if (p.id !== targetId) return p;

                const existingCashItems = p.cashItems || [];

                // Merge logic for Money Market Funds
                if (item.type === 'money_market_fund' && item.instrumentId) {
                    const existingIndex = existingCashItems.findIndex(ci =>
                        ci.type === 'money_market_fund' && ci.instrumentId === item.instrumentId
                    );

                    if (existingIndex !== -1) {
                        const existingItem = existingCashItems[existingIndex];
                        const totalUnits = (existingItem.units || 0) + (item.units || 0);
                        const totalAmount = (existingItem.amount || 0) + (item.amount || 0);
                        const avgCost = totalUnits > 0 ? totalAmount / totalUnits : 0;

                        const updatedItem: CashItem = {
                            ...existingItem,
                            amount: totalAmount,
                            units: totalUnits,
                            averageCost: avgCost,
                        };

                        const updatedCashItems = [...existingCashItems];
                        updatedCashItems[existingIndex] = updatedItem;
                        return { ...p, cashItems: updatedCashItems };
                    }
                }

                const newItem: CashItem = {
                    ...item,
                    id: Date.now().toString(),
                    dateAdded: item.dateAdded || Date.now()
                };

                return { ...p, cashItems: [...existingCashItems, newItem] };
            });
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

    const sellCashFund = async (id: string, unitsToSell: number, sellPrice: number, currentUsdRate: number, taxRate?: number, sellDate?: number) => {
        savePortfolios(prev => {
            const ownerPortfolio = prev.find(p => (p.cashItems || []).some(item => item.id === id));
            if (!ownerPortfolio) return prev;

            const fundItem = ownerPortfolio.cashItems.find(item => item.id === id);
            if (!fundItem || fundItem.type !== 'money_market_fund' || !fundItem.units || !fundItem.averageCost) return prev;

            const actualUnitsToSell = Math.min(unitsToSell, fundItem.units);
            const grossValue = actualUnitsToSell * sellPrice;
            const costBasis = actualUnitsToSell * fundItem.averageCost;

            // Calculate gross profit
            let grossProfitTry = grossValue - costBasis;

            // Apply tax (stopaj) if there is a profit and a tax rate is provided
            let taxAmountTry = 0;
            if (grossProfitTry > 0 && taxRate !== undefined) {
                taxAmountTry = grossProfitTry * (taxRate / 100);
            }

            const netProfitTry = grossProfitTry - taxAmountTry;
            const netValue = costBasis + netProfitTry; // Total money returned to cash

            // USD Equivalents (approximate using current rate)
            const costUsd = fundItem.historicalUsdRate ? costBasis / fundItem.historicalUsdRate : costBasis / currentUsdRate;
            const netValueUsd = netValue / currentUsdRate;
            const netProfitUsd = netValueUsd - costUsd;

            const trade: RealizedTrade = {
                id: Date.now().toString(),
                instrumentId: fundItem.instrumentId || fundItem.name,
                amount: actualUnitsToSell,
                sellPrice: sellPrice, // Per unit sell price doesn't reflect tax technically, but we keep it simple
                buyPrice: fundItem.averageCost,
                currency: 'TRY',
                date: sellDate || Date.now(),
                profit: netProfitTry, // Log NET profit for accuracy
                profitUsd: netProfitUsd,
                profitTry: netProfitTry,
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
                    amount: updatedCashItems[defaultCashIndex].amount + netValue
                };
            } else {
                updatedCashItems.push({
                    id: Date.now().toString() + '_cash',
                    type: 'cash',
                    name: 'Nakit (TL)',
                    amount: netValue,
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

    const sellAsset = async (id: string, amountToSell: number, sellPrice: number, sellDate?: number, historicalRate?: number, destinationCashId?: string, taxRate?: number, commissionRate?: number) => {
        savePortfolios(prev => {
            const ownerPortfolio = prev.find(p => p.items.some(item => item.id === id));
            if (!ownerPortfolio) return prev;

            const itemIndex = ownerPortfolio.items.findIndex(p => p.id === id);
            const item = ownerPortfolio.items[itemIndex];

            if (item.amount < amountToSell) return prev;

            const costBasis = item.averageCost * amountToSell;
            const saleProceeds = sellPrice * amountToSell;

            // Apply Commission
            const commissionAmount = commissionRate ? saleProceeds * (commissionRate / 100) : 0;
            const netSaleProceedsAfterCommission = saleProceeds - commissionAmount;

            // Gross profit after commission
            let grossProfit = netSaleProceedsAfterCommission - costBasis;

            // Apply Tax (Stopaj) if defined
            let taxAmount = 0;
            if (grossProfit > 0 && taxRate !== undefined) {
                taxAmount = grossProfit * (taxRate / 100);
            }

            // Net profit and Proceeds
            const netProfit = grossProfit - taxAmount;
            const netProceeds = netSaleProceedsAfterCommission - taxAmount;

            const rateToUse = historicalRate || currentUsdRate;

            let profitUsd = 0;
            let profitTry = 0;
            let proceedsTry = 0;
            let proceedsUsd = 0;

            if (item.currency === 'USD') {
                profitUsd = netProfit;
                profitTry = netProfit * rateToUse;
                proceedsTry = netProceeds * rateToUse;
                proceedsUsd = netProceeds;
            } else {
                profitTry = netProfit;
                profitUsd = netProfit / rateToUse;
                proceedsTry = netProceeds;
                proceedsUsd = netProceeds / rateToUse;
            }

            const trade: RealizedTrade = {
                id: Math.random().toString(36).substr(2, 9),
                instrumentId: item.instrumentId,
                amount: amountToSell,
                sellPrice,
                buyPrice: item.averageCost,
                currency: item.currency,
                date: sellDate || Date.now(),
                profit: netProfit,
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

            if (destinationCashId === 'none') {
                // Do not add proceeds to any cash account
            } else if (destinationCashId && destinationCashId !== 'default') {
                const targetCashIndex = updatedCashItems.findIndex(i => i.id === destinationCashId);

                if (targetCashIndex !== -1) {
                    const targetCash = updatedCashItems[targetCashIndex];
                    let amountToAdd = 0;

                    if (targetCash.currency === 'USD') {
                        amountToAdd = proceedsUsd;
                    } else {
                        amountToAdd = proceedsTry;
                    }

                    updatedCashItems[targetCashIndex] = {
                        ...targetCash,
                        amount: targetCash.amount + amountToAdd
                    };
                } else {
                    // Fallback to default if somehow the ID wasn't found
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
                }
            } else {
                // Default behavior: Auto-deposit to TRY cash
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
        if (portfolio.length === 0 && cashItems.length === 0) return;

        console.log('🔄 Refreshing all prices from Context...');
        const newPrices: Record<string, number> = {};
        const newPriceCurrencies: Record<string, string> = {};
        const newFundPrices: Record<string, number> = {};
        const newDailyChanges: Record<string, number> = {};

        try {
            // Fetch USD/TRY rate
            const rateData = await MarketDataService.getYahooPrice('TRY=X');
            if (rateData && rateData.currentPrice) {
                setCurrentUsdRate(rateData.currentPrice);
                newPrices['TRY=X'] = rateData.currentPrice;
                newPriceCurrencies['TRY=X'] = 'TRY';
            }

            // Fetch regular prices in parallel
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
                    newPriceCurrencies[item.instrumentId] = priceData.currency || (item.type === 'crypto' ? 'USD' : 'TRY');
                    newDailyChanges[item.instrumentId] = (priceData as any).change24h || 0;
                }
            }

            // Fetch Fund Prices for PPF
            const fundItems = cashItems.filter(item => item.type === 'money_market_fund' && item.instrumentId);
            for (const item of fundItems) {
                if (item.instrumentId) {
                    try {
                        const priceResult = await MarketDataService.getTefasPrice(item.instrumentId);
                        if (priceResult && priceResult.currentPrice) {
                            newFundPrices[item.instrumentId] = priceResult.currentPrice;
                        }
                    } catch (e) {
                        console.warn(`Failed to fetch fund price for ${item.instrumentId}`, e);
                    }
                }
            }

            setPrices(prev => ({ ...prev, ...newPrices }));
            setPriceCurrencies(prev => ({ ...prev, ...newPriceCurrencies }));
            setFundPrices(prev => ({ ...prev, ...newFundPrices }));
            setDailyChanges(prev => ({ ...prev, ...newDailyChanges }));
            setLastPricesUpdate(Date.now());
            console.log('✅ All prices (including funds) refreshed in Context');
        } catch (e) {
            console.error('❌ Failed to refresh all prices:', e);
        }
    };

    // Centralized Calculation for Total Value
    useEffect(() => {
        if (Object.keys(prices).length === 0 && portfolio.length > 0) return;

        let calcTotalTry = 0;
        let calcTotalUsd = 0;
        let calcCostBasisTry = 0;
        let calcDailyProfit = 0;

        // Calculate Portfolio Items
        portfolio.forEach(item => {
            let price = item.customCurrentPrice || prices[item.instrumentId] || 0;
            const priceCurrency = item.customCurrentPrice
                ? item.currency
                : (priceCurrencies[item.instrumentId] || (item.type === 'crypto' ? 'USD' : 'TRY'));
            const changePercent = dailyChanges[item.instrumentId] || 0;

            // Normalize price to item's currency
            if (priceCurrency !== item.currency && price > 0) {
                if (priceCurrency === 'USD' && item.currency === 'TRY') {
                    price = price * (currentUsdRate || 1);
                } else if (priceCurrency === 'TRY' && item.currency === 'USD') {
                    price = price / (currentUsdRate || 1);
                }
            }


            let value = item.amount * price;
            if (item.type === 'bes') {
                value = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
            }

            if (item.currency === 'USD') {
                const valueTry = value * (currentUsdRate || 1);
                calcTotalTry += valueTry;
                calcTotalUsd += value;
                calcCostBasisTry += item.amount * item.averageCost * (currentUsdRate || 1);
                calcDailyProfit += valueTry * (changePercent / 100);
            } else {
                calcTotalTry += value;
                calcTotalUsd += value / (currentUsdRate || 1);
                calcCostBasisTry += item.amount * item.averageCost;
                calcDailyProfit += value * (changePercent / 100);
            }
        });

        // Calculate Cash Items (Nakit + PPF)
        cashItems.forEach(item => {
            let itemValue = item.amount;

            // PPF Live Valuation
            if (item.type === 'money_market_fund' && item.units && item.instrumentId) {
                const livePrice = fundPrices[item.instrumentId];
                if (livePrice) {
                    itemValue = item.units * livePrice;
                }
            }

            if (item.currency === 'USD') {
                const itemValueTry = itemValue * (currentUsdRate || 1);
                calcTotalTry += itemValueTry;
                calcTotalUsd += itemValue;
                calcCostBasisTry += item.amount * (currentUsdRate || 1);
            } else {
                calcTotalTry += itemValue;
                calcTotalUsd += itemValue / (currentUsdRate || 1);
                calcCostBasisTry += item.amount;
            }
        });

        // Update Context States
        setTotalValueTry(calcTotalTry);
        setTotalValueUsd(calcTotalUsd);
        setTotalCostBasisTry(calcCostBasisTry);
        setDailyProfit(calcDailyProfit);

        // Update History Tracking
        updateTotalValue(calcTotalTry, calcTotalUsd);

    }, [portfolio, cashItems, prices, fundPrices, currentUsdRate]);

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
            console.log('📥 Importing data...', newPortfolios.length, 'portfolios');
            
            // Ensure each portfolio has an updatedAt
            const now = Date.now();
            const prepared = newPortfolios.map(p => ({
                ...p,
                updatedAt: p.updatedAt || now
            }));
            
            savePortfolios(prepared, newActivePortfolioId);
            
            // The useEffect and derive logic will handle the rest
            console.log('✅ Import successful');
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
            let livePrice = prices[item.instrumentId] || item.customCurrentPrice || item.averageCost;
            const priceCurrency = item.customCurrentPrice
                ? item.currency
                : (priceCurrencies[item.instrumentId] || (item.type === 'crypto' ? 'USD' : 'TRY'));

            // Normalize price to item's currency
            if (priceCurrency !== item.currency && livePrice > 0) {
                if (priceCurrency === 'USD' && item.currency === 'TRY') {
                    livePrice = livePrice * (currentUsdRate || 1);
                } else if (priceCurrency === 'TRY' && item.currency === 'USD') {
                    livePrice = livePrice / (currentUsdRate || 1);
                }
            }

            let value = item.amount * livePrice;

            if (item.currency === 'USD') {
                value = value * (currentUsdRate || 1);
            }

            if (item.type === 'bes') {
                value = (item.besPrincipal || 0) + (item.besStateContrib || 0) + (item.besStateContribYield || 0) + (item.besPrincipalYield || 0);
            }

            // Detailed Categorization Logic
            let category = 'Diğer';
            const id = item.instrumentId.toUpperCase();

            if (item.customCategory) {
                category = item.customCategory;
            } else if (item.type === 'crypto' || ['BTC', 'ETH', 'SOL', 'AVAX', 'USDT', 'USDC', 'BNB', 'WLD', 'WORLDCOIN-WLD'].includes(id)) {
                category = 'Kripto';
            } else if (id.includes('GOLD') || ['GRAM', 'CEYREK', 'YARIM', 'TAM', 'ONS'].includes(id)) {
                category = 'Altın';
            } else if (id.includes('SILVER') || id.includes('GUMUS') || item.type === 'metal') {
                category = 'Gümüş';
            } else if (id.endsWith('.IS')) {
                category = 'Hisse (BIST)';
            } else if (id.startsWith('BES') || item.type === 'bes') {
                category = 'BES';
            } else if (item.currency === 'USD' && (item.type === 'stock' || ['VOO', 'QQQ', 'SPY', 'VTI', 'SCHD', 'JEPI', 'ARKK', 'SCHG', 'OPTGY', 'OPT25'].includes(id))) {
                category = 'ABD ETF';
            } else if (item.type === 'fund' || (id.length === 3 && !['BTC', 'ETH', 'SOL', 'XRP', 'USD', 'EUR', 'GBP'].includes(id))) {
                category = 'Fon';
            } else if (item.type === 'forex' || ['USD', 'EUR', 'GBP', 'RUB', 'JPY'].includes(id)) {
                category = 'Döviz';
            }

            typeMap[category] = (typeMap[category] || 0) + value;
        });

        // Add cash items (includes PPF)
        cashItems.forEach(item => {
            let itemValue = item.amount;

            // PPF Live Valuation
            if (item.type === 'money_market_fund' && item.units && item.instrumentId) {
                const livePrice = fundPrices[item.instrumentId];
                if (livePrice) {
                    itemValue = item.units * livePrice;
                }
            }

            if (item.currency === 'USD') {
                itemValue = itemValue * (currentUsdRate || 1);
            }

            const label = 'Yedek Akçe';
            typeMap[label] = (typeMap[label] || 0) + itemValue;
        });


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
            case 'ABD ETF': return '#5856D6';
            case 'Kripto': return '#FF9500';
            case 'Altın': return '#FFD700';
            case 'Gümüş': return '#C0C0C0';
            case 'Döviz': return '#34C759';
            case 'Fon': return '#FF2D55';
            case 'BES': return '#AF52DE';
            case 'Yedek Akçe':
            case 'Nakit':
            case 'Yatırım Fonu': return '#8E8E93';
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
            totalCostBasisTry,
            dailyProfit,
            totalRealizedProfitTry,
            totalRealizedProfitUsd,
            dividends,
            totalDividendsTry,
            totalDividendsUsd,
            isLoading,
            addCapital,
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
            fundPrices,
            priceCurrencies,
            lastPricesUpdate,
            currentUsdRate,
            addDividend,
            updateDividend,
            deleteDividend,
            updatePortfolioTarget,
            deleteRealizedTrade,
            updatePortfolioCash,
            isSyncing,
            syncError,
            lastSyncAt
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
