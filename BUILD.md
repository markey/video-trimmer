# Build Guide

This guide explains how to build the Video Editor application with external dependencies included.

## Prerequisites

- Node.js 18 or later
- npm or yarn
- Git

## External Dependencies

The application requires the following external binaries:
- **FFmpeg** - For video processing and watermarking
- **FFprobe** - For video metadata analysis (part of FFmpeg suite)
- **yt-dlp** - For video downloading from various platforms

These dependencies are automatically downloaded during the build process.

## Build Commands

### Development

```bash
# Start development server
npm run dev

# Build and watch main process
npm run dev:main

# Build and watch renderer
npm run dev:renderer
```

### Production Build

```bash
# Build the entire application
npm run build

# Build only the renderer
npm run build:renderer

# Build only the main process
npm run build:main

# Build only the preload script
npm run build:preload
```

### External Dependencies

```bash
# Download external dependencies manually
npm run download-deps

# Build with dependencies included
npm run build:electron
```

## Build Process

The build process consists of several steps:

1. **Download Dependencies**: External binaries (ffmpeg, yt-dlp) are downloaded for the current platform
2. **Build Renderer**: React application is built using Vite
3. **Build Main Process**: Electron main process is bundled using esbuild
4. **Build Preload**: Preload script is bundled using esbuild
5. **Package**: All files are packaged together with external dependencies

## Output Structure

After building, the application will be available in the `dist/` directory:

```
dist/
├── video-editor-{version}-{platform}-{arch}/
│   ├── main.js              # Main process
│   ├── preload.cjs          # Preload script
│   ├── renderer/            # Built React app
│   ├── bin/                 # External dependencies
│   │   ├── ffmpeg
│   │   ├── ffprobe
│   │   └── yt-dlp
│   ├── package.json         # App metadata
│   └── {app-name}           # Platform-specific launcher
```

## Platform-Specific Builds

### Windows
- Creates `.bat` and `.ps1` launcher scripts
- Dependencies are downloaded as `.exe` files
- Output is packaged as a ZIP archive

### macOS
- Creates a bash launcher script
- Dependencies are downloaded as Unix binaries
- Output is packaged as a `.tar.gz` archive

### Linux
- Creates a bash launcher script
- Dependencies are downloaded as Unix binaries
- Output is packaged as a `.tar.gz` archive

## GitHub Actions

The project includes automated build workflows:

### Build Test (`build-test.yml`)
- Runs on pull requests and pushes to main/master
- Tests builds on all platforms (Windows, macOS, Linux)
- Verifies external dependencies are downloaded correctly

### Release (`release.yml`)
- Triggers when a new version tag is pushed (e.g., `v1.0.0`)
- Builds for all platforms
- Creates a GitHub release with downloadable artifacts
- Automatically generates release notes

## Creating a Release

To create a new release:

1. Update the version in `package.json`
2. Commit and push your changes
3. Create and push a new tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. GitHub Actions will automatically build and create a release

## Troubleshooting

### Dependencies Not Found
If external dependencies fail to download:
```bash
# Clean and re-download
rm -rf bin/
npm run download-deps
```

### Build Failures
If the build fails:
1. Ensure Node.js version is 18 or later
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
4. Check that all required system tools are available (curl, unzip, tar)

### Platform-Specific Issues

#### Windows
- Ensure PowerShell execution policy allows running scripts
- Use Git Bash or WSL for Unix-like commands

#### macOS
- Ensure you have write permissions to the project directory
- Some commands may require administrator privileges

#### Linux
- Install required packages: `sudo apt-get install unzip curl`
- Ensure you have write permissions to the project directory

## Manual Dependency Installation

If automatic downloading fails, you can manually install dependencies:

1. Download the appropriate binaries for your platform
2. Place them in the `bin/` directory
3. Ensure they are executable (Unix-like systems)
4. Run the build process

## Custom Build Configuration

You can customize the build process by modifying:
- `scripts/download-deps.ts` - Dependency URLs and extraction logic
- `scripts/build-electron.ts` - Build and packaging logic
- `.github/workflows/` - CI/CD configuration
