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
  
  try {
    if (platform() === 'win32') {
      // Use PowerShell on Windows for better compatibility
      console.log('Using PowerShell Invoke-WebRequest for Windows');
      const psCommand = `Invoke-WebRequest -Uri "${url}" -OutFile "${outputPath}" -UseBasicParsing -TimeoutSec 300`;
      execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit', timeout: 300000 });
    } else {
      // Use curl on Unix-like systems
      console.log('Using curl for Unix-like systems');
      execSync(`curl -L -o "${outputPath}" "${url}" --connect-timeout 30 --max-time 300`, { stdio: 'inherit', timeout: 300000 });
    }
    
    // Verify download
    if (existsSync(outputPath)) {
      const stats = require('fs').statSync(outputPath);
      console.log(`Download completed: ${outputPath} (${stats.size} bytes)`);
      
      // Check if file is not empty
      if (stats.size === 0) {
        throw new Error(`Download failed - file is empty: ${outputPath}`);
      }
    } else {
      throw new Error(`Download failed - file not found: ${outputPath}`);
    }
  } catch (error) {
    console.error(`Download failed: ${error.message}`);
    // Clean up failed download
    if (existsSync(outputPath)) {
      try {
        require('fs').unlinkSync(outputPath);
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up failed download: ${cleanupError.message}`);
      }
    }
    throw error;
  }
}

function extractArchive(archivePath, extractTo, extractPath) {
  console.log(`Extracting ${archivePath} to ${extractTo}...`);
  console.log(`Extract path: ${extractPath}`);
  
  try {
    if (platform() === 'win32') {
      if (archivePath.endsWith('.zip')) {
        console.log('Using PowerShell Expand-Archive for Windows');
        execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractTo}' -Force"`, { stdio: 'inherit' });
      }
    } else {
      if (archivePath.endsWith('.tar.xz')) {
        console.log('Using tar for .tar.xz extraction');
        execSync(`tar -xf "${archivePath}" -C "${extractTo}"`, { stdio: 'inherit' });
      } else if (archivePath.endsWith('.zip')) {
        console.log('Using unzip for .zip extraction');
        execSync(`unzip -o "${archivePath}" -d "${extractTo}"`, { stdio: 'inherit' });
      }
    }
    
    console.log('Extraction completed. Contents of extractTo:');
    if (platform() === 'win32') {
      execSync(`dir "${extractTo}"`, { stdio: 'inherit' });
    } else {
      execSync(`ls -la "${extractTo}"`, { stdio: 'inherit' });
    }
    
    // If we need to move files from a subdirectory
    if (extractPath) {
      console.log(`Processing extractPath: ${extractPath}`);
      const extractDir = join(extractTo, extractPath);
      console.log(`Looking for extractDir: ${extractDir}`);
      
      if (existsSync(extractDir)) {
        console.log(`ExtractDir exists, moving files...`);
        // Move all files from extractPath to the bin directory
        // Use platform-agnostic commands
        if (platform() === 'win32') {
          // Windows: use dir and move commands
          console.log('Using Windows commands for file moving');
          const files = execSync(`dir "${extractDir}" /B`, { encoding: 'utf8' }).trim().split('\r\n').filter(f => f.trim());
          console.log(`Found files: ${JSON.stringify(files)}`);
          for (const file of files) {
            if (file && file !== '.' && file !== '..') {
              const sourcePath = join(extractDir, file);
              const destPath = join(extractTo, file);
              console.log(`Moving: ${sourcePath} -> ${destPath}`);
              execSync(`move "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
            }
          }
          // Remove the empty extractPath directory
          console.log(`Removing empty extractDir: ${extractDir}`);
          execSync(`rmdir "${extractDir}"`, { stdio: 'inherit' });
        } else {
          // Unix-like systems: use ls and mv commands
          console.log('Using Unix commands for file moving');
          const files = execSync(`ls -A "${extractDir}"`, { encoding: 'utf8' }).trim().split('\n').filter(f => f.trim());
          console.log(`Found files: ${JSON.stringify(files)}`);
          for (const file of files) {
            if (file && file !== '.' && file !== '..') {
              const sourcePath = join(extractDir, file);
              const destPath = join(extractTo, file);
              console.log(`Moving: ${sourcePath} -> ${destPath}`);
              execSync(`mv "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
            }
          }
          // Remove the empty extractPath directory
          console.log(`Removing empty extractDir: ${extractDir}`);
          execSync(`rmdir "${extractDir}"`, { stdio: 'inherit' });
        }
      } else {
        console.log(`ExtractDir does not exist: ${extractDir}`);
      }
    }
  } catch (error) {
    console.error(`Extraction failed: ${error.message}`);
    throw error;
  }
}

