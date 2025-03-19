import { Connection } from '@solana/web3.js';
import { RPC_CONFIG } from '../config/constants';

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      { commitment: 'confirmed' }
    );
  }
  return connection;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = RPC_CONFIG.MAX_RETRIES,
  delay: number = RPC_CONFIG.RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function withRateLimit<T>(
  fn: () => Promise<T>,
  delay: number = RPC_CONFIG.RATE_LIMIT_DELAY
): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, delay));
  return fn();
}

export async function batchRequest<T>(
  requests: (() => Promise<T>)[],
  batchSize: number = RPC_CONFIG.BATCH_SIZE
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(request => withRetry(request))
    );
    results.push(...batchResults);
  }

  return results;
} 