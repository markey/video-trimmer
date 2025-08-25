# Test local build process for Windows

Write-Host "🧪 Testing local build process..." -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check prerequisites
Write-Host "1. Checking prerequisites..." -ForegroundColor Yellow
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    exit 1
}
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm not found" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js version: $(node --version)" -ForegroundColor Green
Write-Host "✅ npm version: $(npm --version)" -ForegroundColor Green

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ package.json not found. Are you in the right directory?" -ForegroundColor Red
    exit 1
}

Write-Host "✅ package.json found" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "2. Installing dependencies..." -ForegroundColor Yellow
try {
    npm ci
} catch {
    Write-Host "❌ npm ci failed, trying npm install..." -ForegroundColor Yellow
    try {
        npm install
    } catch {
        Write-Host "❌ npm install also failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Download external dependencies
Write-Host ""
Write-Host "3. Downloading external dependencies..." -ForegroundColor Yellow
try {
    npm run download-deps
} catch {
    Write-Host "❌ Failed to download external dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ External dependencies downloaded" -ForegroundColor Green

# Build step by step
Write-Host ""
Write-Host "4. Building application step by step..." -ForegroundColor Yellow

Write-Host "   - Cleaning directories..." -ForegroundColor Cyan
try {
    npx rimraf dist out
} catch {
    Write-Host "⚠️  rimraf failed, trying manual cleanup..." -ForegroundColor Yellow
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "out") { Remove-Item -Recurse -Force "out" }
}

Write-Host "   - Building renderer..." -ForegroundColor Cyan
try {
    npm run build:renderer
} catch {
    Write-Host "❌ Renderer build failed" -ForegroundColor Red
    exit 1
}

Write-Host "   - Building main process..." -ForegroundColor Cyan
try {
    npm run build:main
} catch {
    Write-Host "❌ Main process build failed" -ForegroundColor Red
    exit 1
}

Write-Host "   - Building preload..." -ForegroundColor Cyan
try {
    npm run build:preload
} catch {
    Write-Host "❌ Preload build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ All build steps completed" -ForegroundColor Green

# Verify output
Write-Host ""
Write-Host "5. Verifying build output..." -ForegroundColor Yellow
if (!(Test-Path "out/main.js")) {
    Write-Host "❌ main.js not found" -ForegroundColor Red
    exit 1
}
if (!(Test-Path "out/preload.cjs")) {
    Write-Host "❌ preload.cjs not found" -ForegroundColor Red
    exit 1
}
if (!(Test-Path "dist/renderer")) {
    Write-Host "❌ renderer directory not found" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build output verified" -ForegroundColor Green

# Verify dependencies
Write-Host ""
Write-Host "6. Verifying external dependencies..." -ForegroundColor Yellow
if (!(Test-Path "bin/ffmpeg.exe")) {
    Write-Host "❌ ffmpeg not found" -ForegroundColor Red
    exit 1
}
if (!(Test-Path "bin/ffprobe.exe")) {
    Write-Host "❌ ffprobe not found" -ForegroundColor Red
    exit 1
}
if (!(Test-Path "bin/yt-dlp.exe")) {
    Write-Host "❌ yt-dlp not found" -ForegroundColor Red
    exit 1
}
Write-Host "✅ External dependencies verified" -ForegroundColor Green

# Type check
Write-Host ""
Write-Host "7. Running type check..." -ForegroundColor Yellow
try {
    npm run typecheck
} catch {
    Write-Host "❌ Type check failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Type check passed" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 All tests passed! Build process is working correctly." -ForegroundColor Green
Write-Host "You can now push to GitHub with confidence." -ForegroundColor Green
