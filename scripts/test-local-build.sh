#!/bin/bash

echo "🧪 Testing local build process..."
echo "================================"

# Check prerequisites
echo "1. Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Are you in the right directory?"
    exit 1
fi

echo "✅ package.json found"

# Install dependencies
echo ""
echo "2. Installing dependencies..."
if ! npm ci; then
    echo "❌ npm ci failed, trying npm install..."
    if ! npm install; then
        echo "❌ npm install also failed"
        exit 1
    fi
fi
echo "✅ Dependencies installed"

# Download external dependencies
echo ""
echo "3. Downloading external dependencies..."
if ! npm run download-deps; then
    echo "❌ Failed to download external dependencies"
    exit 1
fi
echo "✅ External dependencies downloaded"

# Build step by step
echo ""
echo "4. Building application step by step..."

echo "   - Cleaning directories..."
npx rimraf dist out || echo "⚠️  rimraf failed, trying manual cleanup..."
rm -rf dist out

echo "   - Building renderer..."
if ! npm run build:renderer; then
    echo "❌ Renderer build failed"
    exit 1
fi

echo "   - Building main process..."
if ! npm run build:main; then
    echo "❌ Main process build failed"
    exit 1
fi

echo "   - Building preload..."
if ! npm run build:preload; then
    echo "❌ Preload build failed"
    exit 1
fi

echo "✅ All build steps completed"

# Verify output
echo ""
echo "5. Verifying build output..."
if [ ! -f "out/main.js" ]; then
    echo "❌ main.js not found"
    exit 1
fi
if [ ! -f "out/preload.cjs" ]; then
    echo "❌ preload.cjs not found"
    exit 1
fi
if [ ! -d "dist/renderer" ]; then
    echo "❌ renderer directory not found"
    exit 1
fi
echo "✅ Build output verified"

# Verify dependencies
echo ""
echo "6. Verifying external dependencies..."
if [ ! -f "bin/ffmpeg" ] && [ ! -f "bin/ffmpeg.exe" ]; then
    echo "❌ ffmpeg not found"
    exit 1
fi
if [ ! -f "bin/ffprobe" ] && [ ! -f "bin/ffprobe.exe" ]; then
    echo "❌ ffprobe not found"
    exit 1
fi
if [ ! -f "bin/yt-dlp" ] && [ ! -f "bin/yt-dlp.exe" ]; then
    echo "❌ yt-dlp not found"
    exit 1
fi
echo "✅ External dependencies verified"

# Type check
echo ""
echo "7. Running type check..."
if ! npm run typecheck; then
    echo "❌ Type check failed"
    exit 1
fi
echo "✅ Type check passed"

echo ""
echo "🎉 All tests passed! Build process is working correctly."
echo "You can now push to GitHub with confidence."
