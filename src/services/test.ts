import { fetchConcentratedLiquidityPool, setWhirlpoolsConfig } from '@orca-so/whirlpools';
import { createSolanaRpc, mainnet, address } from '@solana/kit';

async function main() {
  await setWhirlpoolsConfig('solanaMainnet');
  const mainnetRpc = createSolanaRpc(mainnet('https://solana-mainnet.g.alchemy.com/v2/QbQkAgj1nrNdLpR09fDOXcYYns8dhiqr'));
 
  const tokenMintOne = address("So11111111111111111111111111111111111111112");
  const tokenMintTwo = address("cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij");
  const tickSpacing = 64;
 
  const poolInfo = await fetchConcentratedLiquidityPool(
    mainnetRpc,
    tokenMintOne,
    tokenMintTwo,
    tickSpacing
  );
 
  if (poolInfo.initialized) {
    console.log("Pool is initialized:", poolInfo);
  } else {
    console.log("Pool is not initialized:", poolInfo);
  };
}

main().catch(console.error);