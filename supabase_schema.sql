-- =====================================================
-- SUPABASE DATABASE SCHEMA FOR PORTFÖY APP
-- Run this script in Supabase SQL Editor
-- =====================================================

-- Users metadata table (extends auth.users)
CREATE TABLE IF NOT EXISTS user_metadata (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  active_portfolio_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Portföy',
  color TEXT DEFAULT '#007AFF',
  icon TEXT DEFAULT '💼',
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  cash_balance NUMERIC DEFAULT 0,
  target_value_try NUMERIC,
  target_currency TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- Portfolio items (assets)
CREATE TABLE IF NOT EXISTS portfolio_items (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  instrument_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  average_cost NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  original_cost_usd NUMERIC,
  original_cost_try NUMERIC,
  date_added BIGINT,
  type TEXT,
  bes_principal NUMERIC,
  bes_state_contrib NUMERIC,
  bes_state_contrib_yield NUMERIC,
  bes_principal_yield NUMERIC,
  custom_category TEXT,
  custom_name TEXT,
  custom_current_price NUMERIC
);

-- Cash items
CREATE TABLE IF NOT EXISTS cash_items (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  interest_rate NUMERIC,
  date_added BIGINT,
  instrument_id TEXT,
  units NUMERIC,
  average_cost NUMERIC,
  historical_usd_rate NUMERIC
);

-- Realized trades
CREATE TABLE IF NOT EXISTS realized_trades (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  instrument_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  sell_price NUMERIC NOT NULL,
  buy_price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  date BIGINT NOT NULL,
  profit NUMERIC NOT NULL,
  profit_usd NUMERIC NOT NULL,
  profit_try NUMERIC NOT NULL,
  type TEXT
);

-- Portfolio history (daily snapshots)
CREATE TABLE IF NOT EXISTS portfolio_history (
  id SERIAL PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  value_try NUMERIC NOT NULL,
  value_usd NUMERIC NOT NULL,
  UNIQUE(portfolio_id, user_id, date)
);

-- TEFAS funds data (for caching - public read)
CREATE TABLE IF NOT EXISTS tefas_funds (
  code TEXT PRIMARY KEY,
  name TEXT,
  price NUMERIC NOT NULL,
  date TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE user_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE realized_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tefas_funds ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- User Metadata Policies
DROP POLICY IF EXISTS "Users can view own metadata" ON user_metadata;
DROP POLICY IF EXISTS "Users can update own metadata" ON user_metadata;
DROP POLICY IF EXISTS "Users can insert own metadata" ON user_metadata;

CREATE POLICY "Users can view own metadata" ON user_metadata 
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own metadata" ON user_metadata 
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own metadata" ON user_metadata 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Portfolios Policies
DROP POLICY IF EXISTS "Users can view own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can insert own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can update own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can delete own portfolios" ON portfolios;

CREATE POLICY "Users can view own portfolios" ON portfolios 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolios" ON portfolios 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolios" ON portfolios 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolios" ON portfolios 
  FOR DELETE USING (auth.uid() = user_id);

-- Portfolio Items Policies
DROP POLICY IF EXISTS "Users can manage own portfolio items" ON portfolio_items;
CREATE POLICY "Users can manage own portfolio items" ON portfolio_items 
  FOR ALL USING (auth.uid() = user_id);

-- Cash Items Policies
DROP POLICY IF EXISTS "Users can manage own cash items" ON cash_items;
CREATE POLICY "Users can manage own cash items" ON cash_items 
  FOR ALL USING (auth.uid() = user_id);

-- Realized Trades Policies
DROP POLICY IF EXISTS "Users can manage own realized trades" ON realized_trades;
CREATE POLICY "Users can manage own realized trades" ON realized_trades 
  FOR ALL USING (auth.uid() = user_id);

-- Portfolio History Policies
DROP POLICY IF EXISTS "Users can manage own portfolio history" ON portfolio_history;
CREATE POLICY "Users can manage own portfolio history" ON portfolio_history 
  FOR ALL USING (auth.uid() = user_id);

-- TEFAS is public read
DROP POLICY IF EXISTS "Anyone can read TEFAS data" ON tefas_funds;
CREATE POLICY "Anyone can read TEFAS data" ON tefas_funds 
  FOR SELECT USING (true);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_portfolio_id ON portfolio_items(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_user_id ON portfolio_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_items_portfolio_id ON cash_items(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_cash_items_user_id ON cash_items(user_id);
CREATE INDEX IF NOT EXISTS idx_realized_trades_portfolio_id ON realized_trades(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_realized_trades_user_id ON realized_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_portfolio_id ON portfolio_history(portfolio_id);
