# ----------------------------
# One-click install Node.js + pnpm and project dependencies
# ----------------------------

# Set project path
$projectPath = "D:\ai_code\Mots\french-vocabulary-app"

# Check if Node.js is installed
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeInstalled) {
    Write-Host "Node.js not installed, downloading LTS version..."
    
    # Download Node.js LTS MSI
    $nodeInstaller = "$env:TEMP\node-lts.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.8.1/node-v20.8.1-x64.msi" -OutFile $nodeInstaller
    
    Write-Host "Installing Node.js silently..."
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart /log install_node.log" -Wait

    # Refresh PATH
    $env:Path += ";C:\Program Files\nodejs\"
}

# Check Node.js again
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Error "Node.js installation failed. Please check manually."
    exit
} else {
    Write-Host "Node.js installed: $(node -v)"
}

# Check if pnpm is installed
$pnpmInstalled = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmInstalled) {
    Write-Host "pnpm not installed, installing globally..."
    npm install -g pnpm
}

Write-Host "pnpm version: $(pnpm -v)"

# Enter project directory and install dependencies
if (Test-Path $projectPath) {
    Set-Location $projectPath
    Write-Host "Entering project directory: $projectPath"
    Write-Host "Installing dependencies..."
    pnpm install
} else {
    Write-Error "Project directory does not exist: $projectPath"
}
