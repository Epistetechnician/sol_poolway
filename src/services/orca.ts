import { fetchConcentratedLiquidityPool, setWhirlpoolsConfig } from '@orca-so/whirlpools';
import { 
  isPositionInRange,
  increaseLiquidityQuoteA,
  sqrtPriceToPrice,
  tickIndexToPrice,
  priceToTickIndex,
  getNextInitializableTickIndex
} from '@orca-so/whirlpools-core';
import { createSolanaRpc, mainnet, type Rpc, type GetAccountInfoApi, type GetMultipleAccountsApi, type Address } from '@solana/kit';
import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection, withRetry, withRateLimit } from '../utils/rpc';
import { POOLS, IPoolConfig } from '../config/pools';
import { RPC_CONFIG } from '../config/constants';
import Decimal from 'decimal.js';

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
  private rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>;

  private constructor() {
    setWhirlpoolsConfig('solanaMainnet');
    this.rpc = createSolanaRpc(mainnet(RPC_CONFIG.MAINNET_URL));
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
      const pool = await fetchConcentratedLiquidityPool(
        this.rpc,
        poolConfig.tokenA.address.toString() as Address,
        poolConfig.tokenB.address.toString() as Address,
        poolConfig.tickSpacing
      );

      if (!pool.initialized) {
        throw new Error(`Pool ${poolConfig.name} is not initialized`);
      }

      // Convert sqrtPrice to bigint for price calculation
      const sqrtPriceBigInt = BigInt(pool.sqrtPrice);
      const price = sqrtPriceToPrice(
        sqrtPriceBigInt,
        poolConfig.tokenA.decimals,
        poolConfig.tokenB.decimals
      ).toString();

      // Calculate token amounts based on liquidity and current price
      const liquidity = pool.liquidity.toString();
      const liquidityNum = parseFloat(liquidity);
      const priceNum = parseFloat(price);
      
      // Simplified token amount calculation
      const tokenAAmount = liquidityNum / Math.sqrt(priceNum);
      const tokenBAmount = liquidityNum * Math.sqrt(priceNum);
      
      // Calculate USD value of liquidity (assuming tokenB is a stablecoin)
      const liquidityUsd = tokenBAmount;

      return {
        timestamp: new Date(),
        poolAddress: poolConfig.address.toString(),
        tokenAAmount,
        tokenBAmount,
        sqrtPrice: Number(sqrtPriceBigInt),
        liquidity: liquidityNum,
        tickCurrent: pool.tickCurrentIndex,
        feeGrowthGlobalA: parseFloat(pool.feeGrowthGlobalA.toString()),
        feeGrowthGlobalB: parseFloat(pool.feeGrowthGlobalB.toString()),
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
      const pool = await fetchConcentratedLiquidityPool(
        this.rpc,
        poolConfig.tokenA.address.toString() as Address,
        poolConfig.tokenB.address.toString() as Address,
        poolConfig.tickSpacing
      );

      if (!pool.initialized) {
        throw new Error(`Pool ${poolConfig.name} is not initialized`);
      }

      // Calculate tick range to fetch
      const tickSpacing = poolConfig.tickSpacing;
      const currentTick = pool.tickCurrentIndex;
      const tickArraySize = 88; // Standard Orca tick array size
      const numArrays = 10; // Number of tick arrays to fetch on each side

      const startTick = currentTick - (tickArraySize * tickSpacing * numArrays);
      const endTick = currentTick + (tickArraySize * tickSpacing * numArrays);

      const ticks: ITickData[] = [];
      const timestamp = new Date();

      // Generate tick data for the range
      for (let tickIndex = startTick; tickIndex <= endTick; tickIndex += tickSpacing) {
        const tickPrice = tickIndexToPrice(
          tickIndex,
          poolConfig.tokenA.decimals,
          poolConfig.tokenB.decimals
        );

        ticks.push({
          timestamp,
          poolAddress: poolConfig.address.toString(),
          tickIndex,
          liquidityNet: 0, // Would need to fetch actual liquidity data
          liquidityGross: 0, // Would need to fetch actual liquidity data
          feeGrowthOutsideA: 0, // Would need to fetch actual fee data
          feeGrowthOutsideB: 0 // Would need to fetch actual fee data
        });
      }

      return ticks;
    });
  }
}

// Export singleton instance
export const orcaService = OrcaService.getInstance(); 