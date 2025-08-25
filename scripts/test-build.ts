import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

async function testBuild(): Promise<void> {
  console.log('🧪 Testing build process...\n');
  
  try {
    // Test 1: Download dependencies
    console.log('1️⃣ Testing dependency download...');
    execSync('npm run download-deps', { stdio: 'inherit' });
    
    if (!existsSync('bin/ffmpeg') && !existsSync('bin/ffmpeg.exe')) {
      throw new Error('FFmpeg not found after download');
    }
    if (!existsSync('bin/ffprobe') && !existsSync('bin/ffprobe.exe')) {
      throw new Error('FFprobe not found after download');
    }
    if (!existsSync('bin/yt-dlp') && !existsSync('bin/yt-dlp.exe')) {
      throw new Error('yt-dlp not found after download');
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
    
    // Test 3: Test packaging
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
    
    console.log('🎉 All tests passed! Build process is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testBuild();
