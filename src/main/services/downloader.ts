import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { getYtDlpPath } from './paths';

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

export function startDownload(opts: DownloadOptions, onProgress: (p: DownloadProgress) => void): Promise<void> {
  const ytdlp = getYtDlpPath();
  const args = [
    '--no-playlist',
    '--newline', // line-based progress on stdout
    '--merge-output-format', 'mp4',
    '-o', opts.outputPath,
    opts.url,
  ];

  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(ytdlp, args, { windowsHide: true });

    child.stdout.on('data', (d) => {
      const line = d.toString();
      // Typical: [download]  12.3% of 50.00MiB at 2.50MiB/s ETA 00:30
      let m = /\[download\]\s+(\d{1,3}(?:\.\d+)?)%/.exec(line);
      if (m) {
        const pct = Math.min(100, parseFloat(m[1]));
        const speed = /at\s+([^\s]+\/s)/.exec(line)?.[1];
        const eta = /ETA\s+([^\s]+)/.exec(line)?.[1];
        onProgress({ phase: 'downloading', ratio: pct / 100, speed, eta });
        return;
      }
      if (/\[Merger\]/.test(line)) onProgress({ phase: 'merging' });
      if (/\[ExtractAudio\]|\[Fixup/.test(line)) onProgress({ phase: 'postprocessing' });
    });

    child.stderr.on('data', (d) => {
      // yt-dlp often prints additional info to stderr; we don't parse strictly here
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) { onProgress({ phase: 'completed' }); resolve(); }
      else reject(new Error(`yt-dlp failed with code ${code}`));
    });
  });
}

