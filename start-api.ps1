# Start API Server for Candy AI
Write-Host "🚀 Starting Candy AI API Server..." -ForegroundColor Cyan
Write-Host ""

Set-Location "C:\Users\hssli\Desktop\PolstarAI\Candy AI"
pnpm --filter @apps/api dev

