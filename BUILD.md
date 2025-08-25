# Build Guide

## Prerequisites

- Node.js 20+ 
- npm
- Git

## Quick Start

1. Clone the repository
2. Install dependencies: `npm ci`
3. Download external dependencies: `npm run download-deps`
4. Build the application: `npm run build`
5. Start the application: `npm start`

## Development

- `npm run dev` - Start development mode with hot reload
- `npm run watch:main` - Watch and rebuild main process
- `npm run watch:preload` - Watch and rebuild preload script

## Building

- `npm run build` - Build the entire application
- `npm run build:main` - Build only the main process
- `npm run build:preload` - Build only the preload script
- `npm run build:renderer` - Build only the renderer
- `npm run build:electron` - Package the application for distribution

## Testing

- `npm run test-build` - Run full build test suite
- `npm run test-build:local` - Test build process locally
- `npm run typecheck` - Run TypeScript type checking

## External Dependencies

The application requires several external binaries that are downloaded automatically:

- **FFmpeg** - Video processing
- **FFprobe** - Media information
- **yt-dlp** - Video downloading

These are downloaded to the `bin/` directory when you run `npm run download-deps`.

## Troubleshooting

### GitHub Actions Build Failures

If you're experiencing build failures in GitHub Actions, here are common issues and solutions:

#### 1. Dependency Download Failures

**Symptoms**: Build fails during "Download external dependencies" step
**Solutions**:
- Check if the download URLs are still valid
- Verify network connectivity in the GitHub Actions runner
- Check if the external services (GitHub, evermeet.cx, johnvansickle.com) are accessible

#### 2. Platform-Specific Issues

**Windows**:
- Ensure PowerShell commands are working correctly
- Check if the `Expand-Archive` command is available
- Verify file paths use correct separators

**macOS**:
- Check if `unzip` is available (install with `brew install unzip` if needed)
- Verify tar extraction works correctly

**Linux**:
- Ensure `unzip`, `curl`, `tar`, and `xz-utils` are installed
- Check if the package manager commands work correctly

#### 3. Build Verification Failures

**Symptoms**: Build completes but verification steps fail
**Solutions**:
- Check if all required output files are generated
- Verify the build process completed successfully
- Check file permissions on the generated files

#### 4. Type Checking Failures

**Symptoms**: TypeScript compilation errors
**Solutions**:
- Run `npm run typecheck` locally to identify issues
- Check for missing type definitions
- Verify TypeScript configuration

### Local Testing

Before pushing changes that might affect the build:

1. **Clean build**: `npm run build`
2. **Test dependencies**: `npm run download-deps`
3. **Run type check**: `npm run typecheck`
4. **Test build locally**: `npm run test-build:local`

**For comprehensive local testing:**

- **Unix/macOS**: `npm run test-local:unix`
- **Windows**: `npm run test-local:windows`

These scripts will test the entire build process step by step and help identify any issues before they reach GitHub Actions.

### Common Commands for Debugging

```bash
# Check what's in the bin directory
ls -la bin/

# Verify downloaded files
file bin/ffmpeg
file bin/ffprobe
file bin/yt-dlp

# Check build output
ls -la out/
ls -la dist/

# Run specific build steps
npm run build:main
npm run build:preload
npm run build:renderer
```

### Environment Variables

- `CI=true` - Set automatically in GitHub Actions
- `NODE_ENV=production` - Set during production builds

## Architecture

The application is built using:

- **Main Process**: Electron main process (TypeScript + esbuild)
- **Preload Script**: Security bridge between main and renderer (TypeScript + esbuild)
- **Renderer**: React application (TypeScript + Vite)
- **Build Tools**: esbuild, Vite, TypeScript

## File Structure

```
src/
├── main/           # Main process code
├── renderer/       # React application
└── shared/         # Shared types and utilities

out/                # Built main process files
dist/               # Built renderer files
bin/                # External dependencies
```

## Build Output

After a successful build:

- `out/main.js` - Main process bundle
- `out/preload.cjs` - Preload script bundle
- `dist/renderer/` - React application bundle
- `dist/` - Packaged application (after `npm run build:electron`)
