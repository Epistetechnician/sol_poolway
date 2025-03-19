import pgPromise, { IDatabase, IMain, ColumnSet, ITask, IBaseProtocol, IQueryFileOptions } from 'pg-promise';
import { DB_CONFIG, TABLE_NAMES, QUERIES } from '../config/constants';
import { IPoolData, ITickData } from './orca';
import { logger } from '../utils/logger';

interface IExtensions {
  // Add any custom extensions here
}

type DatabaseConnection = IDatabase<IExtensions>;

interface IPgError extends Error {
  code?: string;
}

interface IPgEvent {
  query: string;
  params: any;
  ctx: any;
}

class DatabaseService {
  private static instance: DatabaseService;
  private db: DatabaseConnection;
  private pgp: IMain;
  private isConnected: boolean = false;
  private retryCount: number = 0;
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  private constructor() {
    this.pgp = pgPromise({
      // Event handlers for connection management
      error: (err: IPgError, e: IPgEvent) => {
        logger.error(`Database error: ${err.message || err}`, {
          query: e.query,
          params: e.params,
          ctx: e.ctx
        });
        
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          this.isConnected = false;
        }
      },
      // Connection monitoring
      connect: () => {
        this.isConnected = true;
        this.retryCount = 0;
        logger.info('Connected to TimescaleDB');
      },
      disconnect: () => {
        this.isConnected = false;
        logger.warn('Disconnected from TimescaleDB');
      }
    });
    
    const ssl = DB_CONFIG.SSL ? {
      rejectUnauthorized: false,
      // For better security in production, consider using certificates:
      // ca: fs.readFileSync('./certs/ca.crt').toString()
    } : false;

    this.db = this.pgp({
      host: DB_CONFIG.HOST,
      port: DB_CONFIG.PORT,
      database: DB_CONFIG.DATABASE,
      user: DB_CONFIG.USER,
      password: DB_CONFIG.PASSWORD,
      ssl,
      max: DB_CONFIG.POOL.MAX,
      idleTimeoutMillis: DB_CONFIG.POOL.IDLE_TIMEOUT,
      connectionTimeoutMillis: 10000, // 10 seconds
      application_name: 'solana-dashboard'
    });

