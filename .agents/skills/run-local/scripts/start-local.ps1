param(
  [int]$Port = 5173,
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

# Resolve repository root dynamically relative to .agents/skills/run-local/scripts/
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
Set-Location $RepoRoot

Write-Host "==> [RunEvent Local] Project root: $RepoRoot" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed or not in PATH. Please install Node.js LTS (>=18) first."
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

Write-Host "==> [RunEvent Local] Starting Vite dev server (preferred port: $Port)..." -ForegroundColor Cyan
& npx vite --port $Port
