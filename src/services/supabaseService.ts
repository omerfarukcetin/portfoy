import { supabase } from './supabaseClient';
import { Portfolio, PortfolioItem, CashItem, RealizedTrade, Dividend } from '../types';

/**
 * Save all portfolios for a user to Supabase
 */
export const saveUserPortfolios = async (
    userId: string,
    portfolios: Portfolio[],
    activePortfolioId: string
): Promise<void> => {
    try {
        console.log(`🔷 Supabase: Saving ${portfolios.length} portfolios for user ${userId}`);

        // 1. Update or insert user metadata
        const { error: metaError } = await supabase
            .from('user_metadata')
            .upsert({
                id: userId,
                active_portfolio_id: activePortfolioId,
                updated_at: new Date().toISOString()
            });

        if (metaError) {
            console.error('❌ Error saving user metadata:', metaError);
            throw metaError;
        }

        // 2. Get existing IDs for efficient pruning
        const [
            { data: existingPortfolios },
            { data: existingItems },
            { data: existingCash },
            { data: existingTrades },
            { data: existingDividends }
        ] = await Promise.all([
            supabase.from('portfolios').select('id').eq('user_id', userId),
            supabase.from('portfolio_items').select('id, portfolio_id').eq('user_id', userId),
            supabase.from('cash_items').select('id, portfolio_id').eq('user_id', userId),
            supabase.from('realized_trades').select('id, portfolio_id').eq('user_id', userId),
            supabase.from('dividends').select('id, portfolio_id').eq('user_id', userId),
        ]);

        const incomingPortfolioIds = new Set(portfolios.map(p => p.id));
        const portfolioIdsToDelete = (existingPortfolios || [])
            .filter(p => !incomingPortfolioIds.has(p.id))
            .map(p => p.id);

        // 3. Global Bulk Delete for removed portfolios
        if (portfolioIdsToDelete.length > 0) {
            console.log('🔷 Bulking pruning data for deleted portfolios:', portfolioIdsToDelete);
            await Promise.all([
                supabase.from('portfolio_items').delete().in('portfolio_id', portfolioIdsToDelete).eq('user_id', userId),
                supabase.from('cash_items').delete().in('portfolio_id', portfolioIdsToDelete).eq('user_id', userId),
                supabase.from('realized_trades').delete().in('portfolio_id', portfolioIdsToDelete).eq('user_id', userId),
                supabase.from('dividends').delete().in('portfolio_id', portfolioIdsToDelete).eq('user_id', userId),
                supabase.from('portfolio_history').delete().in('portfolio_id', portfolioIdsToDelete).eq('user_id', userId),
            ]);
            await supabase.from('portfolios').delete().in('id', portfolioIdsToDelete).eq('user_id', userId);
        }

        // 4. Component-level pruning (items, cash, etc. within existing portfolios)
        const allIncomingItemIds = new Set(portfolios.flatMap(p => p.items.map(i => i.id)));
        const allIncomingCashIds = new Set(portfolios.flatMap(p => (p.cashItems || []).map(i => i.id)));
        const allIncomingTradeIds = new Set(portfolios.flatMap(p => (p.realizedTrades || []).map(i => i.id)));
        const allIncomingDividendIds = new Set(portfolios.flatMap(p => (p.dividends || []).map(i => i.id)));

        const itemsToDelete = (existingItems || [])
            .filter(i => incomingPortfolioIds.has(i.portfolio_id) && !allIncomingItemIds.has(i.id))
            .map(i => i.id);
        const cashToDelete = (existingCash || [])
            .filter(i => incomingPortfolioIds.has(i.portfolio_id) && !allIncomingCashIds.has(i.id))
            .map(i => i.id);
        const tradesToDelete = (existingTrades || [])
            .filter(i => incomingPortfolioIds.has(i.portfolio_id) && !allIncomingTradeIds.has(i.id))
            .map(i => i.id);
        const dividendsToDelete = (existingDividends || [])
            .filter(i => incomingPortfolioIds.has(i.portfolio_id) && !allIncomingDividendIds.has(i.id))
            .map(i => i.id);

        if (itemsToDelete.length > 0) await supabase.from('portfolio_items').delete().in('id', itemsToDelete).eq('user_id', userId);
        if (cashToDelete.length > 0) await supabase.from('cash_items').delete().in('id', cashToDelete).eq('user_id', userId);
        if (tradesToDelete.length > 0) await supabase.from('realized_trades').delete().in('id', tradesToDelete).eq('user_id', userId);
        if (dividendsToDelete.length > 0) await supabase.from('dividends').delete().in('id', dividendsToDelete).eq('user_id', userId);

        // 5. Batch Upsert EVERYTHING
        const portfolioUpserts = portfolios.map(p => ({
            id: p.id,
            user_id: userId,
            name: p.name,
            color: p.color,
            icon: p.icon,
            created_at: p.createdAt,
            cash_balance: p.cashBalance || 0,
            target_value_try: p.targetValueTry,
            target_currency: p.targetCurrency,
            updated_at: new Date().toISOString()
        }));
        await supabase.from('portfolios').upsert(portfolioUpserts);

        const allItems = portfolios.flatMap(p => (p.items || []).map(item => ({
            id: item.id,
            portfolio_id: p.id,
            user_id: userId,
            instrument_id: item.instrumentId,
            amount: item.amount,
            average_cost: item.averageCost,
            currency: item.currency,
            original_cost_usd: item.originalCostUsd,
            original_cost_try: item.originalCostTry,
            date_added: item.dateAdded,
            type: item.type,
            bes_principal: item.besPrincipal,
            bes_state_contrib: item.besStateContrib,
            bes_state_contrib_yield: item.besStateContribYield,
            bes_principal_yield: item.besPrincipalYield,
            custom_category: item.customCategory,
            custom_name: item.customName,
            custom_current_price: item.customCurrentPrice
        })));
        if (allItems.length > 0) await supabase.from('portfolio_items').upsert(allItems);

        const allCashItems = portfolios.flatMap(p => (p.cashItems || []).map(item => ({
            id: item.id,
            portfolio_id: p.id,
            user_id: userId,
            type: item.type,
            name: item.name,
            amount: item.amount,
            currency: item.currency,
            interest_rate: item.interestRate,
            date_added: item.dateAdded,
            instrument_id: item.instrumentId,
            units: item.units,
            average_cost: item.averageCost,
            historical_usd_rate: item.historicalUsdRate
        })));
        if (allCashItems.length > 0) await supabase.from('cash_items').upsert(allCashItems);

        const allTrades = portfolios.flatMap(p => (p.realizedTrades || []).map(trade => ({
            id: trade.id,
            portfolio_id: p.id,
            user_id: userId,
            instrument_id: trade.instrumentId,
            amount: trade.amount,
            sell_price: trade.sellPrice,
            buy_price: trade.buyPrice,
            currency: trade.currency,
            date: trade.date,
            profit: trade.profit,
            profit_usd: trade.profitUsd,
            profit_try: trade.profitTry,
            type: trade.type
        })));
        if (allTrades.length > 0) await supabase.from('realized_trades').upsert(allTrades);

        const allDividends = portfolios.flatMap(p => (p.dividends || []).map(div => ({
            id: div.id,
            portfolio_id: p.id,
            user_id: userId,
            instrument_id: div.instrumentId,
            amount: div.amount,
            net_amount: div.netAmount,
            currency: div.currency,
            date: div.date,
            shares_at_date: div.sharesAtDate
        })));
        if (allDividends.length > 0) await supabase.from('dividends').upsert(allDividends);

        const allHistory = portfolios.flatMap(p => (p.history || []).map(h => ({
            portfolio_id: p.id,
            user_id: userId,
            date: h.date,
            value_try: h.valueTry,
            value_usd: h.valueUsd
        })));
        if (allHistory.length > 0) {
            await supabase.from('portfolio_history').upsert(allHistory, {
                onConflict: 'portfolio_id,user_id,date'
            });
        }

        console.log('✅ Portfolios successfully saved to Supabase');
    } catch (error) {
        console.error('❌ Error saving portfolios to Supabase:', error);
        throw error;
    }
};

