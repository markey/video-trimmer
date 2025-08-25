const { execSync } = require('child_process');
const { mkdirSync, existsSync, writeFileSync } = require('fs');
const { join, resolve } = require('path');
const { platform, arch } = require('os');

const dependencies = [
  {
    name: 'ffmpeg',
    windows: {
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
      filename: 'ffmpeg-master-latest-win64-gpl.zip',
      extractPath: 'ffmpeg-master-latest-win64-gpl/bin'
    },
    darwin: {
      url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
      filename: 'ffmpeg.zip'
    },
    linux: {
      url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
      filename: 'ffmpeg-release-amd64-static.tar.xz',
      extractPath: 'ffmpeg-*-amd64-static'
    }
  },
  {
    name: 'ffprobe',
    windows: {
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
      filename: 'ffmpeg-master-latest-win64-gpl.zip',
      extractPath: 'ffmpeg-master-latest-win64-gpl/bin'
    },
    darwin: {
      url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
      filename: 'ffmpeg.zip'
    },
    linux: {
      url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
      filename: 'ffmpeg-release-amd64-static.tar.xz',
      extractPath: 'ffmpeg-*-amd64-static'
    }
  },
  {
    name: 'yt-dlp',
    windows: {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
      filename: 'yt-dlp.exe'
    },
    darwin: {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
      filename: 'yt-dlp'
    },
    linux: {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
      filename: 'yt-dlp'
    }
  }
];

async function downloadFile(url, outputPath) {
  console.log(`Downloading ${url} to ${outputPath}...`);
  
  if (platform() === 'win32') {
    // Use PowerShell on Windows for better compatibility
    const psCommand = `Invoke-WebRequest -Uri "${url}" -OutFile "${outputPath}" -UseBasicParsing`;
    execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
  } else {
    // Use curl on Unix-like systems
    execSync(`curl -L -o "${outputPath}" "${url}"`, { stdio: 'inherit' });
  }
}

function extractArchive(archivePath, extractTo, extractPath) {
  console.log(`Extracting ${archivePath} to ${extractTo}...`);
  
  if (platform() === 'win32') {
    if (archivePath.endsWith('.zip')) {
      execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractTo}' -Force"`, { stdio: 'inherit' });
    }
  } else {
    if (archivePath.endsWith('.tar.xz')) {
      execSync(`tar -xf "${archivePath}" -C "${extractTo}"`, { stdio: 'inherit' });
    } else if (archivePath.endsWith('.zip')) {
      execSync(`unzip -o "${archivePath}" -d "${extractTo}"`, { stdio: 'inherit' });
    }
  }
  
  // If we need to move files from a subdirectory
  if (extractPath) {
    const extractDir = join(extractTo, extractPath);
    if (existsSync(extractDir)) {
      // Move all files from extractPath to the bin directory
      const files = execSync(`ls "${extractDir}"`, { encoding: 'utf8' }).trim().split('\n');
      for (const file of files) {
        const sourcePath = join(extractDir, file);
        const destPath = join(extractTo, file);
        execSync(`mv "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
      }
      // Remove the empty extractPath directory
      execSync(`rmdir "${extractDir}"`, { stdio: 'inherit' });
    }
  }
}

function makeExecutable(filePath) {
  if (platform() !== 'win32') {
    try {
      execSync(`chmod +x "${filePath}"`, { stdio: 'inherit' });
    } catch (error) {
      console.warn(`Warning: Could not make ${filePath} executable:`, error);
    }
  }
}

async function main() {
  const currentPlatform = platform();
  const currentArch = arch();
  
  console.log(`Platform: ${currentPlatform}, Architecture: ${currentArch}`);
  
  // Create bin directory
  const binDir = resolve('bin');
  mkdirSync(binDir, { recursive: true });
  
  // Create a .gitkeep file to ensure the bin directory is tracked
  writeFileSync(join(binDir, '.gitkeep'), '');
  
  // Track downloaded archives to avoid re-downloading
  const downloadedArchives = new Map();
  
  for (const dep of dependencies) {
    const platformKey = currentPlatform === 'win32' ? 'windows' : currentPlatform === 'darwin' ? 'darwin' : 'linux';
    const platformDep = dep[platformKey];
    
    if (!platformDep) {
      console.warn(`No ${platformKey} configuration for ${dep.name}`);
      continue;
    }
    
    const downloadPath = join(binDir, platformDep.filename);
    const finalPath = join(binDir, dep.name + (currentPlatform === 'win32' ? '.exe' : ''));
    
    try {
      // Check if we already downloaded this archive
      if (downloadedArchives.has(platformDep.url)) {
        console.log(`📦 Using already downloaded archive for ${dep.name}...`);
        const archivePath = downloadedArchives.get(platformDep.url);
        
        // Extract from the existing archive
        if (platformDep.filename.includes('.zip') || platformDep.filename.includes('.tar.xz')) {
          extractArchive(archivePath, binDir, platformDep.extractPath);
        }
      } else {
        // Download the dependency
        await downloadFile(platformDep.url, downloadPath);
        
        // Extract if it's an archive
        if (platformDep.filename.includes('.zip') || platformDep.filename.includes('.tar.xz')) {
          extractArchive(downloadPath, binDir, platformDep.extractPath);
          // Store the archive path for reuse
          downloadedArchives.set(platformDep.url, downloadPath);
        } else {
          // It's a direct binary, rename it
          execSync(`mv "${downloadPath}" "${finalPath}"`, { stdio: 'inherit' });
        }
      }
      
      // Make executable on Unix-like systems
      makeExecutable(finalPath);
      
      console.log(`✓ Successfully installed ${dep.name}`);
      
    } catch (error) {
      console.error(`✗ Failed to install ${dep.name}:`, error);
      process.exit(1);
    }
  }
  
  // Clean up downloaded archives
  for (const archivePath of downloadedArchives.values()) {
    try {
      execSync(`rm "${archivePath}"`, { stdio: 'inherit' });
    } catch (error) {
      console.warn(`Warning: Could not remove archive ${archivePath}:`, error);
    }
  }
  
  console.log('\n🎉 All dependencies downloaded successfully!');
  console.log(`📁 Dependencies are located in: ${binDir}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
