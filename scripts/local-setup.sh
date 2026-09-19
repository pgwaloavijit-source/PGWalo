#!/bin/bash

# Local Testing Setup Script for PGNest
# This script sets up the complete local testing environment

echo "🚀 Setting up PGNest local testing environment..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create local D1 database and apply schema
echo "🗄️ Setting up local D1 database..."
wrangler d1 execute pgwalo-db --local --file=./database/schema.sql

# Generate and apply test data
echo "📊 Populating test data..."
npx tsx database/migrate-data.ts > database/data-migration.sql
wrangler d1 execute pgwalo-db --local --file=./database/data-migration.sql

# Create local Worker secrets template without overwriting existing secrets.
if [ ! -f .dev.vars ]; then cp .dev.vars.example .dev.vars; fi

# Create .env file for local development
echo "⚙️ Setting up environment variables..."
cat > .env << EOF
VITE_API_BASE_URL="http://localhost:8787"
EOF

# Verify setup
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start Workers backend: wrangler dev"
echo "2. Start Frontend: npm run dev"
echo "3. Open browser: http://localhost:3000"
echo ""
echo "🧪 To test Workers: curl http://localhost:8787/api/health"
echo "🧪 To run tests: npm run test:worker"
