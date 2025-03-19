import { OrcaService } from '../services/orca';
import { POOLS } from '../config/pools';
import { IPoolData, ITickData } from '../services/orca';

async function main() {
  console.log('Testing Orca Service...\n');
  const orcaService = new OrcaService();

  // Test getPoolData for SOL/USDC pool
  console.log('1. Testing getPoolData for SOL/USDC pool...');
  const solUsdcPool = await orcaService.getPoolData(POOLS['SOL/USDC']);
  console.log('Pool Data:', {
    poolAddress: solUsdcPool.poolAddress,
    price: solUsdcPool.price,
    liquidity: solUsdcPool.liquidity,
    liquidityUsd: solUsdcPool.liquidityUsd,
    tickCurrent: solUsdcPool.tickCurrent,
    timestamp: solUsdcPool.timestamp
  });
  console.log('\n');

  // Test getTicksData for SOL/USDC pool
  console.log('2. Testing getTicksData for SOL/USDC pool...');
  const ticks = await orcaService.getTicksData(POOLS['SOL/USDC']);
  console.log('Number of ticks fetched:', ticks.length);
  if (ticks.length > 0) {
    console.log('Sample tick data:', ticks[0]);
    const priceRange = {
      min: Math.min(...ticks.map((t: ITickData) => t.price)),
      max: Math.max(...ticks.map((t: ITickData) => t.price)),
      current: solUsdcPool.price
    };
    console.log('Price range:', priceRange);
    console.log('Number of in-range ticks:', ticks.filter((t: ITickData) => t.inRange).length);
  }
  console.log('\n');

  // Test getAllPoolsData
  console.log('3. Testing getAllPoolsData...');
  const allPools = await orcaService.getAllPoolsData();
  console.log('Number of pools fetched:', allPools.length);
  console.log('Pool prices:', allPools.map((pool: IPoolData) => ({
    pool: pool.poolId,
    price: pool.price
  })));
  console.log('\n');

  // Test getAllTicksData
  console.log('4. Testing getAllTicksData...');
  const allTicksData = await orcaService.getAllTicksData();
  const totalTicks = Object.values(allTicksData as Record<string, ITickData[]>)
    .reduce((sum: number, ticks: ITickData[]) => sum + ticks.length, 0);
  console.log('Total number of ticks fetched:', totalTicks);
  console.log('Ticks per pool:', Object.fromEntries(
    Object.entries(allTicksData as Record<string, ITickData[]>)
      .map(([poolId, ticks]) => [poolId, ticks.length])
  ));
  console.log('\n');

  console.log('All tests completed successfully!');
}

main().catch(console.error); 