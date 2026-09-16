@echo off
REM Local Testing Setup Script for PGNest (Windows)
REM This script sets up the complete local testing environment

echo 🚀 Setting up PGNest local testing environment...

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Wrangler CLI not found. Installing...
    call npm install -g wrangler
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

REM Create local D1 database and apply schema
echo 🗄️ Setting up local D1 database...
call wrangler d1 execute pgnest-db --local --file=./database/schema.sql

REM Generate and apply test data
echo 📊 Populating test data...
call npx tsx database/migrate-data.ts > database/data-migration.sql
call wrangler d1 execute pgnest-db --local --file=./database/data-migration.sql

REM Create .env file for local development
echo ⚙️ Setting up environment variables...
echo VITE_API_BASE_URL="http://localhost:8787" > .env

REM Verify setup
echo ✅ Setup complete!
echo.
echo 📋 Next steps:
echo 1. Start Workers backend: wrangler dev
echo 2. Start Frontend: npm run dev
echo 3. Open browser: http://localhost:3000
echo.
echo 🧪 To test Workers: curl http://localhost:8787/api/health
echo 🧪 To run tests: npm run test:worker

pause