# Start API Server for Candy AI
Write-Host "🚀 Starting Candy AI API Server..." -ForegroundColor Cyan
Write-Host ""

# Use current directory (no need to change location)
pnpm --filter @apps/api dev

