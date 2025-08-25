import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';

async function testBuild(): Promise<void> {
  console.log('🧪 Testing build process...\n');
  
  try {
    // Test 1: Download dependencies
    console.log('1️⃣ Testing dependency download...');
    execSync('npm run download-deps', { stdio: 'inherit' });
    
    const isWindows = platform() === 'win32';
    const ffmpegPath = isWindows ? 'bin/ffmpeg.exe' : 'bin/ffmpeg';
    const ffprobePath = isWindows ? 'bin/ffprobe.exe' : 'bin/ffprobe';
    const ytdlpPath = isWindows ? 'bin/yt-dlp.exe' : 'bin/yt-dlp';
    
    if (!existsSync(ffmpegPath)) {
      throw new Error(`FFmpeg not found after download at ${ffmpegPath}`);
    }
    if (!existsSync(ffprobePath)) {
      throw new Error(`FFprobe not found after download at ${ffprobePath}`);
    }
    if (!existsSync(ytdlpPath)) {
      throw new Error(`yt-dlp not found after download at ${ytdlpPath}`);
    }
    console.log('✅ Dependencies downloaded successfully\n');
    
    // Test 2: Build application
    console.log('2️⃣ Testing application build...');
    execSync('npm run build', { stdio: 'inherit' });
    
    if (!existsSync('out/main.js')) {
      throw new Error('main.js not found after build');
    }
    if (!existsSync('out/preload.cjs')) {
      throw new Error('preload.cjs not found after build');
    }
    if (!existsSync('dist/renderer')) {
      throw new Error('renderer not found after build');
    }
    console.log('✅ Application built successfully\n');
    
    // Test 3: Test packaging (skip on CI to avoid long build times)
    if (process.env.CI) {
      console.log('3️⃣ Skipping packaging test on CI (would take too long)\n');
    } else {
      console.log('3️⃣ Testing application packaging...');
      execSync('npx tsx scripts/build-electron.ts', { stdio: 'inherit' });
      
      // Check if packaged output exists
      const distContents = execSync('ls dist', { encoding: 'utf8' }).trim().split('\n');
      const hasPackagedApp = distContents.some(item => 
        item.includes('video-editor-') && 
        (item.includes('windows-') || item.includes('darwin-') || item.includes('linux-'))
      );
      
      if (!hasPackagedApp) {
        throw new Error('Packaged application not found');
      }
      console.log('✅ Application packaged successfully\n');
    }
    
    console.log('🎉 All tests passed! Build process is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testBuild();
