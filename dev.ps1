# Launch both servers for local development.
#   FastAPI -> http://127.0.0.1:8000   (run from repo root for simulator.py paths)
#   Next.js -> http://localhost:3000
# Run from the repo root:  ./dev.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$env:PYTHONUTF8 = "1"  # simulator.py's emoji logs crash on Windows' cp1252 console

Write-Host "Starting FastAPI on :8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root'; `$env:PYTHONUTF8='1'; uvicorn backend.main:app --reload --port 8000"
)

Write-Host "Starting Next.js on :3000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root/web'; npm run dev"
)

Write-Host "`nOpen http://localhost:3000 once both windows finish booting." -ForegroundColor Cyan
