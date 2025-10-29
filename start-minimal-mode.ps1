# Candy AI - Minimal Mode Startup Script
Write-Host "🔧 Starting Candy AI in Minimal Mode..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "apps/api/src/index.ts")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

# Check for .env file
if (-not (Test-Path "apps/api/.env")) {
    Write-Host "⚠️  Warning: apps/api/.env not found" -ForegroundColor Yellow
}

# Navigate to API directory
Write-Host "📁 Navigating to API directory..." -ForegroundColor Gray
Set-Location "apps/api"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    pnpm install
}

# Start the API server
Write-Host ""
Write-Host "🚀 Starting API server on http://localhost:3001..." -ForegroundColor Green
Write-Host "   Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Run the dev server
pnpm dev

