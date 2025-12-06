export type InstrumentType = 'crypto' | 'stock' | 'forex' | 'gold' | 'fund' | 'metal' | 'bes';

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto' | 'fund' | 'gold' | 'metal' | 'bes';
  currentPrice?: number;
  currency?: string;
  lastUpdated?: number;
  change24h?: number;
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
}

export interface CashItem {
  id: string;
  type: 'cash' | 'money_market_fund' | 'deposit';
  name: string;
  amount: number;
  interestRate?: number; // For deposits (annual rate as percentage)
  currency: 'TRY' | 'USD';
  dateAdded?: number;
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
  history: { date: string; valueTry: number; valueUsd: number }[];
}
