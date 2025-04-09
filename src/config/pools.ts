import { PublicKey } from '@solana/web3.js';

export interface ITokenConfig {
  address: PublicKey;
  decimals: number;
  symbol: string;
}

export interface IPoolConfig {
  name: string;
  address: PublicKey;
  tokenA: ITokenConfig;
  tokenB: ITokenConfig;
  tickSpacing: number;
}

// Common tokens used across multiple pools
const TOKENS = {
  SOL: {
    address: new PublicKey('So11111111111111111111111111111111111111112'),
    decimals: 9,
    symbol: 'SOL'
  },
  USDC: {
    address: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    decimals: 6,
    symbol: 'USDC'
  },
  cbBTC: {
    address: new PublicKey('cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij'),
    decimals: 8,
    symbol: 'cbBTC'
  },
  JLP: {
    address: new PublicKey('27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4'),
    decimals: 6,
    symbol: 'JLP'
  },
  FARTCOIN: {
    address: new PublicKey('9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump'),
    decimals: 9,
    symbol: 'FARTCOIN'
  },
  TRUMP: {
    address: new PublicKey('6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN'),
    decimals: 9,
    symbol: 'TRUMP'
  },
  AI16Z: {
    address: new PublicKey('HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC'),
    decimals: 9,
    symbol: 'AI16Z'
  },
  JUP: {
    address: new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'),
    decimals: 6,
    symbol: 'JUP'
  },
  JTOL: {
    address: new PublicKey('jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL'),
    decimals: 6,
    symbol: 'JTO'
  },
  SPX: {
    address: new PublicKey('J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr'),
    decimals: 6,
    symbol: 'SPX'
  }

};

// Standard tick spacing for Orca whirlpools
const TICK_SPACING = {
  STABLE: 1,
  STANDARD: 64,
  VOLATILE: 128
};

export const POOLS: { [key: string]: IPoolConfig } = {
  CBBTC_SOL: {
    name: 'cbBTC/SOL',
    address: new PublicKey('CeaZcxBNLpJWtxzt58qQmfMBtJY8pQLvursXTJYGQpbN'),
    tokenA: TOKENS.cbBTC,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  CBBTC_USDC: {
    name: 'cbBTC/USDC',
    address: new PublicKey('HxA6SKW5qA4o12fjVgTpXdq2YnZ5Zv1s7SB4FFomsyLM'),
    tokenA: TOKENS.cbBTC,
    tokenB: TOKENS.USDC,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  'SOL/USDC': {
    name: 'SOL/USDC',
    address: new PublicKey('HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ'),
    tokenA: TOKENS.SOL,
    tokenB: TOKENS.USDC,
    tickSpacing: 64
  },
  JLP_SOL: {
    name: 'JLP/SOL',
    address: new PublicKey('6a3m2EgFFKfsFuQtP4LJJXPcAe3TQYXNyHUjjZpUxYgd'),
    tokenA: TOKENS.JLP,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  FARTCOIN_SOL: {
    name: 'Fartcoin/SOL',
    address: new PublicKey('C9U2Ksk6KKWvLEeo5yUQ7Xu46X7NzeBJtd9PBfuXaUSM'),
    tokenA: TOKENS.FARTCOIN,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  FARTCOIN_USDC: {
    name: 'Fartcoin/SOL',
    address: new PublicKey('HMZozbw3hH12xNdXahjYPcYLrifeaFQYHgVriSLmJs1Z'),
    tokenA: TOKENS.FARTCOIN,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  TRUMP_USDC: {
    name: 'TRUMP/USDC',
    address: new PublicKey('6nD6d8gG17wakW6Wu5URktBZQp3uxp5orgPa576QXigJ'),
    tokenA: TOKENS.TRUMP,
    tokenB: TOKENS.USDC,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  TRUMP_SOL: {
    name: 'TRUMP/SOL',
    address: new PublicKey('6KX9iiLFBcwfjq3uMqeeMukaMZt5rQYTsbZZTnxbzsz6'),
    tokenA: TOKENS.TRUMP,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  AI16Z_SOL: {
    name: 'ai16z/SOL',
    address: new PublicKey('44W73kGYQgXCTNkGxUmHv8DDBPCxojBcX49uuKmbFc9U'),
    tokenA: TOKENS.AI16Z,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  JUP_SOL: {
    name: 'JUP/SOL',
    address: new PublicKey('C1MgLojNLWBKADvu9BHdtgzz1oZX4dZ5zGdGcgvvW8Wz'),
    tokenA: TOKENS.JUP,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  JTO_JitoSOL: {
    name: 'JTO/JitoSOL',
    address: new PublicKey('G2FiE1yn9N9ZJx5e1E2LxxMnHvb1H3hCuHLPfKJ98smA'),
    tokenA: TOKENS.JTOL,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  SPX_SOL: {
    name: 'SPX/SOL',
    address: new PublicKey('9YyNqgM3Wcjnzb4DXiyNBbcLEkGAyaiB4PSeQyZsFtr8'),
    tokenA: TOKENS.SPX,
    tokenB: TOKENS.SOL,
    tickSpacing: TICK_SPACING.VOLATILE
  },
  SPX_USDC: {
    name: 'SPX/USDC',
    address: new PublicKey('AgeSxtVWWMojFWYNrXKnVp9cFuC5CQ7M4rzmrseLxfUj'),
    tokenA: TOKENS.SPX,
    tokenB: TOKENS.USDC,
    tickSpacing: TICK_SPACING.VOLATILE
  }
};
// Export pool addresses array for easy iteration
export const POOL_ADDRESSES = Object.values(POOLS).map(pool => pool.address);

// Export pool names for logging and display
export const POOL_NAMES = Object.values(POOLS).map(pool => pool.name);

// Utility function to get pool config by address
export function getPoolConfigByAddress(address: string): IPoolConfig | undefined {
  return Object.values(POOLS).find(pool => pool.address.toString() === address);
}

// Utility function to get pool config by name
export function getPoolConfigByName(name: string): IPoolConfig | undefined {
  return POOLS[name];
} 