    // Test connection on initialization
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      await this.db.one('SELECT 1 AS connected');
      this.isConnected = true;
      logger.info('Successfully connected to TimescaleDB');
    } catch (error: any) {
      this.isConnected = false;
      logger.error(`Failed to connect to TimescaleDB: ${error.message}`);
      
      // Auto-retry connection
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        logger.info(`Retrying connection in ${this.RETRY_DELAY}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
        setTimeout(() => this.testConnection(), this.RETRY_DELAY);
      } else {
        logger.error('Max connection retries reached. Please check database configuration.');
      }
    }
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public async ensureTablesExist(): Promise<void> {
    try {
      logger.info('Ensuring database tables exist...');
      
      await this.db.none(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.POOL_DATA} (
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
        SELECT create_hypertable('${TABLE_NAMES.POOL_DATA}', 'timestamp', if_not_exists => TRUE);

        CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.PRICE_DATA} (
          timestamp TIMESTAMPTZ NOT NULL,
          pool_address TEXT NOT NULL,
          price NUMERIC NOT NULL,
          volume_24h NUMERIC,
          liquidity_usd NUMERIC,
          PRIMARY KEY (timestamp, pool_address)
        );
        SELECT create_hypertable('${TABLE_NAMES.PRICE_DATA}', 'timestamp', if_not_exists => TRUE);

        CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.TICKS_DATA} (
          timestamp TIMESTAMPTZ NOT NULL,
          pool_address TEXT NOT NULL,
          tick_index INTEGER NOT NULL,
          liquidity_net NUMERIC,
          liquidity_gross NUMERIC,
          fee_growth_outside_a NUMERIC,
          fee_growth_outside_b NUMERIC,
          PRIMARY KEY (timestamp, pool_address, tick_index)
        );
        SELECT create_hypertable('${TABLE_NAMES.TICKS_DATA}', 'timestamp', if_not_exists => TRUE);

        CREATE INDEX IF NOT EXISTS idx_pool_data_pool_address 
        ON ${TABLE_NAMES.POOL_DATA} (pool_address, timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_price_data_pool_address 
        ON ${TABLE_NAMES.PRICE_DATA} (pool_address, timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_ticks_data_pool_address 
        ON ${TABLE_NAMES.TICKS_DATA} (pool_address, timestamp DESC);
      `);
      
      logger.info('Database tables created or verified successfully');
    } catch (error: any) {
      logger.error(`Error creating tables: ${error.message}`);
      throw error;
    }
  }

  public async savePoolData(data: IPoolData): Promise<void> {
    try {
      await this.db.tx(async (t: ITask<IExtensions>) => {
        await t.none(QUERIES.INSERT_POOL_DATA, [
          data.timestamp,
          data.poolAddress,
          data.tokenAAmount,
          data.tokenBAmount,
          data.sqrtPrice,
          data.liquidity,
          data.tickCurrent,
          data.feeGrowthGlobalA,
          data.feeGrowthGlobalB,
        ]);

        await t.none(QUERIES.INSERT_PRICE_DATA, [
          data.timestamp,
          data.poolAddress,
          data.price,
          data.volume24h || 0,
          data.liquidityUsd,
        ]);
      });
    } catch (error: any) {
      logger.error(`Error saving pool data: ${error.message}`);
      throw error;
    }
  }

  public async saveTicksData(data: ITickData[]): Promise<void> {
    if (!data.length) return;

    try {
      const values = data.map(tick => ({
        timestamp: tick.timestamp,
        pool_address: tick.poolAddress,
        tick_index: tick.tickIndex,
        liquidity_net: tick.liquidityNet,
        liquidity_gross: tick.liquidityGross,
        fee_growth_outside_a: tick.feeGrowthOutsideA,
        fee_growth_outside_b: tick.feeGrowthOutsideB,
      }));

      const cs = new this.pgp.helpers.ColumnSet([
        'timestamp',
        'pool_address',
        'tick_index',
        'liquidity_net',
        'liquidity_gross',
        'fee_growth_outside_a',
        'fee_growth_outside_b'
      ], { table: TABLE_NAMES.TICKS_DATA });

      const query = this.pgp.helpers.insert(values, cs) +
        ' ON CONFLICT (timestamp, pool_address, tick_index) DO UPDATE SET ' +
        cs.columns.map((col: { name: string }) => `${col.name} = EXCLUDED.${col.name}`).join(', ');

      await this.db.none(query);
    } catch (error: any) {
      logger.error(`Error saving ticks data: ${error.message}`);
      throw error;
    }
  }

  public async getLatestPrices(): Promise<Array<{ pool_address: string; price: number; timestamp: Date }>> {
    try {
      return this.db.any<{ pool_address: string; price: number; timestamp: Date }>(`
        WITH latest_timestamps AS (
          SELECT pool_address, MAX(timestamp) as max_timestamp
          FROM ${TABLE_NAMES.PRICE_DATA}
          GROUP BY pool_address
        )
        SELECT p.pool_address, p.price, p.timestamp
        FROM ${TABLE_NAMES.PRICE_DATA} p
        INNER JOIN latest_timestamps lt
          ON p.pool_address = lt.pool_address
          AND p.timestamp = lt.max_timestamp
        ORDER BY p.pool_address;
      `);
    } catch (error: any) {
      logger.error(`Error getting latest prices: ${error.message}`);
      return [];
    }
  }

  public async getPoolHistory(
    poolAddress: string,
    startTime: Date,
    endTime: Date
  ): Promise<IPoolData[]> {
    interface IPoolRow {
      timestamp: Date;
      pool_address: string;
      token_a_amount: string;
      token_b_amount: string;
      sqrt_price: string;
      liquidity: string;
      tick_current: number;
      fee_growth_global_a: string;
      fee_growth_global_b: string;
      price: string;
      liquidity_usd: string;
      volume_24h: string | null;
    }

    try {
      const rows = await this.db.any<IPoolRow>(`
        SELECT pd.*, p.price, p.liquidity_usd, p.volume_24h
        FROM ${TABLE_NAMES.POOL_DATA} pd
        LEFT JOIN ${TABLE_NAMES.PRICE_DATA} p
          ON pd.timestamp = p.timestamp
          AND pd.pool_address = p.pool_address
        WHERE pd.pool_address = $1
          AND pd.timestamp BETWEEN $2 AND $3
        ORDER BY pd.timestamp ASC;
      `, [poolAddress, startTime, endTime]);

      return rows.map((row: IPoolRow) => ({
        timestamp: row.timestamp,
        poolAddress: row.pool_address,
        tokenAAmount: parseFloat(row.token_a_amount),
        tokenBAmount: parseFloat(row.token_b_amount),
        sqrtPrice: parseFloat(row.sqrt_price),
        liquidity: parseFloat(row.liquidity),
        tickCurrent: row.tick_current,
        feeGrowthGlobalA: parseFloat(row.fee_growth_global_a),
        feeGrowthGlobalB: parseFloat(row.fee_growth_global_b),
        price: parseFloat(row.price),
        liquidityUsd: parseFloat(row.liquidity_usd),
        volume24h: row.volume_24h ? parseFloat(row.volume_24h) : undefined,
      }));
    } catch (error: any) {
      logger.error(`Error getting pool history: ${error.message}`);
      return [];
    }
  }

  public async cleanup(): Promise<void> {
    try {
      await this.db.$pool.end();
      logger.info('Database connection pool closed');
    } catch (error: any) {
      logger.error(`Error closing database connection: ${error.message}`);
    }
  }
}

// Export singleton instance
export const dbService = DatabaseService.getInstance();