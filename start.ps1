# Mots 简单启动脚本

Write-Host "Starting Mots development environment..." -ForegroundColor Green

# 检查 Node.js
try {
    $nodeVersion = node --version 2>$null
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not installed, please install Node.js first" -ForegroundColor Red
    exit 1
}

# 检查 pnpm
try {
    $pnpmVersion = pnpm --version 2>$null
    Write-Host "pnpm version: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "pnpm not installed, installing..." -ForegroundColor Yellow
    npm install -g pnpm
}

Write-Host "Starting backend service..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:/ai_code/Mots/backend'; pnpm dev"

Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Starting frontend service..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:/ai_code/Mots/app'; pnpm dev"

Write-Host "`n🎉 Mots development environment is starting!" -ForegroundColor Green
Write-Host "`n📍 Service URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:2402/" -ForegroundColor White
Write-Host "   Backend:  http://localhost:3001/" -ForegroundColor White
Write-Host "   Health:   http://localhost:3001/health" -ForegroundColor White

Write-Host "`n💡 Tips:" -ForegroundColor Yellow
Write-Host "   - Two new PowerShell windows opened" -ForegroundColor Gray
Write-Host "   - Close windows to stop corresponding services" -ForegroundColor Gray
Write-Host "   - Frontend supports hot reload, code changes will refresh automatically" -ForegroundColor Gray