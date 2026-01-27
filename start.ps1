# Mots Development Startup Script
Write-Host "Starting Mots Development..." -ForegroundColor Green

# Environment Variables
$env:DB_TYPE = "postgresql"
$env:DB_HOST = "192.168.4.111"
$env:DB_PORT = "5432"
$env:DB_NAME = "mots"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "password"
$env:USE_POSTGRES = "true"
$env:NODE_ENV = "development"
$env:TZ = "Asia/Shanghai"

# Start backend
Set-Location backend
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PWD'; npm run dev"

# Start frontend
Set-Location ..\app
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PWD'; npm run dev"

Set-Location ..
Write-Host "Services started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend: http://localhost:3001" -ForegroundColor White