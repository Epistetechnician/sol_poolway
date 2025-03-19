import { OrcaService } from './orca';
import { dbService } from './database';
import { sleep } from '../utils/common';
import { logger } from '../utils/logger';

class MonitorService {
  private static instance: MonitorService;
  private isRunning: boolean = false;
  private orcaService: OrcaService;
  private retryDelays: { [key: string]: number } = {};
  private readonly MAX_RETRY_DELAY = 60000; // 1 minute
  private readonly BASE_RETRY_DELAY = 1000; // 1 second
  private readonly FETCH_INTERVAL = 120000; // 2 minutes

  private constructor() {
    this.orcaService = OrcaService.getInstance();
  }

  public static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }

  private async processPool(poolId: string): Promise<void> {
    try {
      logger.info(`Processing ${poolId}...`);
      
      // Check if we need to wait due to previous rate limiting
      if (this.retryDelays[poolId]) {
        await sleep(this.retryDelays[poolId]);
      }

      const poolData = await this.orcaService.getPoolData(poolId);
      await dbService.savePoolData(poolData);
      logger.info(`Saved pool data for ${poolId}`);

      const ticksData = await this.orcaService.getTicksData(poolId);
      await dbService.saveTicksData(ticksData);
      logger.info(`Saved ${ticksData.length} ticks for ${poolId}`);

      // Reset retry delay on success
      this.retryDelays[poolId] = 0;

    } catch (error: any) {
      if (error?.context?.statusCode === 429) {
        // Rate limit hit - implement exponential backoff
        this.retryDelays[poolId] = Math.min(
          (this.retryDelays[poolId] || this.BASE_RETRY_DELAY) * 2,
          this.MAX_RETRY_DELAY
        );
        logger.warn(`Rate limit hit for ${poolId}, next retry in ${this.retryDelays[poolId]}ms`);
      } else {
        logger.error(`Error processing ${poolId}: ${error.message}`);
      }
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitor service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting pool monitoring service...\n');

    try {
      await dbService.ensureTablesExist();

      while (this.isRunning) {
        const startTime = Date.now();
        logger.info(`\nFetching data at ${new Date().toLocaleString()}\n`);

        // Process pools in parallel with a concurrency limit
        const pools = this.orcaService.getPoolIds();
        const BATCH_SIZE = 3; // Process 3 pools at a time
        
        for (let i = 0; i < pools.length; i += BATCH_SIZE) {
          const batch = pools.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(poolId => this.processPool(poolId)));
        }

        // Calculate time to next fetch
        const elapsed = Date.now() - startTime;
        const waitTime = Math.max(0, this.FETCH_INTERVAL - elapsed);
        
        if (waitTime > 0 && this.isRunning) {
          await sleep(waitTime);
        }
      }
    } catch (error) {
      logger.error('Monitor service error:', error);
      this.isRunning = false;
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping pool monitoring service...');
    this.isRunning = false;
    await dbService.cleanup();
  }
}

// Export singleton instance
export const monitorService = MonitorService.getInstance(); 