import path from 'node:path';
import fs from 'node:fs';

/**
 * Utility functions for locating external binary dependencies.
 * Searches multiple locations in order: bundled resources, local bin folder, then system PATH.
 */

/**
 * Locates the FFmpeg binary executable.
 * @returns Path to FFmpeg binary
 * @throws Will return 'ffmpeg' if not found (assumes it's in system PATH)
 */
export function getFfmpegPath(): string {
  // Search for FFmpeg binary in multiple locations in order of preference:
  // 1. Bundled binary in Electron app resources (for packaged apps)
  // 2. Local bin folder in project directory
  // 3. System PATH (fallback)
  const candidates = [
    // Windows executables
    path.resolve(process.resourcesPath ?? '.', 'ffmpeg.exe'), // Bundled in app
    path.resolve(process.cwd(), 'bin/ffmpeg.exe'), // Local project bin
    // Unix executables
    path.resolve(process.resourcesPath ?? '.', 'ffmpeg'), // Bundled in app
    path.resolve(process.cwd(), 'bin/ffmpeg'), // Local project bin
    'ffmpeg', // System PATH
  ];

  // Try each candidate path until we find an existing file
  for (const p of candidates) {
    if (p === 'ffmpeg') return p; // Trust system PATH for bare command
    if (fs.existsSync(p)) return p; // Found existing file
  }

  // Fallback to system PATH (may fail if not installed)
  return 'ffmpeg';
}

/**
 * Locates the ffprobe binary executable (part of FFmpeg suite).
 * Used for analyzing video file metadata without transcoding.
 * @returns Path to ffprobe binary
 */
export function getFfprobePath(): string {
  const candidates = [
    path.resolve(process.resourcesPath ?? '.', 'ffprobe.exe'), // Bundled Windows
    path.resolve(process.cwd(), 'bin/ffprobe.exe'), // Local project bin Windows
    path.resolve(process.resourcesPath ?? '.', 'ffprobe'), // Bundled Unix
    path.resolve(process.cwd(), 'bin/ffprobe'), // Local project bin Unix
    'ffprobe', // System PATH
  ];
  for (const p of candidates) {
    if (p === 'ffprobe') return p; // Trust system PATH
    if (fs.existsSync(p)) return p;
  }
  return 'ffprobe';
}

/**
 * Locates the yt-dlp binary executable for video downloading.
 * yt-dlp is a feature-rich command-line audio/video downloader.
 * @returns Path to yt-dlp binary
 */
export function getYtDlpPath(): string {
  const candidates = [
    // Windows common names/locations
    path.resolve(process.resourcesPath ?? '.', 'yt-dlp.exe'), // Bundled in app
    path.resolve(process.cwd(), 'bin/yt-dlp.exe'), // Local project bin
    'yt-dlp.exe', // System PATH Windows
    // Cross-platform
    path.resolve(process.resourcesPath ?? '.', 'yt-dlp'), // Bundled in app
    path.resolve(process.cwd(), 'bin/yt-dlp'), // Local project bin
    'yt-dlp', // System PATH Unix
  ];
  for (const p of candidates) {
    // Trust PATH for bare commands (may have different extensions on Windows)
    if (p === 'yt-dlp' || p === 'yt-dlp.exe') return p;
    if (fs.existsSync(p)) return p;
  }
  return 'yt-dlp';
}
