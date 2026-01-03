import React, { createContext, useState, useEffect, useContext } from 'react';
import { BudgetItem, BudgetCategory } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { usePortfolio } from './PortfolioContext';

interface BudgetContextType {
    items: BudgetItem[];
    categories: BudgetCategory[];
    isLoading: boolean;

    // Items
    addBudgetItem: (item: Omit<BudgetItem, 'id'>) => Promise<void>;
    updateBudgetItem: (id: string, updates: Partial<BudgetItem>) => Promise<void>;
    deleteBudgetItem: (id: string) => Promise<void>;

    // Categories
    addCategory: (category: Omit<BudgetCategory, 'id'>) => Promise<void>;
    updateCategory: (id: string, updates: Partial<BudgetCategory>) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { portfolios, updatePortfolioCash, activePortfolioId } = usePortfolio();

    const [items, setItems] = useState<BudgetItem[]>([]);
    const [categories, setCategories] = useState<BudgetCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            refreshAllData();
        } else {
            setItems([]);
            setCategories([]);
            setIsLoading(false);
        }
    }, [user]);

    const refreshAllData = async () => {
        setIsLoading(true);
        await Promise.all([fetchCategories(), fetchItems()]);
        setIsLoading(false);
    };

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('budget_categories')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: true });

            if (error) throw error;

            let loadedCategories = data as BudgetCategory[];
            if (loadedCategories.length === 0) {
                loadedCategories = await setupDefaultCategories();
            }
            setCategories(loadedCategories);
            return loadedCategories;
        } catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    };

    const fetchItems = async () => {
        try {
            const { data, error } = await supabase
                .from('budget_items')
                .select('*')
                .eq('user_id', user?.id)
                .order('date', { ascending: false });

            if (error) throw error;

            const mappedItems = (data || []).map((item: any) => ({
                id: item.id,
                categoryId: item.category_id,
                type: item.type,
                amount: item.amount,
                currency: item.currency,
                date: item.date,
                note: item.note,
                linkedPortfolioId: item.linked_portfolio_id
            }));

            setItems(mappedItems as BudgetItem[]);
            return mappedItems;
        } catch (error) {
            console.error('Error fetching items:', error);
            return [];
        }
    };

    const setupDefaultCategories = async () => {
        const defaults: Omit<BudgetCategory, 'id'>[] = [
            { type: 'income', name: 'Maaş', icon: 'wallet', color: '#4ADE80' },
            { type: 'income', name: 'Ek Gelir', icon: 'plus-circle', color: '#22D3EE' },
            { type: 'income', name: 'Portföy Çekimi', icon: 'arrow-down-circle', color: '#F472B6' },
            { type: 'income', name: 'Diğer', icon: 'help-circle', color: '#94A3B8' },
            { type: 'expense', name: 'Market', icon: 'shopping-cart', color: '#F87171' },
            { type: 'expense', name: 'Kira/Fatura', icon: 'home', color: '#FB923C' },
            { type: 'expense', name: 'Ulaşım', icon: 'truck', color: '#FBBF24' },
            { type: 'expense', name: 'Sağlık', icon: 'heart', color: '#F87171' },
            { type: 'expense', name: 'Eğlence', icon: 'music', color: '#A78BFA' },
            { type: 'expense', name: 'Yatırım', icon: 'trending-up', color: '#34D399' },
            { type: 'expense', name: 'Diğer', icon: 'help-circle', color: '#94A3B8' },
        ];

        const toInsert = defaults.map(cat => ({
            id: Math.random().toString(36).substr(2, 9),
            user_id: user?.id,
            type: cat.type,
            name: cat.name,
            icon: cat.icon,
            color: cat.color
        }));

        const { data, error } = await supabase
            .from('budget_categories')
            .insert(toInsert)
            .select();

        if (error) {
            console.error('Error setting up default categories:', error);
            return [];
        }
        return data as BudgetCategory[];
    };

    // Helper to update portfolio cash balance
    const syncWithPortfolio = async (linkedPortfolioId: string, type: 'income' | 'expense', amount: number, isReversal = false) => {
        if (!linkedPortfolioId) return;

        // If income (withdrawal) -> minus from portfolio
        // If expense (investment) -> plus to portfolio
        // If isReversal, flip the signs
        let multiplier = type === 'expense' ? 1 : -1;
        if (isReversal) multiplier *= -1;

        const finalAmount = amount * multiplier;
        await updatePortfolioCash(linkedPortfolioId, finalAmount);
    };

    const addBudgetItem = async (item: Omit<BudgetItem, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newItem: BudgetItem = { ...item, id };

        // 1. Optimistic Update
        setItems(prev => [newItem, ...prev]);

        // 2. Portfolio Integration
        if (item.linkedPortfolioId) {
            await syncWithPortfolio(item.linkedPortfolioId, item.type, item.amount);
        }

        // 3. Cloud Sync
        try {
            const { error } = await supabase
                .from('budget_items')
                .insert([{
                    id,
                    user_id: user?.id,
                    category_id: item.categoryId,
                    type: item.type,
                    amount: item.amount,
                    currency: item.currency,
                    date: item.date,
                    note: item.note,
                    linked_portfolio_id: item.linkedPortfolioId
                }]);
            if (error) throw error;
        } catch (error) {
            console.error('Error adding budget item:', error);
            // Revert on fail? (Skipping for simplicity in this version)
        }
    };

    const updateBudgetItem = async (id: string, updates: Partial<BudgetItem>) => {
        const oldItem = items.find(i => i.id === id);
        if (!oldItem) return;

        // Reversal logic for portfolio integration
        if (oldItem.linkedPortfolioId) {
            await syncWithPortfolio(oldItem.linkedPortfolioId, oldItem.type, oldItem.amount, true);
        }

        const updatedItem = { ...oldItem, ...updates };
        setItems(prev => prev.map(i => i.id === id ? updatedItem : i));

        if (updatedItem.linkedPortfolioId) {
            await syncWithPortfolio(updatedItem.linkedPortfolioId, updatedItem.type, updatedItem.amount);
        }

        try {
            const { error } = await supabase
                .from('budget_items')
                .update({
                    category_id: updatedItem.categoryId,
                    type: updatedItem.type,
                    amount: updatedItem.amount,
                    currency: updatedItem.currency,
                    date: updatedItem.date,
                    note: updatedItem.note,
                    linked_portfolio_id: updatedItem.linkedPortfolioId
                })
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error updating budget item:', error);
        }
    };

    const deleteBudgetItem = async (id: string) => {
        const itemToDelete = items.find(i => i.id === id);
        if (!itemToDelete) return;

        if (itemToDelete.linkedPortfolioId) {
            await syncWithPortfolio(itemToDelete.linkedPortfolioId, itemToDelete.type, itemToDelete.amount, true);
        }

        setItems(prev => prev.filter(i => i.id !== id));

        try {
            const { error } = await supabase
                .from('budget_items')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting budget item:', error);
        }
    };

    const addCategory = async (category: Omit<BudgetCategory, 'id'>) => {
        try {
            const id = Math.random().toString(36).substr(2, 9);
            const { error } = await supabase
                .from('budget_categories')
                .insert([{
                    id,
                    user_id: user?.id,
                    type: category.type,
                    name: category.name,
                    icon: category.icon,
                    color: category.color
                }]);
            if (error) throw error;

            // After successful insert, refresh categories from DB
            await fetchCategories();
        } catch (error) {
            console.error('Error adding category:', error);
            throw error;
        }
    };

    const updateCategory = async (id: string, updates: Partial<BudgetCategory>) => {
        try {
            const { error } = await supabase
                .from('budget_categories')
                .update(updates)
                .eq('id', id);
            if (error) throw error;

            // Refresh from DB
            await fetchCategories();
        } catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    };

    const deleteCategory = async (id: string) => {
        try {
            const { error } = await supabase
                .from('budget_categories')
                .delete()
                .eq('id', id);
            if (error) throw error;

            // Items are deleted by CASCADE in DB, so refresh both
            await Promise.all([fetchCategories(), fetchItems()]);
        } catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    };

    return (
        <BudgetContext.Provider value={{
            items,
            categories,
            isLoading,
            addBudgetItem,
            updateBudgetItem,
            deleteBudgetItem,
            addCategory,
            updateCategory,
            deleteCategory
        }}>
            {children}
        </BudgetContext.Provider>
    );
};

export const useBudget = () => {
    const context = useContext(BudgetContext);
    if (context === undefined) {
        throw new Error('useBudget must be used within a BudgetProvider');
    }
    return context;
};
