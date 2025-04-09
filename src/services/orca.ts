import { fetchConcentratedLiquidityPool, setWhirlpoolsConfig } from '@orca-so/whirlpools';
import { sqrtPriceToPrice, tickIndexToPrice } from '@orca-so/whirlpools-core';
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { createSolanaRpc, mainnet, address } from '@solana/kit';
import { getConnection, withRetry } from '../utils/rpc';
import { POOLS } from '../config/pools';
import { logger } from '../utils/logger';
import { RPC_CONFIG } from '../config/constants';
import { WhirlpoolContext, TickArrayUtil, buildWhirlpoolClient } from '@orca-so/whirlpools-sdk';
import { AnchorProvider } from '@coral-xyz/anchor';
import { BN } from 'bn.js';

// Constants
const WHIRLPOOL_PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
const TICK_ARRAY_SIZE = 88; // Standard size for Orca tick arrays

export interface IPoolData {
  timestamp: Date;
  poolAddress: string;
  tokenAAmount: number;
  tokenBAmount: number;
  sqrtPrice: number;
  liquidity: number;
  tickCurrent: number;
  feeGrowthGlobalA: number;
  feeGrowthGlobalB: number;
  price: number;
  liquidityUsd: number;
  volume24h?: number;
}

export interface ITickData {
  timestamp: Date;
  poolAddress: string;
  tickIndex: number;
  liquidityNet: number;
  liquidityGross: number;
  feeGrowthOutsideA: number;
  feeGrowthOutsideB: number;
}

export class OrcaService {
  private static instance: OrcaService;
  private connection: Connection;
  private rpc: ReturnType<typeof createSolanaRpc>;
  private context: WhirlpoolContext;
  private client: ReturnType<typeof buildWhirlpoolClient>;

  private constructor() {
    this.connection = getConnection();
    setWhirlpoolsConfig('solanaMainnet');
    this.rpc = createSolanaRpc(mainnet(RPC_CONFIG.MAINNET_URL));

    // Initialize WhirlpoolContext and client with a read-only provider
    const readOnlyKeypair = Keypair.generate(); // Generate a throwaway keypair
    const provider = new AnchorProvider(
      this.connection,
      {
        publicKey: readOnlyKeypair.publicKey,
        signTransaction: async () => { throw new Error('Read-only wallet cannot sign transactions'); },
        signAllTransactions: async () => { throw new Error('Read-only wallet cannot sign transactions'); }
      },
      { commitment: 'confirmed' }
    );

    this.context = WhirlpoolContext.withProvider(provider, WHIRLPOOL_PROGRAM_ID);
    this.client = buildWhirlpoolClient(this.context);
  }

  public static getInstance(): OrcaService {
    if (!OrcaService.instance) {
      OrcaService.instance = new OrcaService();
    }
    return OrcaService.instance;
  }

  /**
   * Get all configured pool IDs
   * @returns Array of pool IDs
   */
  public getPoolIds(): string[] {
    return Object.keys(POOLS);
  }

  /**
   * Get pool data for a specific pool
   * @param poolId The pool identifier
   * @returns Promise resolving to pool data
   */
  public async getPoolData(poolId: string): Promise<IPoolData> {
    const poolConfig = POOLS[poolId];
    if (!poolConfig) {
      throw new Error(`Pool configuration not found for ${poolId}`);
    }

    return withRetry(async () => {
      const pool = await this.client.getPool(new PublicKey(poolConfig.address));
      const poolData = await pool.getData();

      // Convert sqrtPrice to price
      const price = sqrtPriceToPrice(
        BigInt(poolData.sqrtPrice.toString()),
        poolConfig.tokenA.decimals,
        poolConfig.tokenB.decimals
      );

      const liquidity = Number(poolData.liquidity);
      const liquidityUsd = liquidity * Number(price);

      // Calculate token amounts based on liquidity and current price
      const priceNum = Number(price);
      const tokenAAmount = liquidity / Math.sqrt(priceNum);
      const tokenBAmount = liquidity * Math.sqrt(priceNum);

      return {
        timestamp: new Date(),
        poolAddress: poolConfig.address.toString(),
        tokenAAmount,
        tokenBAmount,
        sqrtPrice: Number(poolData.sqrtPrice),
        liquidity,
        tickCurrent: poolData.tickCurrentIndex,
        feeGrowthGlobalA: Number(poolData.feeGrowthGlobalA),
        feeGrowthGlobalB: Number(poolData.feeGrowthGlobalB),
        price: priceNum,
        liquidityUsd,
        volume24h: 0 // This would need to be calculated from historical data
      };
    });
  }

