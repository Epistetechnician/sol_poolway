import { orcaService } from '../services/orca';
import { POOLS } from '../config/pools';
import { config } from 'dotenv';

// Load environment variables
config();

async function testTickFetching() {
  console.log('Starting tick data fetching test...\n');

  for (const [poolKey, poolConfig] of Object.entries(POOLS)) {
    console.log(`Testing ${poolConfig.name} (${poolKey})...`);
    console.log(`Address: ${poolConfig.address.toString()}`);
    console.log(`Tick Spacing: ${poolConfig.tickSpacing}`);
    
    try {
      const startTime = Date.now();
      const ticksData = await orcaService.getTicksData(poolConfig);
      const duration = Date.now() - startTime;

      console.log(`✓ Successfully fetched ${ticksData.length} ticks in ${duration}ms`);
      
      if (ticksData.length > 0) {
        // Log sample tick data
        const sampleTick = ticksData[0];
        console.log('\nSample tick data:');
        console.log(`- Tick Index: ${sampleTick.tickIndex}`);
        console.log(`- Liquidity Net: ${sampleTick.liquidityNet}`);
        console.log(`- Liquidity Gross: ${sampleTick.liquidityGross}`);
        
        // Validate tick spacing
        const tickIndices = ticksData.map(t => t.tickIndex).sort((a, b) => a - b);
        const spacings = tickIndices.slice(1).map((tick, i) => 
          Math.abs(tick - tickIndices[i])
        );
        
        const minSpacing = Math.min(...spacings);
        const maxSpacing = Math.max(...spacings);
        
        console.log('\nTick analysis:');
        console.log(`- Min spacing: ${minSpacing}`);
        console.log(`- Max spacing: ${maxSpacing}`);
        console.log(`- Tick range: ${tickIndices[0]} to ${tickIndices[tickIndices.length - 1]}`);
      }
    } catch (error) {
      console.error(`✗ Error fetching ticks for ${poolConfig.name}:`, error);
    }
    
    console.log('\n' + '-'.repeat(80) + '\n');
  }

  console.log('Test completed!');
}

// Run the test
testTickFetching().catch(console.error); 