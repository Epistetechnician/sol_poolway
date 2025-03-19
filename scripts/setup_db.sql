-- Create database if it doesn't exist
CREATE DATABASE solana_pools;

\c solana_pools;

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create pool data table
CREATE TABLE IF NOT EXISTS public.solana_pool_data (
    timestamp TIMESTAMPTZ NOT NULL,
    pool_address TEXT NOT NULL,
    token_a_amount NUMERIC NOT NULL,
    token_b_amount NUMERIC NOT NULL,
    sqrt_price NUMERIC NOT NULL,
    liquidity NUMERIC NOT NULL,
    tick_current INTEGER NOT NULL,
    fee_growth_global_a NUMERIC NOT NULL,
    fee_growth_global_b NUMERIC NOT NULL,
    PRIMARY KEY (timestamp, pool_address)
);

-- Create price data table
CREATE TABLE IF NOT EXISTS public.solana_price_data (
    timestamp TIMESTAMPTZ NOT NULL,
    pool_address TEXT NOT NULL,
    price NUMERIC NOT NULL,
    volume_24h NUMERIC,
    liquidity_usd NUMERIC,
    PRIMARY KEY (timestamp, pool_address)
);

-- Create ticks data table
CREATE TABLE IF NOT EXISTS public.solana_ticks_data (
    timestamp TIMESTAMPTZ NOT NULL,
    pool_address TEXT NOT NULL,
    tick_index INTEGER NOT NULL,
    liquidity_net NUMERIC,
    liquidity_gross NUMERIC,
    fee_growth_outside_a NUMERIC,
    fee_growth_outside_b NUMERIC,
    PRIMARY KEY (timestamp, pool_address, tick_index)
);

-- Create hypertables
SELECT create_hypertable('solana_pool_data', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('solana_price_data', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('solana_ticks_data', 'timestamp', if_not_exists => TRUE);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pool_data_timestamp ON public.solana_pool_data (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_data_timestamp ON public.solana_price_data (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ticks_data_timestamp ON public.solana_ticks_data (timestamp DESC);

-- Grant permissions to postgres user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres; 