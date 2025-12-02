# PowerShell 停止开发环境脚本
Write-Host "🛑 停止 Mots 开发环境..." -ForegroundColor Yellow

# 查找并停止所有相关的 Node.js 进程
Write-Host "🔍 查找运行中的 Node.js 进程..." -ForegroundColor Cyan

$processes = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($processes) {
    foreach ($process in $processes) {
        try {
            $process.Kill()
            Write-Host "✅ 已停止进程 PID: $($process.Id)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ 无法停止进程 PID: $($process.Id)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "ℹ️ 没有找到运行中的 Node.js 进程" -ForegroundColor White
}

# 清理可能占用端口的进程
$ports = @(3001, 2402)
foreach ($port in $ports) {
    try {
        $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connection) {
            $processId = $connection.OwningProcess
            $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
            Write-Host "🔍 端口 $port 被进程 $processName (PID: $processId) 占用" -ForegroundColor Cyan
            
            if ($processName -eq "node") {
                Stop-Process -Id $processId -Force
                Write-Host "✅ 已释放端口 $port" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "ℹ️ 端口 $port 未被占用" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "✅ 开发环境已停止！" -ForegroundColor Green
Write-Host ""
Write-Host "💡 提示：如果某些进程仍在运行，请手动检查任务管理器" -ForegroundColor Gray