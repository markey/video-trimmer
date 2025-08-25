import { execSync } from 'child_process';
import { mkdirSync, existsSync, writeFileSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { platform, arch } from 'os';

const dependencies = [
  {
    name: 'ffmpeg',
    windows: {
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
      filename: 'ffmpeg-master-latest-win64-gpl.zip',
      extractPath: 'ffmpeg-master-latest-win64-gpl/bin',
      binaries: ['ffmpeg.exe']
    },
    darwin: {
      url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
      filename: 'ffmpeg.zip',
      binaries: ['ffmpeg']
    },
    linux: {
      url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
      filename: 'ffmpeg-release-amd64-static.tar.xz',
      extractPath: 'ffmpeg-*-amd64-static',
      binaries: ['ffmpeg']
    }
  },
  {
    name: 'ffprobe',
    windows: {
      url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
      filename: 'ffmpeg-master-latest-win64-gpl.zip',
      extractPath: 'ffmpeg-master-latest-win64-gpl/bin',
      binaries: ['ffprobe.exe']
    },
    darwin: {
      // Evermeet provides separate archives for ffmpeg and ffprobe on macOS
      // Use the ffprobe-specific endpoint so the binary is present
      url: 'https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip',
      filename: 'ffprobe.zip',
      binaries: ['ffprobe']
    },
    linux: {
      url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
      filename: 'ffmpeg-release-amd64-static.tar.xz',
      extractPath: 'ffmpeg-*-amd64-static',
      binaries: ['ffprobe']
    }
  },
  {
    name: 'yt-dlp',
    windows: {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
      filename: 'yt-dlp.exe',
      binaries: ['yt-dlp.exe']
    },
    darwin: {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
      filename: 'yt-dlp',
      binaries: ['yt-dlp']
    },
    linux: {
      url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
      filename: 'yt-dlp',
      binaries: ['yt-dlp']
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
      const stats = statSync(outputPath);
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
        unlinkSync(outputPath);
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up failed download: ${cleanupError.message}`);
      }
    }
    throw error;
  }
}

function extractArchive(archivePath, extractTo, extractPath, binaries) {
  console.log(`Extracting ${archivePath} to ${extractTo}...`);
  console.log(`Extract path: ${extractPath}`);
  console.log(`Target binaries: ${JSON.stringify(binaries)}`);
  
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
      
      // Handle wildcard patterns by finding the actual directory
      let actualExtractDir = null;
      if (extractPath.includes('*')) {
        // Find the actual directory that matches the pattern
        const files = execSync(`ls -1 "${extractTo}"`, { encoding: 'utf8' }).trim().split('\n').filter(f => f.trim());
        console.log(`Available directories: ${JSON.stringify(files)}`);
        
        // Look for a directory that matches the pattern (replace * with any characters)
        const pattern = extractPath.replace(/\*/g, '.*');
        const regex = new RegExp(pattern);
        for (const file of files) {
          if (regex.test(file)) {
            actualExtractDir = join(extractTo, file);
            console.log(`Found matching directory: ${actualExtractDir}`);
            break;
          }
        }
      } else {
        actualExtractDir = join(extractTo, extractPath);
      }
      
      if (actualExtractDir && existsSync(actualExtractDir)) {
        console.log(`ExtractDir exists, looking for target binaries...`);
        
        // Look for the specific binaries we need
        if (binaries && binaries.length > 0) {
          for (const binary of binaries) {
            const binaryPath = join(actualExtractDir, binary);
            if (existsSync(binaryPath)) {
              console.log(`Found target binary: ${binary}`);
              const destPath = join(extractTo, binary);
              console.log(`Moving: ${binaryPath} -> ${destPath}`);
              if (platform() === 'win32') {
                execSync(`move "${binaryPath}" "${destPath}"`, { stdio: 'inherit' });
              } else {
                execSync(`mv "${binaryPath}" "${destPath}"`, { stdio: 'inherit' });
              }
            } else {
              console.log(`Target binary not found: ${binary}, checking directory contents...`);
              // List the contents of the extract directory to see what's actually there
              const dirContents = execSync(`ls -la "${actualExtractDir}"`, { encoding: 'utf8' }).trim().split('\n').filter(f => f.trim());
              console.log(`Directory contents: ${JSON.stringify(dirContents)}`);
              
              // Look for any executable files that might be our target
              for (const content of dirContents) {
                const parts = content.split(/\s+/);
                if (parts.length >= 9) {
                  const fileName = parts[8];
                  const permissions = parts[0];
                  if (permissions.includes('x') && !permissions.startsWith('d')) {
                    console.log(`Found executable: ${fileName}`);
                    if (binary === 'ffmpeg' && fileName.includes('ffmpeg')) {
                      console.log(`Found ffmpeg binary: ${fileName}`);
                      const sourcePath = join(actualExtractDir, fileName);
                      const destPath = join(extractTo, binary);
                      execSync(`mv "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
                      break;
                    } else if (binary === 'ffprobe' && fileName.includes('ffprobe')) {
                      console.log(`Found ffprobe binary: ${fileName}`);
                      const sourcePath = join(actualExtractDir, fileName);
                      const destPath = join(extractTo, binary);
                      execSync(`mv "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
                      break;
                    }
                  }
                }
              }
            }
          }
        } else {
          // Fallback: move all files if no specific binaries specified
          console.log('No specific binaries specified, moving all files...');
          if (platform() === 'win32') {
            const files = execSync(`dir "${actualExtractDir}" /B`, { encoding: 'utf8' }).trim().split('\r\n').filter(f => f.trim());
            for (const file of files) {
              if (file && file !== '.' && file !== '..') {
                const sourcePath = join(actualExtractDir, file);
                const destPath = join(extractTo, file);
                execSync(`move "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
              }
            }
          } else {
            const files = execSync(`ls -A "${actualExtractDir}"`, { encoding: 'utf8' }).trim().split('\n').filter(f => f.trim());
            for (const file of files) {
              if (file && file !== '.' && file !== '..') {
                const sourcePath = join(actualExtractDir, file);
                const destPath = join(extractTo, file);
                execSync(`mv "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
              }
            }
          }
        }
        
        // Remove the empty extractPath directory
        console.log(`Removing empty extractDir: ${actualExtractDir}`);
        try {
          if (platform() === 'win32') {
            execSync(`rmdir "${actualExtractDir}"`, { stdio: 'inherit' });
          } else {
            execSync(`rmdir "${actualExtractDir}"`, { stdio: 'inherit' });
          }
        } catch (error) {
          console.log(`Could not remove directory (might not be empty): ${error.message}`);
        }
      } else {
        console.log(`ExtractDir does not exist: ${actualExtractDir || extractPath}`);
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
            extractArchive(archivePath, binDir, platformDep.extractPath, platformDep.binaries);
          }
        } else {
          // Download the dependency
          console.log(`Downloading ${dep.name} from: ${platformDep.url}`);
          await downloadFile(platformDep.url, downloadPath);
          console.log(`Download completed: ${downloadPath}`);
          
          // Extract if it's an archive
          if (platformDep.filename.includes('.zip') || platformDep.filename.includes('.tar.xz')) {
            console.log(`Extracting archive: ${downloadPath}`);
            extractArchive(downloadPath, binDir, platformDep.extractPath, platformDep.binaries);
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
        if (platformDep.binaries && platformDep.binaries.length > 0) {
          // For archives, make each target binary executable
          for (const binary of platformDep.binaries) {
            const binaryPath = join(binDir, binary);
            if (existsSync(binaryPath)) {
              makeExecutable(binaryPath);
            }
          }
        } else {
          // For direct binaries, make the final path executable
          makeExecutable(finalPath);
        }
        
        // Verify the file exists
        let verificationPassed = false;
        if (platformDep.binaries && platformDep.binaries.length > 0) {
          // For archives, verify each target binary exists
          for (const binary of platformDep.binaries) {
            const binaryPath = join(binDir, binary);
            if (existsSync(binaryPath)) {
              console.log(`✓ Successfully installed ${binary} at: ${binaryPath}`);
              console.log(`File size: ${statSync(binaryPath).size} bytes`);
              verificationPassed = true;
            } else {
              console.error(`❌ Target binary not found: ${binaryPath}`);
            }
          }
        } else {
          // For direct binaries, verify the final path exists
          if (existsSync(finalPath)) {
            console.log(`✓ Successfully installed ${dep.name} at: ${finalPath}`);
            console.log(`File size: ${statSync(finalPath).size} bytes`);
            verificationPassed = true;
          } else {
            console.error(`❌ File not found after installation: ${finalPath}`);
          }
        }
        
        if (!verificationPassed) {
          throw new Error(`Failed to install ${dep.name} - verification failed`);
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
