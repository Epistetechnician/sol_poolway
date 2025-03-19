import { monitorService } from './services/monitor';
import { logger } from './utils/logger';

async function main() {
  try {
    logger.info('Starting Orca pool monitoring...');
    logger.info('Press Ctrl+C to stop\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\nReceived SIGINT. Shutting down gracefully...');
      await monitorService.stop();
      process.exit(0);
    });

    // Start the monitoring service
    await monitorService.start();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main(); 