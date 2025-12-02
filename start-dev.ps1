# PowerShell 开发环境启动脚本
Write-Host "🚀 启动 Mots 开发环境 (连接远程 PostgreSQL)..." -ForegroundColor Green

# 设置环境变量
$env:DB_TYPE = "postgresql"
$env:DB_HOST = "192.168.4.111"
$env:DB_PORT = "5432"
$env:DB_NAME = "mots_dev"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgres"
$env:NODE_ENV = "development"

Write-Host "📡 数据库配置:" -ForegroundColor Cyan
Write-Host "  主机: $env:DB_HOST" -ForegroundColor White
Write-Host "  端口: $env:DB_PORT" -ForegroundColor White
Write-Host "  数据库: $env:DB_NAME" -ForegroundColor White
Write-Host "  用户: $env:DB_USER" -ForegroundColor White
Write-Host ""

# 检查 Node.js 是否安装
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js 未安装或未在 PATH 中" -ForegroundColor Red
    exit 1
}

# 检查后端依赖
Write-Host "📦 检查后端依赖..." -ForegroundColor Yellow
Set-Location backend
if (-not (Test-Content "package.json")) {
    Write-Host "❌ 未找到 backend/package.json" -ForegroundColor Red
    Set-Location ..
    exit 1
}

if (-not (Test-Content "node_modules")) {
    Write-Host "📥 安装后端依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 后端依赖安装失败" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

# 测试数据库连接
Write-Host "🔍 测试远程数据库连接..." -ForegroundColor Cyan
npm run db:test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 数据库连接失败，请检查网络和数据库配置" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# 初始化数据库（如果需要）
Write-Host "🏗️ 初始化数据库..." -ForegroundColor Cyan
npm run db:init

# 添加种子数据
Write-Host "🌱 添加种子数据..." -ForegroundColor Cyan
npm run db:seed

# 启动后端服务
Write-Host "🚀 启动后端服务..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD/backend
    npm run dev
}

# 等待后端启动
Write-Host "⏳ 等待后端服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 检查后端健康状态
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ 后端服务启动成功" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 后端服务状态异常" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ 无法连接到后端服务，请检查日志" -ForegroundColor Yellow
}

# 启动前端服务
Write-Host "🚀 启动前端服务..." -ForegroundColor Yellow
Set-Location ../app
if (-not (Test-Content "package.json")) {
    Write-Host "❌ 未找到 app/package.json" -ForegroundColor Red
    Set-Location ..
    exit 1
}

if (-not (Test-Content "node_modules")) {
    Write-Host "📥 安装前端依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 前端依赖安装失败" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD/app
    npm run dev
}

Set-Location ..

# 等待前端启动
Write-Host "⏳ 等待前端服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# 显示服务信息
Write-Host ""
Write-Host "✅ 开发环境启动完成！" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 服务地址：" -ForegroundColor White
Write-Host "  前端: http://localhost:2402" -ForegroundColor White
Write-Host "  后端: http://localhost:3001" -ForegroundColor White
Write-Host "  健康检查: http://localhost:3001/health" -ForegroundColor White
Write-Host ""
Write-Host "📋 测试账号：" -ForegroundColor White
Write-Host "  用户名: demo,    密码: demo123" -ForegroundColor White
Write-Host "  用户名: testuser, 密码: test123" -ForegroundColor White
Write-Host "  用户名: admin,   密码: admin123" -ForegroundColor White
Write-Host ""
Write-Host "🔧 管理命令：" -ForegroundColor White
Write-Host "  查看后端日志: Receive-Job \$backendJob" -ForegroundColor Gray
Write-Host "  查看前端日志: Receive-Job \$frontendJob" -ForegroundColor Gray
Write-Host "  停止服务: Stop-Job \$backendJob, \$frontendJob; Remove-Job \$backendJob, \$frontendJob" -ForegroundColor Gray
Write-Host "  数据库状态: cd backend && npm run db:status" -ForegroundColor Gray
Write-Host ""

# 保持脚本运行，等待用户输入
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Yellow

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`n🛑 正在停止服务..." -ForegroundColor Yellow
    Stop-Job $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob
    Write-Host "✅ 所有服务已停止" -ForegroundColor Green
}