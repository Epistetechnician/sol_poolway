#!/bin/bash

# Exit on error
set -e

echo "Setting up Solana Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js >= 16.0.0"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
if [ "$(printf '%s\n' "16.0.0" "$NODE_VERSION" | sort -V | head -n1)" = "16.0.0" ]; then 
    echo "Node.js version $NODE_VERSION detected"
else
    echo "Node.js version must be >= 16.0.0"
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL and TimescaleDB."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOL
# RPC Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Database Configuration
TIMESCALE_HOST=localhost
TIMESCALE_PORT=5432
TIMESCALE_DB=solana_pools
TIMESCALE_USER=postgres
TIMESCALE_PASSWORD=
DB_SSL=false

# Logging
LOG_LEVEL=info
EOL
    echo ".env file created. Please update with your configuration."
fi

# Create necessary directories
echo "Creating project directories..."
mkdir -p src/config src/services src/utils tests scripts

# Set up database
echo "Setting up database..."
if ! psql -U postgres -f scripts/setup_db.sql; then
    echo "Error setting up database. Please check your PostgreSQL installation and permissions."
    exit 1
fi

# Build the project
echo "Building project..."
npm run build

echo "Setup complete!"
echo "Please ensure:"
echo "1. Update the .env file with your configuration"
echo "2. PostgreSQL is running and accessible"
echo "3. TimescaleDB extension is installed"
echo ""
echo "To start the dashboard, run: npm start" 