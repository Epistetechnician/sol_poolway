import { orcaService } from './services/orca';
import { dbService } from './services/database';
import { COLLECTION_CONFIG, LOG_CONFIG } from './config/constants';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: LOG_CONFIG.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: LOG_CONFIG.FILENAME,
      maxsize: parseInt(LOG_CONFIG.MAX_SIZE),
      maxFiles: LOG_CONFIG.MAX_FILES,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Track last successful collection
let lastSuccessfulCollection = 0;

async function collectData(): Promise<void> {
  try {
    // Get pool data
    const poolsData = await orcaService.getAllPoolsData();
    logger.info(`Collected data for ${poolsData.length} pools`);

    // Save pool data
    for (const poolData of poolsData) {
      await dbService.savePoolData(poolData);
    }

    // Get ticks data
    const ticksData = await orcaService.getAllTicksData();
    logger.info(`Collected ${ticksData.length} ticks`);

    // Save ticks data
    await dbService.saveTicksData(ticksData);

    // Update last successful collection timestamp
    lastSuccessfulCollection = Date.now();
    logger.info('Data collection completed successfully');
  } catch (error) {
    logger.error('Error in data collection:', error);
  }
}

async function startDataCollection(): Promise<void> {
  logger.info('Starting Solana Orca pools data collection');

  try {
    // Ensure database tables exist
    await dbService.ensureTablesExist();
    logger.info('Database tables verified');

    // Collect data immediately
    await collectData();

    // Then collect at regular intervals with rate limiting
    setInterval(async () => {
      try {
        // Check if enough time has passed since the last successful collection
        const now = Date.now();
        const timeSinceLastCollection = now - lastSuccessfulCollection;

        if (timeSinceLastCollection < COLLECTION_CONFIG.MIN_COLLECTION_INTERVAL) {
          const waitTime = COLLECTION_CONFIG.MIN_COLLECTION_INTERVAL - timeSinceLastCollection;
          logger.debug(`Waiting ${waitTime}ms before next collection to avoid rate limiting`);
          return; // Skip this collection cycle
        }

        // Proceed with data collection
        await collectData();
      } catch (error) {
        logger.error('Error in scheduled data collection:', error);
      }
    }, COLLECTION_CONFIG.INTERVAL);

    // Handle process termination
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM signal. Cleaning up...');
      await dbService.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT signal. Cleaning up...');
      await dbService.cleanup();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error in data collection:', error);
    await dbService.cleanup();
    process.exit(1);
  }
}

// Start the data collection
startDataCollection().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
}); 