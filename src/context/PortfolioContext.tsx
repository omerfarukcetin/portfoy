import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PortfolioItem, Instrument, CashItem, RealizedTrade, Portfolio } from '../types';
import { MarketDataService } from '../services/marketData';
import { useAuth } from './AuthContext';
import { saveUserPortfolios, loadUserPortfolios, migrateToFirestore } from '../services/firestoreService';

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
    addToPortfolio: (instrument: Instrument, amount: number, cost: number, currency: 'USD' | 'TRY', date: number, historicalUsdRate?: number, besData?: { principal: number, stateContrib: number, stateContribYield: number, principalYield: number }, customCategory?: string, customData?: { name?: string, currentPrice?: number }) => Promise<void>;
    addAsset: (asset: Omit<PortfolioItem, 'id'>) => Promise<void>;
    updateAsset: (id: string, newAmount: number, newAverageCost: number, newDate?: number, historicalUsdRate?: number, besData?: { besPrincipal: number, besPrincipalYield: number }) => Promise<void>;
    sellAsset: (id: string, amount: number, sellPrice: number, sellDate?: number, historicalRate?: number) => Promise<void>;
    deleteAsset: (id: string) => Promise<void>;
    removeFromPortfolio: (id: string) => Promise<void>;

    // Cash management functions
    addCashItem: (item: Omit<CashItem, 'id'>) => Promise<void>;
    updateCashItem: (id: string, amount: number) => Promise<void>;
    deleteCashItem: (id: string) => Promise<void>;
    updateCash: (amount: number) => Promise<void>;

    // Other functions
    refreshPrices: () => Promise<void>;
    updateTotalValue: (valTry: number, valUsd: number) => void;
    resetData: () => Promise<void>;
    clearHistory: () => Promise<void>;
    importData: (portfolios: Portfolio[], activePortfolioId: string) => Promise<void>;
    getPortfolioTotalValue: () => number;
    getPortfolioDistribution: () => { name: string; value: number; color: string }[];
    refreshAllPrices: () => Promise<void>;
}

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
    const activePortfolio = portfolios.find(p => p.id === activePortfolioId) || null;

    // Sync legacy state ONLY when switching portfolios (not on data changes)
    useEffect(() => {
        const currentPortfolio = portfolios.find(p => p.id === activePortfolioId);
        if (currentPortfolio) {
            console.log('🔄 Portfolio sync - updating state for:', activePortfolioId, 'items:', currentPortfolio.items.length);
            setPortfolio(currentPortfolio.items);
            setRealizedTrades(currentPortfolio.realizedTrades);
            setHistory(currentPortfolio.history || []);
            setCashItems(currentPortfolio.cashItems);
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
    }, [user?.uid]);

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

    const savePortfolios = async (newPortfolios: Portfolio[], newActiveId?: string) => {
        const activeId = newActiveId || activePortfolioId;
        try {
            console.log('💾 Saving portfolios to storage...');
            // Always save to AsyncStorage as backup
            await AsyncStorage.setItem('portfolios', JSON.stringify(newPortfolios));
            await AsyncStorage.setItem('activePortfolioId', activeId);
            setPortfolios(newPortfolios);

            // If user is logged in, sync to Firestore
            if (user?.uid) {
                console.log('☁️ Syncing specific active portfolio to Firestore:', activeId);
                await saveUserPortfolios(user.uid, newPortfolios, activeId);
                console.log('✅ Firestore sync completed successfully');
            } else {
                console.log('⚠️ User not logged in, skipping Firestore sync');
            }
        } catch (e) {
            console.error('❌ Failed to save portfolios:', e);
            // Only show alert for critical errors to avoid spamming
            // if (Platform.OS === 'web') {
            //     console.error('Web save error details:', e);
            //     window.alert('Veriler kaydedilirken bir hata oluştu! Lütfen internet bağlantınızı kontrol edin.');
            // }
        }
    };

    const updateActivePortfolio = async (updates: Partial<Portfolio>) => {
        if (!activePortfolio) return;

        // Update local state FIRST for immediate UI feedback
        if (updates.items !== undefined) {
            setPortfolio(updates.items);
            console.log('✅ Portfolio items updated immediately - count:', updates.items.length);
        }
        if (updates.realizedTrades !== undefined) {
            setRealizedTrades(updates.realizedTrades);
            console.log('✅ Realized trades updated - count:', updates.realizedTrades.length);
        }
        if (updates.history !== undefined) {
            setHistory(updates.history);
        }
        if (updates.cashItems !== undefined) {
            setCashItems(updates.cashItems);
            console.log('✅ Cash items updated - count:', updates.cashItems.length);
        }

        // Then save to storage (async, won't block UI)
        const updatedPortfolio = { ...activePortfolio, ...updates };
        const newPortfolios = portfolios.map(p =>
            p.id === activePortfolioId ? updatedPortfolio : p
        );

        await savePortfolios(newPortfolios);
    };

    const loadData = async () => {
        try {
            setIsLoading(true);
            console.log('📥 loadData: Starting...');

            // If user is logged in, try to load from Firestore first
            if (user?.uid) {
                console.log('📥 loadData: User logged in, trying Firestore:', user.uid);
                try {
                    const firestoreData = await loadUserPortfolios(user.uid);
                    console.log('📥 loadData: Firestore returned', firestoreData.portfolios.length, 'portfolios');

                    if (firestoreData.portfolios.length > 0) {
                        // User has data in Firestore
                        const portfolio = firestoreData.portfolios.find(p => p.id === (firestoreData.activePortfolioId || firestoreData.portfolios[0].id));
                        console.log('📥 loadData: Active portfolio has', portfolio?.items?.length || 0, 'items');

                        setPortfolios(firestoreData.portfolios);
                        setActivePortfolioId(firestoreData.activePortfolioId || firestoreData.portfolios[0].id);
                        console.log('✅ loadData: Loaded portfolios from Firestore');
                        return;
                    } else {
                        console.log('📥 loadData: No Firestore data, checking AsyncStorage...');
                        // Check if there's local data to migrate
                        const storedPortfolios = await AsyncStorage.getItem('portfolios');
                        if (storedPortfolios) {
                            const parsedPortfolios = JSON.parse(storedPortfolios);
                            const storedActiveId = await AsyncStorage.getItem('activePortfolioId');
                            console.log('📥 loadData: Found AsyncStorage data with', parsedPortfolios.length, 'portfolios');

                            // Migrate to Firestore
                            await migrateToFirestore(user.uid, parsedPortfolios, storedActiveId || 'default');
                            setPortfolios(parsedPortfolios);
                            setActivePortfolioId(storedActiveId || parsedPortfolios[0]?.id || 'default');
                            console.log('✅ loadData: Migrated local data to Firestore');
                            return;
                        }
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
                        history: []
                    };
                    await savePortfolios([defaultPortfolio], 'default');
                    setActivePortfolioId('default');
                    return;
                } catch (firestoreError) {
                    console.error('❌ loadData: Firestore load error, falling back to local:', firestoreError);
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
    }, [user?.uid]);

    // Multi-portfolio functions
    const createPortfolio = async (name: string, color: string, icon: string) => {
        const newPortfolio: Portfolio = {
            id: Date.now().toString(),
            name,
            color,
            icon,
            createdAt: Date.now(),
            items: [],
            cashBalance: 0,
            cashItems: [],
            realizedTrades: [],
            history: []
        };

        const newPortfolios = [...portfolios, newPortfolio];
        await savePortfolios(newPortfolios);

        // Switch to new portfolio
        setActivePortfolioId(newPortfolio.id);
        await AsyncStorage.setItem('activePortfolioId', newPortfolio.id);
    };

    const deletePortfolio = async (id: string) => {
        if (portfolios.length <= 1) {
            alert('En az bir portföy olmalıdır.');
            return;
        }

        const newPortfolios = portfolios.filter(p => p.id !== id);
        await savePortfolios(newPortfolios);

        // If we deleted the active portfolio, switch to the first one
        if (id === activePortfolioId) {
            const firstId = newPortfolios[0].id;
            setActivePortfolioId(firstId);
            await AsyncStorage.setItem('activePortfolioId', firstId);
        }
    };

    const switchPortfolio = async (id: string) => {
        if (portfolios.find(p => p.id === id)) {
            setActivePortfolioId(id);
            await AsyncStorage.setItem('activePortfolioId', id);
        }
    };

    const renamePortfolio = async (id: string, newName: string) => {
        const newPortfolios = portfolios.map(p =>
            p.id === id ? { ...p, name: newName } : p
        );
        await savePortfolios(newPortfolios);
    };

    const updatePortfolioColor = async (id: string, color: string) => {
        const newPortfolios = portfolios.map(p =>
            p.id === id ? { ...p, color } : p
        );
        await savePortfolios(newPortfolios);
    };

    const updatePortfolioIcon = async (id: string, icon: string) => {
        const newPortfolios = portfolios.map(p =>
            p.id === id ? { ...p, icon } : p
        );
        await savePortfolios(newPortfolios);
    };

    // Cash Management Functions
    const addCashItem = async (item: Omit<CashItem, 'id'>) => {
        const newItem: CashItem = {
            ...item,
            id: Date.now().toString(),
            dateAdded: Date.now()
        };
        const newCashItems = [...cashItems, newItem];
        await updateActivePortfolio({ cashItems: newCashItems });
    };

    const updateCashItem = async (id: string, amount: number) => {
        const newCashItems = cashItems.map(item =>
            item.id === id ? { ...item, amount } : item
        );
        await updateActivePortfolio({ cashItems: newCashItems });
    };

    const deleteCashItem = async (id: string) => {
        const newCashItems = cashItems.filter(item => item.id !== id);
        await updateActivePortfolio({ cashItems: newCashItems });
    };

    const updateCash = async (amount: number) => {
        let defaultCash = cashItems.find(item => item.type === 'cash' && item.currency === 'TRY');

        if (defaultCash) {
            const newAmount = defaultCash.amount + amount;
            // Prevent negative balance
            if (newAmount < 0) {
                console.log('⚠️ Cannot deduct more than available cash balance');
                return;
            }
            await updateCashItem(defaultCash.id, newAmount);
            console.log('💰 Cash updated:', defaultCash.amount, '+', amount, '=', newAmount);
        } else if (amount > 0) {
            // Only create new cash item for positive amounts
            await addCashItem({
                type: 'cash',
                name: 'Nakit (TL)',
                amount: amount,
                currency: 'TRY'
            });
            console.log('💰 New cash item created with amount:', amount);
        } else {
            console.log('⚠️ No existing cash item to deduct from');
        }
    };

    // Portfolio Functions
    const addAsset = async (asset: Omit<PortfolioItem, 'id'>) => {
        const newItem = { ...asset, id: Date.now().toString() };
        const newPortfolio = [...portfolio, newItem];
        await updateActivePortfolio({ items: newPortfolio });
    };

    const updateAsset = async (
        id: string,
        newAmount: number,
        newAverageCost: number,
        newDate?: number,
        historicalUsdRate?: number,
        besData?: { besPrincipal: number, besPrincipalYield: number }
    ) => {
        const updatedPortfolio = portfolio.map(item => {
            if (item.id === id) {
                const updates: Partial<PortfolioItem> = {
                    amount: newAmount,
                    averageCost: newAverageCost
                };

                // Handle BES-specific updates
                if (besData) {
                    updates.besPrincipal = besData.besPrincipal;
                    updates.besPrincipalYield = besData.besPrincipalYield;
                    updates.besStateContrib = 0;
                    updates.besStateContribYield = 0;
                    updates.averageCost = besData.besPrincipal; // Cost is principal for BES
                }

                // Update date if provided
                if (newDate) {
                    updates.dateAdded = newDate;
                }

                // Recalculate original costs if historical rate is provided
                if (historicalUsdRate) {
                    const rateToUse = historicalUsdRate;
                    if (item.currency === 'USD') {
                        updates.originalCostUsd = newAverageCost * newAmount;
                        updates.originalCostTry = newAverageCost * newAmount * rateToUse;
                    } else {
                        updates.originalCostTry = newAverageCost * newAmount;
                        updates.originalCostUsd = newAverageCost * newAmount / rateToUse;
                    }
                }

                return { ...item, ...updates };
            }
            return item;
        });
        await updateActivePortfolio({ items: updatedPortfolio });
    };

    const deleteAsset = async (id: string) => {
        console.log('🗑️ deleteAsset called for id:', id);
        console.log('📊 Current portfolio count:', portfolio.length);
        const updatedPortfolio = portfolio.filter(item => item.id !== id);
        console.log('📊 New portfolio count:', updatedPortfolio.length);
        await updateActivePortfolio({ items: updatedPortfolio });
        console.log('✅ deleteAsset completed');
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
        customData?: { name?: string, currentPrice?: number }
    ) => {
        const rateToUse = historicalUsdRate || currentUsdRate;
        const instrumentId = instrument.instrumentId || instrument.id;

        // Check if the same instrument already exists in portfolio (by instrumentId and type)
        // BES and custom assets should not be merged
        const existingIndex = (instrument.type !== 'bes' && !customCategory)
            ? portfolio.findIndex(item =>
                item.instrumentId === instrumentId &&
                item.type === instrument.type &&
                item.currency === currency
            )
            : -1;

        let newPortfolio = [...portfolio];

        if (existingIndex !== -1) {
            // Merge with existing item using weighted average cost
            const existing = portfolio[existingIndex];
            const totalAmount = existing.amount + amount;

            // Weighted average cost: (oldAmount * oldCost + newAmount * newCost) / totalAmount
            const weightedAverageCost = ((existing.amount * existing.averageCost) + (amount * cost)) / totalAmount;

            // Recalculate original costs
            let totalOriginalCostUsd = 0;
            let totalOriginalCostTry = 0;

            if (currency === 'USD') {
                const newCostUsd = cost * amount;
                const newCostTry = cost * amount * rateToUse;
                totalOriginalCostUsd = (existing.originalCostUsd || 0) + newCostUsd;
                totalOriginalCostTry = (existing.originalCostTry || 0) + newCostTry;
            } else {
                const newCostTry = cost * amount;
                const newCostUsd = cost * amount / rateToUse;
                totalOriginalCostTry = (existing.originalCostTry || 0) + newCostTry;
                totalOriginalCostUsd = (existing.originalCostUsd || 0) + newCostUsd;
            }

            // Update the existing item
            newPortfolio[existingIndex] = {
                ...existing,
                amount: totalAmount,
                averageCost: weightedAverageCost,
                originalCostUsd: totalOriginalCostUsd,
                originalCostTry: totalOriginalCostTry,
                // Keep the original dateAdded (first purchase date)
            };

            console.log(`✅ Merged ${instrument.symbol}: ${existing.amount} + ${amount} = ${totalAmount} @${weightedAverageCost.toFixed(2)} `);
        } else {
            // Add as new item
            let originalCostUsd = 0;
            let originalCostTry = 0;

            if (currency === 'USD') {
                originalCostUsd = cost * amount;
                originalCostTry = cost * amount * rateToUse;
            } else {
                originalCostTry = cost * amount;
                originalCostUsd = cost * amount / rateToUse;
            }

            const newItem: PortfolioItem = {
                id: Date.now().toString(),
                instrumentId,
                amount,
                averageCost: cost,
                currency,
                originalCostUsd,
                originalCostTry,
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

            newPortfolio.push(newItem);
            console.log(`✅ Added new ${instrument.symbol}: ${amount} @${cost} `);
        }

        await updateActivePortfolio({ items: newPortfolio });
    };

    const sellAsset = async (id: string, amountToSell: number, sellPrice: number, sellDate?: number, historicalRate?: number) => {
        console.log('🔴 sellAsset called:', { id, amountToSell, sellPrice, sellDate, historicalRate });

        const itemIndex = portfolio.findIndex(p => p.id === id);
        if (itemIndex === -1) {
            console.log('❌ Item not found in portfolio');
            return;
        }

        const item = portfolio[itemIndex];
        console.log('✅ Found item:', item);

        if (item.amount < amountToSell) {
            console.log('❌ Not enough amount to sell');
            return;
        }

        const costBasis = item.averageCost * amountToSell;
        const saleProceeds = sellPrice * amountToSell;
        const profit = saleProceeds - costBasis;

        // Use historical rate if provided, otherwise use current rate
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
            type: item.type // Store asset type for category grouping
        };

        console.log('💰 Created trade:', trade);

        let newPortfolio = [...portfolio];
        if (item.amount === amountToSell) {
            newPortfolio.splice(itemIndex, 1);
            console.log('🗑️ Removed item completely');
        } else {
            newPortfolio[itemIndex] = {
                ...item,
                amount: item.amount - amountToSell
            };
            console.log('📉 Reduced amount:', newPortfolio[itemIndex].amount);
        }

        // Update both portfolio items and realized trades atomically (including cash)
        if (activePortfolio) {
            console.log('📝 Updating active portfolio...');

            // Calculate updated cash items BEFORE saving to avoid race condition
            let updatedCashItems = [...activePortfolio.cashItems];
            const defaultCashIndex = updatedCashItems.findIndex(
                item => item.type === 'cash' && item.currency === 'TRY'
            );

            if (defaultCashIndex !== -1) {
                // Update existing cash item
                updatedCashItems[defaultCashIndex] = {
                    ...updatedCashItems[defaultCashIndex],
                    amount: updatedCashItems[defaultCashIndex].amount + proceedsTry
                };
            } else {
                // Create new cash item
                updatedCashItems.push({
                    id: Date.now().toString(),
                    type: 'cash',
                    name: 'Nakit (TL)',
                    amount: proceedsTry,
                    currency: 'TRY',
                    dateAdded: Date.now()
                });
            }

            const updatedPortfolio = {
                ...activePortfolio,
                items: newPortfolio,
                realizedTrades: [...realizedTrades, trade],
                cashItems: updatedCashItems
            };

            console.log('📊 New realized trades count:', updatedPortfolio.realizedTrades.length);
            console.log('💵 Updated cash items:', updatedCashItems);

            const newPortfolios = portfolios.map(p =>
                p.id === activePortfolioId ? updatedPortfolio : p
            );

            try {
                await savePortfolios(newPortfolios);
                console.log('✅ Portfolios saved to AsyncStorage');

                // Manually update local state (useEffect only runs on portfolio switch)
                setPortfolio(newPortfolio);
                setRealizedTrades([...realizedTrades, trade]);
                setCashItems(updatedCashItems);
                console.log('✅ Local state updated - portfolio count:', newPortfolio.length);
                console.log('💵 Cash updated:', proceedsTry);
            } catch (error) {
                console.error('❌ Error saving portfolios:', error);
                throw error;
            }
        } else {
            console.log('❌ No active portfolio found!');
        }
    };

    const removeFromPortfolio = async (id: string) => {
        const updatedPortfolio = portfolio.filter(item => item.id !== id);
        await updateActivePortfolio({ items: updatedPortfolio });
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
    const totalRealizedProfitUsd = realizedTrades.reduce((sum, t) => sum + t.profitUsd, 0);

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
            currentUsdRate
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
