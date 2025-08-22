import path from 'node:path';
import fs from 'node:fs';

export function getFfmpegPath(): string {
  // Look for bundled binary in resources, else fall back to PATH
  const candidates = [
    // Windows
    path.resolve(process.resourcesPath ?? '.', 'ffmpeg.exe'),
    path.resolve(process.cwd(), 'bin/ffmpeg.exe'),
    // Unix
    path.resolve(process.resourcesPath ?? '.', 'ffmpeg'),
    path.resolve(process.cwd(), 'bin/ffmpeg'),
    'ffmpeg',
  ];
  for (const p of candidates) {
    if (p === 'ffmpeg') return p; // trust PATH
    if (fs.existsSync(p)) return p;
  }
  return 'ffmpeg';
}

export function getFfprobePath(): string {
  const candidates = [
    path.resolve(process.resourcesPath ?? '.', 'ffprobe.exe'),
    path.resolve(process.cwd(), 'bin/ffprobe.exe'),
    path.resolve(process.resourcesPath ?? '.', 'ffprobe'),
    path.resolve(process.cwd(), 'bin/ffprobe'),
    'ffprobe',
  ];
  for (const p of candidates) {
    if (p === 'ffprobe') return p;
    if (fs.existsSync(p)) return p;
  }
  return 'ffprobe';
}

export function getYtDlpPath(): string {
  const candidates = [
    // Windows common names/locations
    path.resolve(process.resourcesPath ?? '.', 'yt-dlp.exe'),
    path.resolve(process.cwd(), 'bin/yt-dlp.exe'),
    'yt-dlp.exe',
    // Cross-platform
    path.resolve(process.resourcesPath ?? '.', 'yt-dlp'),
    path.resolve(process.cwd(), 'bin/yt-dlp'),
    'yt-dlp',
  ];
  for (const p of candidates) {
    if (p === 'yt-dlp' || p === 'yt-dlp.exe') return p; // trust PATH
    if (fs.existsSync(p)) return p;
  }
  return 'yt-dlp';
}
