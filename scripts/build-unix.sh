#!/bin/bash

# Unix Build Script for Video Editor
# This script automates the build process on macOS and Linux

set -e  # Exit on any error

echo "🚀 Starting Video Editor build process on $(uname -s)..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18 or later."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm."
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm version: $NPM_VERSION"

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Download external dependencies
echo "📥 Downloading external dependencies..."
npm run download-deps

# Build the application
echo "🔨 Building application..."
npm run build

# Package the application
echo "📦 Packaging application..."
npm run build:electron

echo "🎉 Build completed successfully!"
echo "📁 Check the 'dist' folder for your built application."

# List the output
echo ""
echo "📋 Build output:"
if [ -d "dist" ]; then
    ls -la dist/
else
    echo "  No dist folder found"
fi
