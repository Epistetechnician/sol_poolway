import { orcaService } from '../services/orca';
import { logger } from '../utils/logger';
import { POOLS } from '../config/pools';

async function testOrcaPools() {
  try {
    const poolIds = orcaService.getPoolIds();
    logger.info(`Testing ${poolIds.length} pools...`);

    const results = {
      successful: 0,
      failed: 0,
      poolResults: {} as Record<string, {
        poolData?: any,
        ticksCount: number,
        error?: string
      }>
    };

    for (const poolId of poolIds) {
      const poolConfig = POOLS[poolId];
      logger.info(`\nTesting pool: ${poolId} (${poolConfig.name})`);
      
      try {
        // Test pool data
        logger.info('Fetching pool data...');
        const poolData = await orcaService.getPoolData(poolId);
        logger.info('Pool data:', JSON.stringify({
          price: poolData.price.toFixed(6),
          liquidity: poolData.liquidity.toExponential(2),
          liquidityUsd: poolData.liquidityUsd.toFixed(2),
          currentTick: poolData.tickCurrent,
          tokenAAmount: poolData.tokenAAmount.toFixed(6),
          tokenBAmount: poolData.tokenBAmount.toFixed(6)
        }, null, 2));

        // Test ticks data
        logger.info('Fetching ticks data...');
        const ticksData = await orcaService.getTicksData(poolId);
        logger.info(`Retrieved ${ticksData.length} ticks`);
        
        // Log a sample of ticks around the current tick
        const currentTick = poolData.tickCurrent;
        const nearbyTicks = ticksData
          .filter(tick => Math.abs(tick.tickIndex - currentTick) <= 1000)
          .sort((a, b) => a.tickIndex - b.tickIndex);

        if (nearbyTicks.length > 0) {
          logger.info('Sample of nearby ticks:', JSON.stringify(
            nearbyTicks.slice(0, 3).map(tick => ({
              tickIndex: tick.tickIndex,
              liquidityNet: tick.liquidityNet.toExponential(2),
              liquidityGross: tick.liquidityGross.toExponential(2)
            })), null, 2)
          );
        } else {
          logger.warn('No nearby ticks found around current tick!');
        }

        results.successful++;
        results.poolResults[poolId] = {
          poolData: {
            price: poolData.price,
            liquidity: poolData.liquidity,
            currentTick: poolData.tickCurrent
          },
          ticksCount: ticksData.length
        };

      } catch (error) {
        results.failed++;
        results.poolResults[poolId] = {
          ticksCount: 0,
          error: error instanceof Error ? error.message : String(error)
        };
        logger.error(`Error processing pool ${poolId}:`, error);
      }
    }

    // Log summary
    logger.info('\n=== Test Summary ===');
    logger.info(`Total pools tested: ${poolIds.length}`);
    logger.info(`Successful: ${results.successful}`);
    logger.info(`Failed: ${results.failed}`);
    
    if (results.failed > 0) {
      logger.info('\nFailed pools:');
      Object.entries(results.poolResults)
        .filter(([_, result]) => result.error)
        .forEach(([poolId, result]) => {
          logger.info(`${poolId}: ${result.error}`);
        });
    }

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testOrcaPools().then(() => {
  logger.info('Test completed');
  process.exit(0);
}).catch((error) => {
  logger.error('Test failed:', error);
  process.exit(1);
}); 