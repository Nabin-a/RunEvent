param(
  [int]$Port = 5173,
  [int]$ApiPort = 3001,
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

# Resolve repository root dynamically relative to .agents/skills/run-local/scripts/
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
Set-Location $RepoRoot

Write-Host "==> [RunEvent Local] Project root: $RepoRoot" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed or not in PATH. Please install Node.js (>=22.5 with node:sqlite) first."
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is not available in PATH."
  exit 1
}

$nodeVer = & node -v
$npmVer = & npm -v
Write-Host "==> [RunEvent Local] Runtime detected: Node $nodeVer / npm $npmVer" -ForegroundColor Green

if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
  Write-Host "==> [RunEvent Local] node_modules not found. Running npm install..." -ForegroundColor Yellow
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
  }
}

if ($CheckOnly) {
  Write-Host "==> [RunEvent Local] Running typecheck and production build validation..." -ForegroundColor Cyan
  & npm run typecheck
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & npm run build
  exit $LASTEXITCODE
}

$env:API_PORT = "$ApiPort"
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:$ApiPort"
Write-Host "==> [RunEvent Local] Starting SQLite API (:$ApiPort) + Vite Web (:$Port)..." -ForegroundColor Cyan
& npx concurrently -k -n api,web "npx tsx server/index.ts" "npx vite --port $Port"