function makeExecutable(filePath) {
  if (platform() !== 'win32') {
    try {
      console.log(`Making executable: ${filePath}`);
      execSync(`chmod +x "${filePath}"`, { stdio: 'inherit' });
      console.log(`Successfully made executable: ${filePath}`);
    } catch (error) {
      console.warn(`Warning: Could not make ${filePath} executable:`, error);
    }
  } else {
    console.log(`Skipping chmod on Windows for: ${filePath}`);
  }
}

async function main() {
  try {
    const currentPlatform = platform();
    const currentArch = arch();
    
    console.log(`Platform: ${currentPlatform}, Architecture: ${currentArch}`);
    console.log(`Current working directory: ${process.cwd()}`);
    console.log(`Node version: ${process.version}`);
    
    // Create bin directory
    const binDir = resolve('bin');
    console.log(`Creating bin directory: ${binDir}`);
    mkdirSync(binDir, { recursive: true });
    
    // Create a .gitkeep file to ensure the bin directory is tracked
    writeFileSync(join(binDir, '.gitkeep'), '');
    
    // Track downloaded archives to avoid re-downloading
    const downloadedArchives = new Map();
  
    for (const dep of dependencies) {
      console.log(`\nProcessing dependency: ${dep.name}`);
      const platformKey = currentPlatform === 'win32' ? 'windows' : currentPlatform === 'darwin' ? 'darwin' : 'linux';
      const platformDep = dep[platformKey];
      
      if (!platformDep) {
        console.warn(`No ${platformKey} configuration for ${dep.name}`);
        continue;
      }
      
      console.log(`Platform config: ${JSON.stringify(platformDep)}`);
      const downloadPath = join(binDir, platformDep.filename);
      const finalPath = join(binDir, dep.name + (currentPlatform === 'win32' ? '.exe' : ''));
      
      console.log(`Download path: ${downloadPath}`);
      console.log(`Final path: ${finalPath}`);
      
      try {
        // Check if we already downloaded this archive
        if (downloadedArchives.has(platformDep.url)) {
          console.log(`📦 Using already downloaded archive for ${dep.name}...`);
          const archivePath = downloadedArchives.get(platformDep.url);
          
          // Extract from the existing archive
          if (platformDep.filename.includes('.zip') || platformDep.filename.includes('.tar.xz')) {
            console.log(`Extracting from existing archive: ${archivePath}`);
            extractArchive(archivePath, binDir, platformDep.extractPath);
          }
        } else {
          // Download the dependency
          console.log(`Downloading ${dep.name} from: ${platformDep.url}`);
          await downloadFile(platformDep.url, downloadPath);
          console.log(`Download completed: ${downloadPath}`);
          
          // Extract if it's an archive
          if (platformDep.filename.includes('.zip') || platformDep.filename.includes('.tar.xz')) {
            console.log(`Extracting archive: ${downloadPath}`);
            extractArchive(downloadPath, binDir, platformDep.extractPath);
            // Store the archive path for reuse
            downloadedArchives.set(platformDep.url, downloadPath);
          } else {
            // It's a direct binary, rename it
            console.log(`Moving binary to final location: ${finalPath}`);
            if (platform() === 'win32') {
              execSync(`move "${downloadPath}" "${finalPath}"`, { stdio: 'inherit' });
            } else {
              execSync(`mv "${downloadPath}" "${finalPath}"`, { stdio: 'inherit' });
            }
          }
        }
        
        // Make executable on Unix-like systems
        makeExecutable(finalPath);
        
        // Verify the file exists
        if (existsSync(finalPath)) {
          console.log(`✓ Successfully installed ${dep.name} at: ${finalPath}`);
          console.log(`File size: ${require('fs').statSync(finalPath).size} bytes`);
        } else {
          console.error(`❌ File not found after installation: ${finalPath}`);
          throw new Error(`Failed to install ${dep.name} - file not found`);
        }
        
      } catch (error) {
        console.error(`✗ Failed to install ${dep.name}:`, error);
        console.error(`Stack trace:`, error.stack);
        process.exit(1);
      }
    }
    
    // Clean up downloaded archives
    for (const archivePath of downloadedArchives.values()) {
      try {
        if (platform() === 'win32') {
          execSync(`del "${archivePath}"`, { stdio: 'inherit' });
        } else {
          execSync(`rm "${archivePath}"`, { stdio: 'inherit' });
        }
      } catch (error) {
        console.warn(`Warning: Could not remove archive ${archivePath}:`, error);
      }
    }
    
    console.log('\n🎉 All dependencies downloaded successfully!');
    console.log(`📁 Dependencies are located in: ${binDir}`);
    
    // List final contents
    console.log('\nFinal bin directory contents:');
    if (platform() === 'win32') {
      execSync(`dir "${binDir}"`, { stdio: 'inherit' });
    } else {
      execSync(`ls -la "${binDir}"`, { stdio: 'inherit' });
    }
  } catch (error) {
    console.error('❌ Error in main function:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}
  
main().catch((error) => {
  console.error('❌ Error in main execution:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
