# PowerShell Development Environment Startup Script
Write-Host "Starting Mots Development Environment..." -ForegroundColor Green

# Set Environment Variables
$env:DB_TYPE = "postgresql"
$env:DB_HOST = "192.168.4.111"
$env:DB_PORT = "5432"
$env:DB_NAME = "mots"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "password"
$env:USE_POSTGRES = "true"
$env:NODE_ENV = "development"
$env:TZ = "Asia/Shanghai"

# Get current directory path
$currentDir = Get-Location

# Check and install backend dependencies
Set-Location backend
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}

# Start backend service in new window
Write-Host "Starting backend service in new window..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$currentDir\backend'; `$env:TZ='Asia/Shanghai'; npm run dev"

# Start frontend service in new window
Write-Host "Starting frontend service in new window..." -ForegroundColor Yellow
Set-Location ..\app
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$currentDir\app'; `$env:VITE_PORT='3000'; `$env:VITE_HOST='0.0.0.0'; `$env:TZ='Asia/Shanghai'; npm run dev"

Set-Location ..

Write-Host ""
Write-Host "Services started in separate windows!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend: http://localhost:3001" -ForegroundColor White
Write-Host ""

Write-Host ""
Write-Host "📝 两个新的 PowerShell 窗口已打开：" -ForegroundColor Cyan
Write-Host "   - 后端服务窗口（蓝色标题）" -ForegroundColor Gray
Write-Host "   - 前端服务窗口（蓝色标题）" -ForegroundColor Gray
Write-Host ""

Write-Host "🛑 停止服务的方法：" -ForegroundColor Yellow
Write-Host "   1. 关闭对应的 PowerShell 窗口" -ForegroundColor White
Write-Host "   2. 或在窗口中按 Ctrl+C" -ForegroundColor White
Write-Host "   3. 或使用以下命令强制停止所有 Node.js 进程：" -ForegroundColor White
Write-Host "      taskkill /F /IM node.exe" -ForegroundColor Gray
Write-Host ""

Write-Host "⏳ 等待服务启动中..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "✅ 启动完成！请查看新打开的窗口中的日志信息。" -ForegroundColor Green
Write-Host "🚀 你可以关闭此窗口，前后端服务会继续运行。" -ForegroundColor Cyan