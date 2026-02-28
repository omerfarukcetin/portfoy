export type InstrumentType = 'crypto' | 'stock' | 'forex' | 'gold' | 'silver' | 'fund' | 'metal' | 'bes' | 'custom';

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto' | 'fund' | 'gold' | 'metal' | 'bes' | 'forex';
  currentPrice?: number;
  currency?: string;
  lastUpdated?: number;
  change24h?: number;
  dailyChange?: number; // Daily change percentage (for TEFAS funds)
  instrumentId?: string;  // For crypto: CoinGecko/CoinCap ID (e.g., "worldcoin")
  subtype?: 'gram' | 'quarter' | 'half' | 'full' | 'ons'; // For gold
  error?: string; // Error message if fetching failed
}

export interface PortfolioItem {
  id: string;
  instrumentId: string;
  amount: number;
  averageCost: number; // In original currency (TRY or USD)
  currency: 'USD' | 'TRY'; // Currency of the cost
  originalCostUsd?: number; // Cost in USD at the time of purchase
  originalCostTry?: number; // Cost in TRY at the time of purchase
  dateAdded: number;
  type?: InstrumentType; // Added for better categorization
  // BES Specific Fields
  besPrincipal?: number; // Ana para
  besStateContrib?: number; // Devlet katkısı
  besStateContribYield?: number; // Devlet katkısı getirisi
  besPrincipalYield?: number; // Ana para getirisi
  customCategory?: string; // User-defined category name
  // Custom Asset Fields (for manual price entry like crowdfunding)
  customName?: string; // Display name for custom assets
  customCurrentPrice?: number; // User-entered current unit price
}

export interface RealizedTrade {
  id: string;
  instrumentId: string;
  amount: number;
  sellPrice: number;
  buyPrice: number; // Average cost at time of sale
  currency: 'USD' | 'TRY';
  date: number;
  profit: number; // In original currency
  profitUsd: number;
  profitTry: number;
  type?: InstrumentType; // Asset type for category grouping
}

// Assuming sellAsset is a function definition that needs to be added or modified.
// Based on the provided snippet, it seems to be a standalone function or part of a larger service/utility.
// Since the original document only contains interface definitions, I will add it as a placeholder function definition.
// If this function is meant to be part of an interface, please provide the correct interface context.
declare function sellAsset(id: string, amount: number, sellPrice: number, sellDate?: number, historicalRate?: number, destinationCashId?: string, taxRate?: number): Promise<void>;

export interface Dividend {
  id: string;
  instrumentId: string; // The stock/asset symbol
  amount: number; // Gross dividend amount
  netAmount?: number; // Net dividend amount after tax
  currency: 'TRY' | 'USD';
  date: number; // Payment date
  sharesAtDate?: number; // Optional: Shares owned at record date
}

export interface CashItem {
  id: string;
  type: 'cash' | 'money_market_fund' | 'deposit';
  name: string;
  amount: number; // Current value (TRY)
  interestRate?: number; // For deposits (annual rate as percentage)
  currency: 'TRY' | 'USD';
  dateAdded?: number;
  // For money market funds - P/L tracking
  instrumentId?: string; // TEFAS fund code
  units?: number; // Number of fund units
  averageCost?: number; // Average cost per unit
  historicalUsdRate?: number; // USD/TRY rate at purchase date
}

export interface Portfolio {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: number;
  items: PortfolioItem[];
  cashBalance: number;
  cashItems: CashItem[];
  realizedTrades: RealizedTrade[];
  dividends: Dividend[];
  history: { date: string; valueTry: number; valueUsd: number }[];
  targetValueTry?: number;
  targetCurrency?: 'TRY' | 'USD';
  updatedAt?: number; // Last modified epoch
}

export interface PriceAlert {
  id: string;
  instrumentId: string;
  instrumentName: string;
  type: 'above' | 'below' | 'target' | 'change_percent';
  targetPrice?: number;
  changePercent?: number;
  basePrice?: number; // For percent change calculation
  currency: 'USD' | 'TRY';
  isActive: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export interface NotificationSettings {
  dailySummaryEnabled: boolean;
  dailySummaryTime: string; // "08:00"
  bigMoveAlertEnabled: boolean;
  bigMoveThreshold: number; // Default 5%
}

export interface BudgetCategory {
  id: string;
  type: 'income' | 'expense';
  name: string;
  icon?: string;
  color?: string;
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  type: 'income' | 'expense';
  amount: number;
  currency: 'TRY' | 'USD';
  date: number;
  note?: string;
  linkedPortfolioId?: string; // For integration (withdrawals/investments)
}
