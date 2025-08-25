import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { platform, arch } from 'node:os';

interface BuildConfig {
  platform: string;
  arch: string;
  electronVersion: string;
  appName: string;
  appVersion: string;
  description: string;
  author: string;
  homepage: string;
}

async function runCommand(command: string, cwd?: string): Promise<void> {
  console.log(`Running: ${command}`);
  execSync(command, { 
    stdio: 'inherit', 
    cwd,
    env: { ...process.env, FORCE_COLOR: '1' }
  });
}

function getBuildConfig(): BuildConfig {
  const packageJson = JSON.parse(require('fs').readFileSync('package.json', 'utf8'));
  
  return {
    platform: platform(),
    arch: arch(),
    electronVersion: packageJson.devDependencies.electron.replace('^', ''),
    appName: packageJson.name,
    appVersion: packageJson.version,
    description: packageJson.description,
    author: packageJson.author || 'Unknown',
    homepage: packageJson.homepage || ''
  };
}

async function downloadDependencies(): Promise<void> {
  console.log('📥 Downloading external dependencies...');
  
  if (!existsSync('bin/ffmpeg') && !existsSync('bin/ffmpeg.exe') ||
      !existsSync('bin/ffprobe') && !existsSync('bin/ffprobe.exe') ||
      !existsSync('bin/yt-dlp') && !existsSync('bin/yt-dlp.exe')) {
    console.log('Dependencies not found, downloading...');
    await runCommand('npx tsx scripts/download-deps.ts');
  } else {
    console.log('✓ Dependencies already exist');
  }
}

async function buildApplication(): Promise<void> {
  console.log('🔨 Building application...');
  
  // Clean previous builds
  if (existsSync('dist')) {
    rmSync('dist', { recursive: true, force: true });
  }
  if (existsSync('out')) {
    rmSync('out', { recursive: true, force: true });
  }
  
  // Build renderer
  console.log('Building renderer...');
  await runCommand('npm run build:renderer');
  
  // Build main process
  console.log('Building main process...');
  await runCommand('npm run build:main');
  await runCommand('npm run build:preload');
  
  console.log('✓ Application built successfully');
}

async function packageApplication(): Promise<void> {
  console.log('📦 Packaging application...');
  
  const config = getBuildConfig();
  const isWindows = config.platform === 'win32';
  const isMac = config.platform === 'darwin';
  const isLinux = config.platform === 'linux';
  
  // Create dist directory structure
  const distDir = resolve('dist');
  const appDir = join(distDir, `${config.appName}-${config.appVersion}-${config.platform}-${config.arch}`);
  mkdirSync(appDir, { recursive: true });
  
  // Copy application files
  console.log('Copying application files...');
  
  // Copy main process files
  copyFileSync('out/main.js', join(appDir, 'main.js'));
  copyFileSync('out/preload.cjs', join(appDir, 'preload.cjs'));
  
  // Copy renderer files
  const rendererDir = join(appDir, 'renderer');
  mkdirSync(rendererDir, { recursive: true });
  
  if (existsSync('dist/renderer')) {
    copyDirectory('dist/renderer', rendererDir);
  }
  
  // Copy dependencies
  console.log('Copying external dependencies...');
  const binDir = join(appDir, 'bin');
  mkdirSync(binDir, { recursive: true });
  
  if (existsSync('bin')) {
    copyDirectory('bin', binDir);
  }
  
  // Copy package.json
  copyFileSync('package.json', join(appDir, 'package.json'));
  
  // Create platform-specific launcher
  if (isWindows) {
    createWindowsLauncher(appDir, config);
  } else if (isMac) {
    createMacLauncher(appDir, config);
  } else if (isLinux) {
    createLinuxLauncher(appDir, config);
  }
  
  console.log(`✓ Application packaged to: ${appDir}`);
}

function copyDirectory(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function createWindowsLauncher(appDir: string, config: BuildConfig): void {
  const launcherContent = `@echo off
cd /d "%~dp0"
start "" "electron.exe" "%~dp0\\main.js"
`;
  
  const launcherPath = join(appDir, `${config.appName}.bat`);
  require('fs').writeFileSync(launcherPath, launcherContent);
  
  // Also create a PowerShell launcher
  const psLauncherContent = `Set-Location $PSScriptRoot
Start-Process -FilePath "electron.exe" -ArgumentList "$PSScriptRoot\\main.js"
`;
  
  const psLauncherPath = join(appDir, `${config.appName}.ps1`);
  require('fs').writeFileSync(psLauncherPath, psLauncherContent);
}

function createMacLauncher(appDir: string, config: BuildConfig): void {
  const launcherContent = `#!/bin/bash
cd "$(dirname "$0")"
./electron main.js
`;
  
  const launcherPath = join(appDir, config.appName);
  require('fs').writeFileSync(launcherPath, launcherContent);
  
  // Make executable
  execSync(`chmod +x "${launcherPath}"`, { stdio: 'inherit' });
}

function createLinuxLauncher(appDir: string, config: BuildConfig): void {
  const launcherContent = `#!/bin/bash
cd "$(dirname "$0")"
./electron main.js
`;
  
  const launcherPath = join(appDir, config.appName);
  require('fs').writeFileSync(launcherPath, launcherContent);
  
  // Make executable
  execSync(`chmod +x "${launcherPath}"`, { stdio: 'inherit' });
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting Electron build process...');
    
    const config = getBuildConfig();
    console.log(`Building for: ${config.platform}-${config.arch}`);
    console.log(`App: ${config.appName} v${config.appVersion}`);
    
    // Step 1: Download dependencies
    await downloadDependencies();
    
    // Step 2: Build application
    await buildApplication();
    
    // Step 3: Package application
    await packageApplication();
    
    console.log('\n🎉 Build completed successfully!');
    console.log(`📁 Output location: dist/${config.appName}-${config.appVersion}-${config.platform}-${config.arch}`);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

main();
