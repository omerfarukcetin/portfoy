import { supabase } from './supabaseClient';
import { Portfolio, PortfolioItem, CashItem, RealizedTrade } from '../types';

/**
 * SupabaseService handles all relational data operations for the portfolio application.
 * It replaces the document-based logic of Firestore with a relational PostgreSQL approach.
 */
export const SupabaseService = {
    /**
     * Load all portfolios for a user
     */
    loadUserPortfolios: async (userId: string): Promise<{ portfolios: Portfolio[], activePortfolioId: string }> => {
        try {
            // In Supabase, we would join portfolios with their items, cash, and trades
            const { data: portfolios, error } = await supabase
                .from('portfolios')
                .select(`
                    *,
                    items:portfolio_items(*),
                    cash_items:cash_items(*),
                    realized_trades:realized_trades(*)
                `)
                .eq('user_id', userId);

            if (error) throw error;

            // Load user preferences for activePortfolioId
            const { data: profile } = await supabase
                .from('profiles')
                .select('active_portfolio_id')
                .eq('id', userId)
                .single();

            return {
                portfolios: portfolios || [],
                activePortfolioId: profile?.active_portfolio_id || (portfolios && portfolios[0]?.id) || ''
            };
        } catch (error) {
            console.error('Error loading portfolios from Supabase:', error);
            throw error;
        }
    },

    /**
     * Save/Update a portfolio and its children
     */
    savePortfolio: async (userId: string, portfolio: Portfolio): Promise<void> => {
        try {
            // 1. Upsert portfolio metadata
            const { error: pError } = await supabase
                .from('portfolios')
                .upsert({
                    id: portfolio.id,
                    user_id: userId,
                    name: portfolio.name,
                    color: portfolio.color,
                    icon: portfolio.icon,
                    cash_balance: portfolio.cashBalance,
                    updated_at: new Date().toISOString()
                });

            if (pError) throw pError;

            // 2. Sync Portfolio Items
            // For simplicity in this version, we delete and re-insert to handle additions/removals
            await supabase.from('portfolio_items').delete().eq('portfolio_id', portfolio.id);
            if (portfolio.items.length > 0) {
                const { error: itemsError } = await supabase
                    .from('portfolio_items')
                    .insert(portfolio.items.map(item => ({
                        ...item,
                        portfolio_id: portfolio.id
                    })));
                if (itemsError) throw itemsError;
            }

            // 3. Sync Cash Items
            await supabase.from('cash_items').delete().eq('portfolio_id', portfolio.id);
            if (portfolio.cashItems.length > 0) {
                const { error: cashError } = await supabase
                    .from('cash_items')
                    .insert(portfolio.cashItems.map(item => ({
                        ...item,
                        portfolio_id: portfolio.id
                    })));
                if (cashError) throw cashError;
            }

            // 4. Sync Realized Trades
            await supabase.from('realized_trades').delete().eq('portfolio_id', portfolio.id);
            if (portfolio.realizedTrades.length > 0) {
                const { error: tradesError } = await supabase
                    .from('realized_trades')
                    .insert(portfolio.realizedTrades.map(trade => ({
                        ...trade,
                        portfolio_id: portfolio.id
                    })));
                if (tradesError) throw tradesError;
            }

        } catch (error) {
            console.error('Error saving portfolio to Supabase:', error);
            throw error;
        }
    },

    /**
     * Save/Update user profile preferences (like activePortfolioId)
     */
    saveActivePortfolioId: async (userId: string, activePortfolioId: string): Promise<void> => {
        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    active_portfolio_id: activePortfolioId,
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
        } catch (error) {
            console.error('Error saving profile preference to Supabase:', error);
        }
    },

    /**
     * Subscribe to real-time changes using Supabase Channels
     */
    subscribeToUserPortfolios: (userId: string, onUpdate: () => void) => {
        return supabase
            .channel('public:portfolios')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'portfolios', filter: `user_id=eq.${userId}` },
                onUpdate
            )
            .subscribe();
    }
};