  /**
   * Get ticks data for a specific pool
   * @param poolId The pool identifier
   * @returns Promise resolving to array of tick data
   */
  public async getTicksData(poolId: string): Promise<ITickData[]> {
    const poolConfig = POOLS[poolId];
    if (!poolConfig) {
      throw new Error(`Pool configuration not found for ${poolId}`);
    }

    return withRetry(async () => {
      const pool = await this.client.getPool(new PublicKey(poolConfig.address));
      if (!pool) {
        throw new Error(`Pool not found for ${poolConfig.name}`);
      }

      const poolData = await pool.getData();
      const currentTick = poolData.tickCurrentIndex;
      const tickSpacing = poolData.tickSpacing;

      logger.info(`\n${'='.repeat(80)}`);
      logger.info(`🔍 FETCHING TICK DATA FOR POOL: ${poolConfig.name} (${poolId})`);
      logger.info(`${'='.repeat(80)}\n`);
      logger.info(`Pool address: ${poolConfig.address}`);
      logger.info(`Current tick: ${currentTick}, Tick spacing: ${tickSpacing}`);
      logger.info(`Pool price: ${poolData.sqrtPrice ? sqrtPriceToPrice(
        BigInt(poolData.sqrtPrice.toString()),
        poolConfig.tokenA.decimals,
        poolConfig.tokenB.decimals
      ) : 'Unknown'}`);
      logger.info(`Liquidity: ${poolData.liquidity ? poolData.liquidity.toString() : 'Unknown'}`);

      // Get tick array PDAs around the current tick with increased range
      // We'll get 20 tick arrays to ensure we capture all active ticks
      const tickArrayPDAs = TickArrayUtil.getTickArrayPDAs(
        currentTick,
        tickSpacing,
        20, // Get more tick arrays to ensure we capture all activity
        WHIRLPOOL_PROGRAM_ID,
        new PublicKey(poolConfig.address),
        true // Direction doesn't matter since we're getting arrays on both sides
      );

      logger.info(`\n📊 Found ${tickArrayPDAs.length} tick arrays to process`);
      
      // Log the startTickIndex of each tick array to better understand the coverage
      logger.info(`\n${'*'.repeat(60)}`);
      logger.info(`📊 TICK ARRAY COVERAGE`);
      logger.info(`${'*'.repeat(60)}\n`);
      
      const tickArrayStartIndices = tickArrayPDAs.map((pda, index) => {
        // Calculate approximate start tick index based on current tick and array width
        const arrayWidth = TICK_ARRAY_SIZE * tickSpacing;
        const offset = index - Math.floor(tickArrayPDAs.length / 2);
        const startTickIndex = Math.floor(currentTick / arrayWidth) * arrayWidth + (offset * arrayWidth);
        
        return { 
          index,
          pda: pda.publicKey.toString(), 
          approximateStartTickIndex: startTickIndex,
          approximateEndTickIndex: startTickIndex + arrayWidth,
          priceRangeLower: tickIndexToPrice(startTickIndex, poolConfig.tokenA.decimals, poolConfig.tokenB.decimals),
          priceRangeUpper: tickIndexToPrice(startTickIndex + arrayWidth, poolConfig.tokenA.decimals, poolConfig.tokenB.decimals)
        };
      });
      
      for (const array of tickArrayStartIndices) {
        logger.info(`Tick Array ${array.index + 1}:`);
        logger.info(`   └─ PDA: ${array.pda.slice(0, 10)}...`);
        logger.info(`   └─ Tick Range: ${array.approximateStartTickIndex} to ${array.approximateEndTickIndex}`);
        logger.info(`   └─ Price Range: ${array.priceRangeLower} to ${array.priceRangeUpper}`);
        logger.info(`   └─ Includes current tick: ${
          array.approximateStartTickIndex <= currentTick && 
          currentTick < array.approximateEndTickIndex ? 'YES ✓' : 'NO'
        }`);
      }

      const ticksData: ITickData[] = [];
      const timestamp = new Date();

      // Fetch and process each tick array
      for (const pda of tickArrayPDAs) {
        try {
          const tickArrayAccount = await this.connection.getAccountInfo(pda.publicKey);
          if (!tickArrayAccount) {
            logger.debug(`❌ No tick array account found for PDA ${pda.publicKey.toString()}`);
            continue;
          }

          // Decode the tick array data
          const tickArray = this.context.program.coder.accounts.decode(
            'TickArray',
            tickArrayAccount.data
          );

          const startTickIndex = tickArray.startTickIndex;
          logger.info(`\n${'*'.repeat(60)}`);
          logger.info(`📈 PROCESSING TICK ARRAY: ${startTickIndex}`);
          logger.info(`${'*'.repeat(60)}\n`);
          logger.info(`Array PDA: ${pda.publicKey.toString()}`);
          logger.info(`Start tick index: ${startTickIndex}`);
          logger.info(`End tick index: ${startTickIndex + (TICK_ARRAY_SIZE * tickSpacing)}`);
          
          // Try to fetch active positions around this tick range to ensure we get live data
          await this.getActivePositionsAroundTickArray(poolConfig.address.toString(), startTickIndex, tickSpacing);
          
          // Log the raw tick array data structure for debugging
          logger.debug(`Raw tick array data: ${JSON.stringify(tickArray, (_, v) => 
            typeof v === 'bigint' ? v.toString() : v, 2)}`);

          // Process each tick in the array
          let initializedTicks = 0;
          for (let i = 0; i < tickArray.ticks.length; i++) {
            const tick = tickArray.ticks[i];
            
            // Skip uninitialized ticks but also log the first few to understand the structure
            if (!tick.initialized) {
              if (i < 3) {
                logger.debug(`Example uninitialized tick at index ${i}: ${JSON.stringify(tick, (_, v) => 
                  typeof v === 'bigint' ? v.toString() : v, 2)}`);
              }
              continue;
            }

            initializedTicks++;

            // Calculate the actual tick index based on position in array and tick spacing
            const tickIndex = startTickIndex + (i * tickSpacing);
            
            // Validate tick index
            if (typeof tickIndex !== 'number' || isNaN(tickIndex)) {
              logger.warn(`⚠️ Invalid tick index calculated for pool ${poolId}: ${tickIndex}`);
              continue;
            }

            // Log the raw tick data for debugging
            logger.debug(`Raw tick data for ${tickIndex}: ${JSON.stringify(tick, (_, v) => 
              typeof v === 'bigint' ? v.toString() : v, 2)}`);

            // Convert BigInts to numbers safely with proper access patterns
            // Handle both object-style access and direct property access that might be used in different SDK versions
            let liquidityNet = 0;
            if (tick.liquidityNet !== undefined) {
              if (typeof tick.liquidityNet === 'object' && tick.liquidityNet !== null) {
                liquidityNet = Number(tick.liquidityNet.toString());
              } else if (typeof tick.liquidityNet === 'bigint') {
                liquidityNet = Number(tick.liquidityNet.toString());
              } else {
                liquidityNet = Number(tick.liquidityNet);
              }
            }

            let liquidityGross = 0;
            if (tick.liquidityGross !== undefined) {
              if (typeof tick.liquidityGross === 'object' && tick.liquidityGross !== null) {
                liquidityGross = Number(tick.liquidityGross.toString());
              } else if (typeof tick.liquidityGross === 'bigint') {
                liquidityGross = Number(tick.liquidityGross.toString());
              } else {
                liquidityGross = Number(tick.liquidityGross);
              }
            }

            let feeGrowthOutsideA = 0;
            if (tick.feeGrowthOutsideA !== undefined) {
              if (typeof tick.feeGrowthOutsideA === 'object' && tick.feeGrowthOutsideA !== null) {
                feeGrowthOutsideA = Number(tick.feeGrowthOutsideA.toString());
              } else if (typeof tick.feeGrowthOutsideA === 'bigint') {
                feeGrowthOutsideA = Number(tick.feeGrowthOutsideA.toString());
              } else {
                feeGrowthOutsideA = Number(tick.feeGrowthOutsideA);
              }
            }

            let feeGrowthOutsideB = 0;
            if (tick.feeGrowthOutsideB !== undefined) {
              if (typeof tick.feeGrowthOutsideB === 'object' && tick.feeGrowthOutsideB !== null) {
                feeGrowthOutsideB = Number(tick.feeGrowthOutsideB.toString());
              } else if (typeof tick.feeGrowthOutsideB === 'bigint') {
                feeGrowthOutsideB = Number(tick.feeGrowthOutsideB.toString());
              } else {
                feeGrowthOutsideB = Number(tick.feeGrowthOutsideB);
              }
            }

            // Enhanced debug logging with better formatting
            logger.info(`\n${'~'.repeat(40)}`);
            logger.info(`🎯 TICK DATA [${tickIndex}]:`);
            logger.info(`${'~'.repeat(40)}`);
            logger.info(`   └─ Array position: ${i}/${tickArray.ticks.length}`);
            logger.info(`   └─ Initialized: ${tick.initialized ? 'YES ✓' : 'NO'}`);
            logger.info(`   └─ Liquidity Net: ${liquidityNet} (${liquidityNet !== 0 ? '✓' : '✗'})`);
            logger.info(`   └─ Liquidity Gross: ${liquidityGross} (${liquidityGross !== 0 ? '✓' : '✗'})`);
            logger.info(`   └─ Fee Growth Outside A: ${feeGrowthOutsideA} (${feeGrowthOutsideA !== 0 ? '✓' : '✗'})`);
            logger.info(`   └─ Fee Growth Outside B: ${feeGrowthOutsideB} (${feeGrowthOutsideB !== 0 ? '✓' : '✗'})`);
            
            const tickPrice = tickIndexToPrice(tickIndex, poolConfig.tokenA.decimals, poolConfig.tokenB.decimals);
            logger.info(`   └─ Price: ${tickPrice}`);
            logger.info(`   └─ Is active: ${liquidityNet !== 0 || liquidityGross !== 0 ? 'YES ✓' : 'NO ✗'}`);

            ticksData.push({
              timestamp,
              poolAddress: poolConfig.address.toString(),
              tickIndex,
              liquidityNet,
              liquidityGross,
              feeGrowthOutsideA,
              feeGrowthOutsideB
            });
          }

          logger.info(`\n✅ Processed ${initializedTicks} initialized ticks in this array`);
        } catch (error) {
          logger.warn(`❌ Failed to fetch tick array for pool ${poolId}: ${error}`);
          continue;
        }
      }

      logger.info(`\n${'='.repeat(80)}`);
      logger.info(`📊 SUMMARY FOR POOL: ${poolConfig.name}`);
      logger.info(`${'='.repeat(80)}\n`);
      logger.info(`   └─ Total ticks processed: ${ticksData.length}`);
      
      const nonZeroLiquidityTicks = ticksData.filter(t => t.liquidityNet !== 0 || t.liquidityGross !== 0);
      const nonZeroFeeTicks = ticksData.filter(t => t.feeGrowthOutsideA !== 0 || t.feeGrowthOutsideB !== 0);
      
      logger.info(`   └─ Ticks with non-zero liquidity: ${nonZeroLiquidityTicks.length} (${Math.round(nonZeroLiquidityTicks.length / ticksData.length * 100)}%)`);
      logger.info(`   └─ Ticks with non-zero fee growth: ${nonZeroFeeTicks.length} (${Math.round(nonZeroFeeTicks.length / ticksData.length * 100)}%)`);
      
      // Show first few non-zero ticks if any exist
      if (nonZeroLiquidityTicks.length > 0) {
        logger.info(`\n   └─ Sample of non-zero liquidity ticks:`);
        for (let i = 0; i < Math.min(3, nonZeroLiquidityTicks.length); i++) {
          const tick = nonZeroLiquidityTicks[i];
          logger.info(`      └─ Tick ${tick.tickIndex}: liquidityNet=${tick.liquidityNet}, liquidityGross=${tick.liquidityGross}`);
        }
      }
      return ticksData;
    });
  }

