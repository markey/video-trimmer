# Windows Build Script for Video Editor
# This script automates the build process on Windows

Write-Host "🚀 Starting Video Editor build process on Windows..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18 or later." -ForegroundColor Red
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version
    Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found. Please install npm." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install npm dependencies" -ForegroundColor Red
    exit 1
}

# Download external dependencies
Write-Host "📥 Downloading external dependencies..." -ForegroundColor Yellow
npm run download-deps

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to download external dependencies" -ForegroundColor Red
    exit 1
}

# Build the application
Write-Host "🔨 Building application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build application" -ForegroundColor Red
    exit 1
}

# Package the application
Write-Host "📦 Packaging application..." -ForegroundColor Yellow
npm run build:electron

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to package application" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Build completed successfully!" -ForegroundColor Green
Write-Host "📁 Check the 'dist' folder for your built application." -ForegroundColor Cyan

# List the output
Write-Host "`n📋 Build output:" -ForegroundColor Yellow
if (Test-Path "dist") {
    Get-ChildItem "dist" | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor White
    }
} else {
    Write-Host "  No dist folder found" -ForegroundColor Red
}