/**
 * Load all portfolios for a user from Supabase
 */
export const loadUserPortfolios = async (userId: string): Promise<{ portfolios: Portfolio[], activePortfolioId: string }> => {
    try {
        console.log(`📥 Supabase: Loading portfolios for user ${userId}`);

        // 1. Get user metadata
        const { data: metaData } = await supabase
            .from('user_metadata')
            .select('active_portfolio_id')
            .eq('id', userId)
            .single();

        const activePortfolioId = metaData?.active_portfolio_id || '';

        // 2. Get all portfolios
        const { data: portfoliosData, error: portfoliosError } = await supabase
            .from('portfolios')
            .select('*')
            .eq('user_id', userId);

        if (portfoliosError) {
            console.error('❌ Error loading portfolios:', portfoliosError);
            throw portfoliosError;
        }

        if (!portfoliosData || portfoliosData.length === 0) {
            console.log('📥 Supabase: No portfolios found');
            return { portfolios: [], activePortfolioId: '' };
        }

        // 3. Load related data for each portfolio
        const portfolios: Portfolio[] = [];

        for (const p of portfoliosData) {
            // Load items
            const { data: itemsData } = await supabase
                .from('portfolio_items')
                .select('*')
                .eq('portfolio_id', p.id)
                .eq('user_id', userId);

            // Load cash items
            const { data: cashData } = await supabase
                .from('cash_items')
                .select('*')
                .eq('portfolio_id', p.id)
                .eq('user_id', userId);

            // Load realized trades
            const { data: tradesData } = await supabase
                .from('realized_trades')
                .select('*')
                .eq('portfolio_id', p.id)
                .eq('user_id', userId);

            // Load dividends
            const { data: dividendsData } = await supabase
                .from('dividends')
                .select('*')
                .eq('portfolio_id', p.id)
                .eq('user_id', userId);

            // Load history
            const { data: historyData } = await supabase
                .from('portfolio_history')
                .select('*')
                .eq('portfolio_id', p.id)
                .eq('user_id', userId)
                .order('date', { ascending: true });

            // Map database fields to TypeScript types
            const items: PortfolioItem[] = (itemsData || []).map(item => ({
                id: item.id,
                instrumentId: item.instrument_id,
                amount: Number(item.amount),
                averageCost: Number(item.average_cost),
                currency: item.currency,
                originalCostUsd: item.original_cost_usd ? Number(item.original_cost_usd) : undefined,
                originalCostTry: item.original_cost_try ? Number(item.original_cost_try) : undefined,
                dateAdded: item.date_added,
                type: item.type,
                besPrincipal: item.bes_principal ? Number(item.bes_principal) : undefined,
                besStateContrib: item.bes_state_contrib ? Number(item.bes_state_contrib) : undefined,
                besStateContribYield: item.bes_state_contrib_yield ? Number(item.bes_state_contrib_yield) : undefined,
                besPrincipalYield: item.bes_principal_yield ? Number(item.bes_principal_yield) : undefined,
                customCategory: item.custom_category,
                customName: item.custom_name,
                customCurrentPrice: item.custom_current_price ? Number(item.custom_current_price) : undefined
            }));

            const cashItems: CashItem[] = (cashData || []).map(item => ({
                id: item.id,
                type: item.type,
                name: item.name,
                amount: Number(item.amount),
                currency: item.currency,
                interestRate: item.interest_rate ? Number(item.interest_rate) : undefined,
                dateAdded: item.date_added,
                instrumentId: item.instrument_id,
                units: item.units ? Number(item.units) : undefined,
                averageCost: item.average_cost ? Number(item.average_cost) : undefined,
                historicalUsdRate: item.historical_usd_rate ? Number(item.historical_usd_rate) : undefined
            }));

            const realizedTrades: RealizedTrade[] = (tradesData || []).map(trade => ({
                id: trade.id,
                instrumentId: trade.instrument_id,
                amount: Number(trade.amount),
                sellPrice: Number(trade.sell_price),
                buyPrice: Number(trade.buy_price),
                currency: trade.currency,
                date: trade.date,
                profit: Number(trade.profit),
                profitUsd: Number(trade.profit_usd),
                profitTry: Number(trade.profit_try),
                type: trade.type
            }));

            const dividends: Dividend[] = (dividendsData || []).map(div => ({
                id: div.id,
                instrumentId: div.instrument_id,
                amount: Number(div.amount),
                netAmount: div.net_amount ? Number(div.net_amount) : undefined,
                currency: div.currency,
                date: div.date,
                sharesAtDate: div.shares_at_date ? Number(div.shares_at_date) : undefined
            }));

            const history = (historyData || []).map(h => ({
                date: h.date,
                valueTry: Number(h.value_try),
                valueUsd: Number(h.value_usd)
            }));

            portfolios.push({
                id: p.id,
                name: p.name || 'Portföy',
                color: p.color || '#007AFF',
                icon: p.icon || '💼',
                createdAt: p.created_at || Date.now(),
                items,
                cashBalance: p.cash_balance ? Number(p.cash_balance) : 0,
                cashItems,
                realizedTrades,
                dividends,
                history,
                targetValueTry: p.target_value_try ? Number(p.target_value_try) : undefined,
                targetCurrency: p.target_currency
            });
        }

        console.log(`✅ Supabase: Loaded ${portfolios.length} portfolios`);
        return { portfolios, activePortfolioId };
    } catch (error) {
        console.error('❌ Error loading portfolios from Supabase:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time portfolio updates
 * Returns unsubscribe function
 */
export const subscribeToPortfolios = (
    userId: string,
    onUpdate: (portfolios: Portfolio[]) => void
) => {
    const channel = supabase
        .channel('portfolio-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'portfolios',
                filter: `user_id=eq.${userId}`
            },
            async () => {
                // Reload all portfolios on any change
                const { portfolios } = await loadUserPortfolios(userId);
                onUpdate(portfolios);
            }
        )
        .subscribe();

    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Record a single daily snapshot for a portfolio 
 */
export const recordDailySnapshot = async (
    userId: string,
    portfolioId: string,
    valueTry: number,
    valueUsd: number
): Promise<void> => {
    try {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`🔷 Supabase: Recording daily snapshot for ${date}`, { portfolioId, valueTry });

        const { error } = await supabase
            .from('portfolio_history')
            .upsert({
                portfolio_id: portfolioId,
                user_id: userId,
                date: date,
                value_try: valueTry,
                value_usd: valueUsd
            }, {
                onConflict: 'portfolio_id,user_id,date'
            });

        if (error) {
            console.error('❌ Error recording daily snapshot:', error);
            throw error;
        }
    } catch (error) {
        console.error('❌ recordDailySnapshot error:', error);
    }
};

/**
 * Migrate data from AsyncStorage to Supabase (one-time operation)
 */
export const migrateToSupabase = async (
    userId: string,
    portfolios: Portfolio[],
    activePortfolioId: string
): Promise<void> => {
    try {
        // Check if user already has data in Supabase
        const existingData = await loadUserPortfolios(userId);
        if (existingData.portfolios.length > 0) {
            console.log('ℹ️ User already has Supabase data, skipping migration');
            return;
        }

        // Save legacy data to Supabase
        if (portfolios.length > 0) {
            await saveUserPortfolios(userId, portfolios, activePortfolioId);
            console.log('✅ Migration to Supabase completed');
        }
    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    }
};
