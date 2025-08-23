import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { getYtDlpPath } from './paths';

/**
 * Service for downloading videos using yt-dlp.
 * Handles video downloads from various platforms and provides real-time progress updates.
 */

export interface DownloadOptions {
  url: string;
  outputPath: string; // desired final file path (e.g., C:\\Videos\\clip.mp4)
}

export type DownloadProgress = {
  phase: 'downloading' | 'merging' | 'postprocessing' | 'completed';
  ratio?: number; // 0..1 when phase=downloading
  speed?: string;
  eta?: string;
};

/**
 * Starts a video download using yt-dlp with real-time progress monitoring.
 * @param opts - Download options including URL and output path
 * @param onProgress - Callback function to receive progress updates
 * @returns Promise that resolves when download is complete
 */
export function startDownload(opts: DownloadOptions, onProgress: (p: DownloadProgress) => void): Promise<void> {
  const ytdlp = getYtDlpPath();
  const args = [
    '--no-playlist', // Only download single video, not entire playlist
    '--newline', // Ensure line-based output for easier parsing
    '--merge-output-format', 'mp4', // Convert/merge to MP4 format
    '-o', opts.outputPath, // Output file path
    opts.url, // Video URL to download
  ];

  return new Promise((resolve, reject) => {
    // Spawn yt-dlp process with configured arguments
    const child: ChildProcessWithoutNullStreams = spawn(ytdlp, args, { windowsHide: true });

    // Monitor stdout for progress information and phase changes
    child.stdout.on('data', (d) => {
      const line = d.toString();

      // Parse download progress line: "[download]  12.3% of 50.00MiB at 2.50MiB/s ETA 00:30"
      let m = /\[download\]\s+(\d{1,3}(?:\.\d+)?)%/.exec(line);
      if (m) {
        const pct = Math.min(100, parseFloat(m[1])); // Extract percentage (0-100)
        const speed = /at\s+([^\s]+\/s)/.exec(line)?.[1]; // Extract download speed
        const eta = /ETA\s+([^\s]+)/.exec(line)?.[1]; // Extract estimated time remaining
        onProgress({ phase: 'downloading', ratio: pct / 100, speed, eta });
        return;
      }

      // Detect different phases of the download process
      if (/\[Merger\]/.test(line)) onProgress({ phase: 'merging' });
      if (/\[ExtractAudio\]|\[Fixup/.test(line)) onProgress({ phase: 'postprocessing' });
    });

    // Monitor stderr for additional yt-dlp output (not parsed for progress)
    child.stderr.on('data', (d) => {
      // yt-dlp often prints additional info to stderr; we don't parse strictly here
    });

    // Handle process errors (e.g., yt-dlp not found)
    child.on('error', reject);

    // Handle process completion
    child.on('close', (code) => {
      if (code === 0) {
        onProgress({ phase: 'completed' });
        resolve();
      } else {
        reject(new Error(`yt-dlp failed with code ${code}`));
      }
    });
  });
}

