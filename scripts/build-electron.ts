import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, copyFileSync, readdirSync, statSync, lstatSync, readlinkSync, symlinkSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
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
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

  // Prefer tag name provided by CI (strip leading 'v'), fallback to package.json version
  const refName = process.env.GITHUB_REF_NAME || '';
  const ref = process.env.GITHUB_REF || '';
  let tag = '';
  if (refName) tag = refName;
  else if (ref.startsWith('refs/tags/')) tag = ref.substring('refs/tags/'.length);
  const normalizedTag = tag ? tag.replace(/^v/i, '') : '';

  return {
    platform: platform(),
    arch: arch(),
    electronVersion: packageJson.devDependencies.electron.replace('^', ''),
    appName: packageJson.name,
    appVersion: normalizedTag || packageJson.version,
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
    await runCommand('node scripts/download-deps.js');
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
  
  // Copy renderer files (for convenience when running main.js directly)
  const rendererDir = join(appDir, 'renderer');
  mkdirSync(rendererDir, { recursive: true });
  if (existsSync('dist/renderer')) copyDirectory('dist/renderer', rendererDir);

  // Bundle Electron runtime so the app can run standalone
  console.log('Copying Electron runtime...');
  const electronDist = resolve('node_modules', 'electron', 'dist');
  if (!existsSync(electronDist)) {
    throw new Error('Electron runtime not found. Ensure devDependency "electron" is installed.');
  }
  if (isWindows || isLinux) {
    // Copy entire dist contents so electron(.exe) sits next to main.js
    copyDirectory(electronDist, appDir);
  } else if (isMac) {
    // On macOS, copy Electron.app bundle
    const electronApp = join(electronDist, 'Electron.app');
    if (!existsSync(electronApp)) {
      throw new Error('Electron.app not found in electron/dist');
    }
    copyDirectory(electronApp, join(appDir, 'Electron.app'));
  }

  // Prepare resources/app so Electron can auto-start without args
  const resourcesDir = isMac ? join(appDir, 'Electron.app', 'Contents', 'Resources') : join(appDir, 'resources');
  const packagedAppDir = join(resourcesDir, 'app');
  mkdirSync(packagedAppDir, { recursive: true });

  // Copy compiled app code into resources/app
  copyFileSync('out/main.js', join(packagedAppDir, 'main.js'));
  copyFileSync('out/preload.cjs', join(packagedAppDir, 'preload.cjs'));
  if (existsSync('dist/renderer')) copyDirectory('dist/renderer', join(packagedAppDir, 'renderer'));

  // Place external binaries directly under resources/ for compact lookup from app code
  if (existsSync('bin')) {
    const binFiles = readdirSync('bin');
    for (const f of binFiles) {
      if (/^(ffmpeg|ffprobe|yt-dlp)(\.exe)?$/.test(f)) {
        copyFileSync(join('bin', f), join(resourcesDir, f));
      }
    }
  }

  // Minimal package.json for packaged app
  const minimalPkg = {
    name: 'video-trimmer',
    version: config.appVersion,
    type: 'module',
    main: 'main.js'
  };
  writeFileSync(join(packagedAppDir, 'package.json'), JSON.stringify(minimalPkg, null, 2));

  // Slim the Windows runtime by removing PDB debug symbols
  if (isWindows) {
    const removePdb = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) removePdb(p);
        else if (entry.isFile() && p.toLowerCase().endsWith('.pdb')) {
          try { unlinkSync(p); } catch {}
        }
      }
    };
    try { removePdb(appDir); } catch {}
  }

  // Create an obvious starter on Windows
  if (isWindows) {
    const electronExe = join(appDir, 'electron.exe');
    const brandedExe = join(appDir, 'Video Trimmer.exe');
    try {
      if (existsSync(electronExe)) {
        try { renameSync(electronExe, brandedExe); }
        catch {
          copyFileSync(electronExe, brandedExe);
          try { unlinkSync(electronExe); } catch {}
        }
      }
    } catch {}
    const startCmd = `@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0Video Trimmer.exe"\r\n`;
    writeFileSync(join(appDir, 'Start Video Trimmer.cmd'), startCmd);
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
    
    if (entry.isSymbolicLink()) {
      try {
        const linkTarget = readlinkSync(srcPath);
        // On POSIX, type can be omitted and inferred; on Windows, fall back to copy
        if (platform() === 'win32') {
          // Windows symlinks need elevation; fallback to deep copy of target
          const targetStat = statSync(srcPath);
          if (targetStat.isDirectory()) {
            // Best-effort: recursively copy the link contents
            copyDirectory(srcPath, destPath);
          } else {
            copyFileSync(srcPath, destPath);
          }
        } else {
          symlinkSync(linkTarget, destPath);
        }
      } catch (e) {
        // If symlink replication fails, attempt to copy as regular file/dir
        const st = statSync(srcPath);
        if (st.isDirectory()) copyDirectory(srcPath, destPath); else copyFileSync(srcPath, destPath);
      }
    } else if (entry.isDirectory()) {
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
  writeFileSync(launcherPath, launcherContent);
  
  // Also create a PowerShell launcher
  const psLauncherContent = `Set-Location $PSScriptRoot
Start-Process -FilePath "electron.exe" -ArgumentList "$PSScriptRoot\\main.js"
`;
  
  const psLauncherPath = join(appDir, `${config.appName}.ps1`);
  writeFileSync(psLauncherPath, psLauncherContent);
}

function createMacLauncher(appDir: string, config: BuildConfig): void {
  const launcherContent = `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Launch Electron from the bundled app
"./Electron.app/Contents/MacOS/Electron" main.js
`;
  
  const launcherPath = join(appDir, config.appName);
  writeFileSync(launcherPath, launcherContent);
  
  // Make executable
  execSync(`chmod +x "${launcherPath}"`, { stdio: 'inherit' });
}

function createLinuxLauncher(appDir: string, config: BuildConfig): void {
  const launcherContent = `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
"./electron" main.js
`;
  
  const launcherPath = join(appDir, config.appName);
  writeFileSync(launcherPath, launcherContent);
  
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
