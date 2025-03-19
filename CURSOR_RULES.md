# Solana Dashboard Cursor Rules

## Project Structure
- Keep all Solana-specific code in the `solana_dashboard` directory
- Maintain separate files for different concerns (data collection, analysis, utilities)
- Follow a modular approach with clear separation of responsibilities

## Code Organization
- Maximum file size: 500 lines (split if larger)
- Group related functionality into modules
- Use TypeScript for type safety
- Keep functions focused and single-purpose

## Naming Conventions
- Use PascalCase for classes and interfaces
- Use camelCase for variables and functions
- Use UPPER_SNAKE_CASE for constants
- Prefix interfaces with 'I' (e.g., IPoolData)

## Pool Configuration
- Store pool addresses in a separate config file
- Use constants for token decimals and other static values
- Document each pool's purpose and trading pairs

## Data Collection
- Implement rate limiting for RPC calls
- Use connection pooling for database operations
- Handle network errors gracefully
- Cache frequently accessed data

## Error Handling
- Use try-catch blocks for all async operations
- Log errors with appropriate context
- Implement retries for transient failures
- Provide meaningful error messages

## Database Operations
- Use parameterized queries
- Implement proper indexing
- Handle connection management carefully
- Use transactions where appropriate

## Security
- Never commit API keys or secrets
- Use environment variables for sensitive data
- Implement rate limiting
- Validate all inputs

## Testing
- Write unit tests for critical functions
- Implement integration tests for data flow
- Test error handling scenarios
- Mock external dependencies

## Documentation
- Document all functions with JSDoc
- Keep README up to date
- Document pool configurations
- Include setup instructions

## Performance
- Optimize RPC calls
- Implement caching where appropriate
- Use connection pooling
- Monitor memory usage

## Monitoring
- Log important events
- Track error rates
- Monitor pool liquidity changes
- Alert on significant price movements

## File Structure
```
solana_dashboard/
├── src/
│   ├── config/
│   │   ├── pools.ts
│   │   └── constants.ts
│   ├── services/
│   │   ├── orca.ts
│   │   └── database.ts
│   ├── utils/
│   │   ├── rpc.ts
│   │   └── math.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── tests/
├── scripts/
└── README.md
```

## Tracked Pools
1. cbBTC/SOL (CeaZcxBNLpJWtxzt58qQmfMBtJY8pQLvursXTJYGQpbN)
2. cbBTC/USDC (HxA6SKW5qA4o12fjVgTpXdq2YnZ5Zv1s7SB4FFomsyLM)
3. SOL/USDC (Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE)
4. JLP/SOL (27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4)
5. Fartcoin/SOL (C9U2Ksk6KKWvLEeo5yUQ7Xu46X7NzeBJtd9PBfuXaUSM)
6. TRUMP/USDC (6nD6d8gG17wakW6Wu5URktBZQp3uxp5orgPa576QXigJ)
7. TRUMP/SOL (6KX9iiLFBcwfjq3uMqeeMukaMZt5rQYTsbZZTnxbzsz6)
8. ai16z/SOL (44W73kGYQgXCTNkGxUmHv8DDBPCxojBcX49uuKmbFc9U)

## Database Schema
```sql
-- Pool data table
CREATE TABLE IF NOT EXISTS public.solana_pool_data (
    timestamp TIMESTAMPTZ NOT NULL,
    pool_address TEXT NOT NULL,
    token_a_amount NUMERIC NOT NULL,
    token_b_amount NUMERIC NOT NULL,
    sqrt_price NUMERIC NOT NULL,
    liquidity NUMERIC NOT NULL,
    tick_current INTEGER NOT NULL,
    fee_growth_global_a NUMERIC NOT NULL,
    fee_growth_global_b NUMERIC NOT NULL,
    PRIMARY KEY (timestamp, pool_address)
);

-- Price data table
CREATE TABLE IF NOT EXISTS public.solana_price_data (
    timestamp TIMESTAMPTZ NOT NULL,
    pool_address TEXT NOT NULL,
    price NUMERIC NOT NULL,
    volume_24h NUMERIC,
    liquidity_usd NUMERIC,
    PRIMARY KEY (timestamp, pool_address)
);

-- Ticks data table
CREATE TABLE IF NOT EXISTS public.solana_ticks_data (
    timestamp TIMESTAMPTZ NOT NULL,
    pool_address TEXT NOT NULL,
    tick_index INTEGER NOT NULL,
    liquidity_net NUMERIC,
    liquidity_gross NUMERIC,
    fee_growth_outside_a NUMERIC,
    fee_growth_outside_b NUMERIC,
    PRIMARY KEY (timestamp, pool_address, tick_index)
);
``` 