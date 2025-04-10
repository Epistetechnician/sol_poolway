import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// RPC Configuration
export const RPC_CONFIG = {
  MAINNET_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  MAX_RETRIES: 5,
  RETRY_DELAY: 2000, // 2 seconds
  RATE_LIMIT_DELAY: 500, // 500ms
  TIMEOUT: 60000, // 60 seconds
  BATCH_SIZE: 50,
  RATE_LIMIT: parseInt(process.env.RPC_RATE_LIMIT || '10', 10),
  EXPONENTIAL_BACKOFF: true, // Enable exponential backoff
  MAX_BACKOFF: 30000, // Maximum backoff time of 30 seconds
};

// Database Configuration
export const DB_CONFIG = {
  HOST: process.env.TIMESCALE_HOST || 'localhost',
  PORT: parseInt(process.env.TIMESCALE_PORT || '5432', 10),
  DATABASE: process.env.TIMESCALE_DB || 'solana_pools',
  USER: process.env.TIMESCALE_USER || 'postgres',
  PASSWORD: process.env.TIMESCALE_PASSWORD || '',
  SSL: process.env.DB_SSL === 'true',
  POOL: {
    MAX: 10,
    MIN: 4,
    IDLE_TIMEOUT: 30000,
  },
};

// Data Collection Settings
export const COLLECTION_CONFIG = {
  INTERVAL: 15000, // ms between collections
  MIN_COLLECTION_INTERVAL: 10000, // minimum ms between collections
  BATCH_SIZE: 8, // number of pools to process in parallel
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // ms
};

// Price Calculation
export const PRICE_CONFIG = {
  DECIMALS: 9,
  PRICE_IMPACT_TOLERANCE: 0.01, // 1%
  MIN_LIQUIDITY_USD: 1000, // Minimum liquidity in USD to consider a pool valid
  OUTLIER_THRESHOLD: 0.1, // 10% deviation from median to be considered an outlier
};

// Logging Configuration
export const LOG_CONFIG = {
  FILENAME: 'solana_arbitrage.log',
  MAX_SIZE: '100m',
  MAX_FILES: '7d',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

// Monitoring Thresholds
export const MONITORING_CONFIG = {
  PRICE_CHANGE_ALERT: 0.05, // 5% price change
  LIQUIDITY_CHANGE_ALERT: 0.20, // 20% liquidity change
  VOLUME_SPIKE_ALERT: 3, // 3x average volume
  HEALTH_CHECK_INTERVAL: 300000, // 5 minutes
};

// Cache Configuration
export const CACHE_CONFIG = {
  TTL: 60000, // 1 minute cache TTL
  MAX_ITEMS: 1000,
  PRUNE_INTERVAL: 300000, // 5 minutes
};

// Table Names
export const TABLE_NAMES = {
  POOL_DATA: 'solana_pool_data',
  PRICE_DATA: 'solana_price_data',
  TICKS_DATA: 'solana_ticks_data',
};

// Error Messages
export const ERROR_MESSAGES = {
  RPC_ERROR: 'Failed to fetch data from RPC node',
  DB_CONNECTION: 'Failed to connect to database',
  POOL_NOT_FOUND: 'Pool not found',
  INVALID_PRICE: 'Invalid price calculation',
  RATE_LIMIT: 'Rate limit exceeded',
  TIMEOUT: 'Operation timed out',
};

// Query Templates
export const QUERIES = {
  INSERT_POOL_DATA: `
    INSERT INTO ${TABLE_NAMES.POOL_DATA} (
      timestamp,
      pool_address,
      token_a_amount,
      token_b_amount,
      sqrt_price,
      liquidity,
      tick_current,
      fee_growth_global_a,
      fee_growth_global_b
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (timestamp, pool_address) 
    DO UPDATE SET
      token_a_amount = EXCLUDED.token_a_amount,
      token_b_amount = EXCLUDED.token_b_amount,
      sqrt_price = EXCLUDED.sqrt_price,
      liquidity = EXCLUDED.liquidity,
      tick_current = EXCLUDED.tick_current,
      fee_growth_global_a = EXCLUDED.fee_growth_global_a,
      fee_growth_global_b = EXCLUDED.fee_growth_global_b
  `,
  
  INSERT_PRICE_DATA: `
    INSERT INTO ${TABLE_NAMES.PRICE_DATA} (
      timestamp,
      pool_address,
      price,
      volume_24h,
      liquidity_usd
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (timestamp, pool_address) 
    DO UPDATE SET
      price = EXCLUDED.price,
      volume_24h = EXCLUDED.volume_24h,
      liquidity_usd = EXCLUDED.liquidity_usd
  `,
  
  INSERT_TICKS_DATA: `
    INSERT INTO public.${TABLE_NAMES.TICKS_DATA} (
      timestamp, pool_address, tick_index,
      liquidity_net, liquidity_gross,
      fee_growth_outside_a, fee_growth_outside_b
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (timestamp, pool_address, tick_index) DO UPDATE SET
      liquidity_net = EXCLUDED.liquidity_net,
      liquidity_gross = EXCLUDED.liquidity_gross,
      fee_growth_outside_a = EXCLUDED.fee_growth_outside_a,
      fee_growth_outside_b = EXCLUDED.fee_growth_outside_b
  `,
}; 