  /**
   * Helper method to find active positions around a tick array
   * This helps ensure we get actual liquidity data
   */
  private async getActivePositionsAroundTickArray(
    poolAddress: string,
    startTickIndex: number,
    tickSpacing: number
  ): Promise<void> {
    try {
      logger.info(`\n${'#'.repeat(60)}`);
      logger.info(`🔎 CHECKING FOR ACTIVE POSITIONS`);
      logger.info(`${'#'.repeat(60)}\n`);
      logger.info(`Pool: ${poolAddress}`);
      logger.info(`Tick array starting at: ${startTickIndex}`);
      
      // Query for positions on this pool - we use getProgramAccounts to find all position accounts
      const positions = await this.connection.getProgramAccounts(
        WHIRLPOOL_PROGRAM_ID,
        {
          filters: [
            { dataSize: 200 }, // Approximate size of position accounts
            {
              memcmp: {
                offset: 8, // After the discriminator
                bytes: new PublicKey(poolAddress).toBase58() // Filter by the pool address
              }
            }
          ]
        }
      );
      
      if (positions.length > 0) {
        logger.info(`\n📋 Found ${positions.length} positions for pool ${poolAddress}`);
        
        // Decode and log the first few positions for debugging
        for (let i = 0; i < Math.min(5, positions.length); i++) {
          try {
            const positionData = this.context.program.coder.accounts.decode(
              'Position',
              positions[i].account.data
            );
            
            logger.info(`\n👤 Position ${i + 1} (${positions[i].pubkey.toString().slice(0, 8)}...):`);
            const liquidity = positionData.liquidity ? positionData.liquidity.toString() : '0';
            const lowerTickIndex = positionData.tickLowerIndex;
            const upperTickIndex = positionData.tickUpperIndex;
            
            logger.info(`   └─ Liquidity: ${liquidity} (${liquidity !== '0' ? 'ACTIVE ✓' : 'INACTIVE ✗'})`);
            logger.info(`   └─ Lower Tick: ${lowerTickIndex}`);
            logger.info(`   └─ Upper Tick: ${upperTickIndex}`);
            
            // Calculate price range
            if (lowerTickIndex !== undefined && upperTickIndex !== undefined) {
              try {
                // Get the pool configuration to determine token decimals for price calculation
                const poolConfig = Object.values(POOLS).find(p => p.address.toString() === poolAddress);
                if (poolConfig) {
                  const lowerPrice = tickIndexToPrice(lowerTickIndex, poolConfig.tokenA.decimals, poolConfig.tokenB.decimals);
                  const upperPrice = tickIndexToPrice(upperTickIndex, poolConfig.tokenA.decimals, poolConfig.tokenB.decimals);
                  
                  logger.info(`   └─ Price Range: ${lowerPrice} to ${upperPrice}`);
                }
              } catch (error) {
                logger.debug(`Failed to calculate price range: ${error}`);
              }
              
              // Determine if position intersects with current tick array range
              const arrayEnd = startTickIndex + (TICK_ARRAY_SIZE * tickSpacing);
              const inRange = (lowerTickIndex <= arrayEnd && upperTickIndex >= startTickIndex);
              logger.info(`   └─ Intersects with current tick array: ${inRange ? 'YES ✓' : 'NO ✗'}`);
              
              // Calculate which tick arrays this position covers
              const lowerTickArrayStartIndex = Math.floor(lowerTickIndex / (TICK_ARRAY_SIZE * tickSpacing)) * (TICK_ARRAY_SIZE * tickSpacing);
              const upperTickArrayStartIndex = Math.floor(upperTickIndex / (TICK_ARRAY_SIZE * tickSpacing)) * (TICK_ARRAY_SIZE * tickSpacing);
              
              logger.info(`   └─ Tick Arrays Covered:`);
              logger.info(`      └─ Lower: ${lowerTickArrayStartIndex} to ${lowerTickArrayStartIndex + (TICK_ARRAY_SIZE * tickSpacing)}`);
              logger.info(`      └─ Upper: ${upperTickArrayStartIndex} to ${upperTickArrayStartIndex + (TICK_ARRAY_SIZE * tickSpacing)}`);
              
              // Log the raw position data for deeper inspection
              logger.debug(`Position raw data: ${JSON.stringify(positionData, (_, v) => 
                typeof v === 'bigint' ? v.toString() : v, 2)}`);
            }
          } catch (error) {
            logger.warn(`Failed to decode position: ${error}`);
          }
        }
      } else {
        logger.info(`No positions found for pool ${poolAddress}`);
      }
    } catch (error) {
      logger.warn(`Error fetching positions: ${error}`);
    }
  }
}

// Export singleton instance
export const orcaService = OrcaService.getInstance(); 