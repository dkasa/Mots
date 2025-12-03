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

# Get current directory path
$currentDir = Get-Location

# Check and install backend dependencies
Set-Location backend
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}

# Start backend service
Write-Host "Starting backend service..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($projectPath)
    Set-Location "$projectPath\backend"
    npm run dev
} -ArgumentList $currentDir

# Start frontend service
Write-Host "Starting frontend service..." -ForegroundColor Yellow
Set-Location ..\app
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

$frontendJob = Start-Job -ScriptBlock {
    param($projectPath)
    Set-Location "$projectPath\app"
    $env:VITE_PORT = "3000"
    npm run dev
} -ArgumentList $currentDir

Set-Location ..

Write-Host ""
Write-Host "Services started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend: http://localhost:3001" -ForegroundColor White
Write-Host ""

# Wait a moment for services to start
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "To stop services manually, run:" -ForegroundColor Yellow
Write-Host "Stop-Job -Id $($backendJob.Id), $($frontendJob.Id); Remove-Job -Id $($backendJob.Id), $($frontendJob.Id) -Force" -ForegroundColor Gray
Write-Host ""
Write-Host "Or kill Node.js processes:" -ForegroundColor Yellow
Write-Host "taskkill /F /IM node.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to exit this script (services will continue running)" -ForegroundColor Cyan