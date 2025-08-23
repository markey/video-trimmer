import { spawn } from 'node:child_process';
import { ProjectStore } from '@shared/types';
import { getFfmpegPath } from './paths';

/**
 * Service for video export and processing using FFmpeg.
 * Handles video trimming, watermarking, and format conversion with real-time progress.
 */

export interface ExportOptions {
  input: string; // Input video file path
  output: string; // Output video file path
  startSec: number; // Trim start time in seconds
  endSec: number; // Trim end time in seconds
  project: ProjectStore; // Project configuration including watermark and export settings
  fontFile?: string; // Optional explicit font path for text watermarking
  wmImagePath?: string; // Optional pre-rendered watermark image (PNG) instead of text
}

/**
 * Builds FFmpeg drawtext filter string for text watermarking.
 * Constructs positioning and styling parameters based on watermark configuration.
 * @param project - Project store containing watermark settings
 * @param fontFile - Optional path to font file
 * @returns FFmpeg filter string for text drawing
 */
export function buildDrawTextFilter(project: ProjectStore, fontFile?: string) {
  const wm = project.watermark;

  // Convert hex color to RGB format that FFmpeg expects (RRGGBB)
  const rgb = wm.color.replace('#', '');
  const alpha = wm.opacity; // Opacity value (0-1)

  // Ensure font size is positive
  const fs = Math.max(1, wm.fontSizePx | 0);

  // Calculate X position based on anchor point
  // For left anchors: use fixed offset from left edge
  // For right anchors: use width - text width - offset (right-aligned)
  const x = wm.anchor === 'topLeft' || wm.anchor === 'bottomLeft'
    ? `${wm.offsetX}` // Fixed position from left
    : `w-tw-${wm.offsetX}`; // Right-aligned with offset

  // Calculate Y position based on anchor point
  const y = wm.anchor === 'topLeft' || wm.anchor === 'topRight'
    ? `${wm.offsetY}` // Fixed position from top
    : `h-th-${wm.offsetY}`; // Bottom-aligned with offset

  // Include font file path if specified (for custom fonts)
  const fontParam = fontFile ? `:fontfile='${escapeFfmpeg(fontFile)}'` : '';

  // Add elegant text styling: subtle shadow and semi-transparent background box
  const style = `:shadowcolor=000000@0.6:shadowx=2:shadowy=2:box=1:boxcolor=000000@0.35:boxborderw=10`;

  // Construct the complete drawtext filter
  return `drawtext=text='${escapeFfmpeg(wm.text)}'${fontParam}:fontsize=${fs}:fontcolor=${rgb}@${alpha}${style}:x=${x}:y=${y}`;
}

/**
 * Builds complete FFmpeg command line arguments for video export.
 * Handles input files, trimming, watermarking (text or image), and output encoding.
 * @param opts - Export options including trim times, watermark settings, and output path
 * @returns Array of FFmpeg command line arguments
 */
export function buildFfmpegArgs(opts: ExportOptions): string[] {
  const { input, output, startSec, endSec, project, fontFile, wmImagePath } = opts;
  const dur = Math.max(0, endSec - startSec); // Ensure non-negative duration
  const args: string[] = [ '-hide_banner', '-y' ]; // Hide banner, overwrite output files

  // Input specification (must come before filters)
  args.push('-i', input); // Primary video input
  if (wmImagePath) {
    // For image watermark: loop PNG to span entire duration
    // Must be added before main input for proper filter graph indexing
    args.push('-stream_loop', '-1', '-i', wmImagePath);
  }

  // Output timing (trim window - applies to the entire filter graph)
  args.push('-ss', startSec.toString(), '-t', dur.toString());

  // Watermark application
  if (wmImagePath) {
    // Use image overlay watermark (more efficient for complex graphics)
    const wm = project.watermark;
    const x = (wm.anchor === 'topLeft' || wm.anchor === 'bottomLeft')
      ? `${wm.offsetX}` // Fixed position from left
      : `main_w-overlay_w-${wm.offsetX}`; // Right-aligned with offset
    const y = (wm.anchor === 'topLeft' || wm.anchor === 'topRight')
      ? `${wm.offsetY}` // Fixed position from top
      : `main_h-overlay_h-${wm.offsetY}`; // Bottom-aligned with offset

    // Complex filter graph: convert PNG to RGBA, then overlay on main video
    const filter = `[1:v]format=rgba,setsar=1[wm];[0:v][wm]overlay=${x}:${y}:shortest=1[v]`;
    args.push('-filter_complex', filter, '-map', '[v]', '-map', '0:a?');
  } else {
    // Use text drawing watermark (good for simple text)
    const vf = buildDrawTextFilter(project, fontFile);
    args.push('-vf', vf);
  }

  // Video encoding settings
  if (project.export.useHardwareAccel) {
    // Hardware-accelerated encoding using NVIDIA GPU (if available)
    args.push('-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', String(project.export.quality.value));
  } else {
    // Software encoding using libx264 (compatible with all systems)
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(project.export.quality.value));
  }

  // Output format and optimization settings
  args.push('-pix_fmt', 'yuv420p'); // Standard pixel format for compatibility
  args.push('-movflags', '+faststart'); // Enable fast streaming start
  args.push('-shortest'); // Finish when shortest input stream ends
  args.push('-c:a', 'aac', '-b:a', '192k', output); // AAC audio at 192kbps
  return args;
}

/**
 * Exports video with real-time progress monitoring.
 * Spawns FFmpeg process and parses stderr for progress information.
 * @param opts - Export configuration options
 * @param onProgress - Callback receiving progress ratio (0-1)
 * @returns Promise that resolves when export completes
 */
export function exportWithProgress(opts: ExportOptions, onProgress: (ratio: number) => void): Promise<void> {
  const ffmpeg = getFfmpegPath();
  const args = buildFfmpegArgs(opts);
  console.log('ffmpeg args:', args.join(' '));
  const targetDur = Math.max(0, opts.endSec - opts.startSec);
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let lastRatio = 0; // Track progress to avoid reporting backwards movement

    // Monitor FFmpeg stderr for progress information
    child.stderr.on('data', (d) => {
      const text = d.toString();
      // Parse time progress from FFmpeg output: "time=00:01:23.45"
      const m = /time=(\d+):(\d+):(\d+\.?\d*)/.exec(text);
      if (m && targetDur > 0) {
        const hh = parseInt(m[1]); // Hours
        const mm = parseInt(m[2]); // Minutes
        const ss = parseFloat(m[3]); // Seconds
        const sec = hh * 3600 + mm * 60 + ss; // Total seconds processed
        lastRatio = Math.max(lastRatio, Math.min(1, sec / targetDur)); // Progress ratio 0-1
        onProgress(lastRatio);
      }
    });

    // Handle process errors (e.g., FFmpeg not found)
    child.on('error', reject);

    // Handle process completion
    child.on('close', (code) => {
      if (code === 0) resolve(); // Success
      else reject(new Error(`ffmpeg failed with code ${code}`));
    });
  });
}

/**
 * Escapes special characters in text for safe use in FFmpeg filter strings.
 * Prevents injection issues and handles special characters properly.
 * @param text - Raw text to escape
 * @returns FFmpeg-safe escaped text
 */
function escapeFfmpeg(text: string) {
  return text.replace(/\\/g, '\\\\') // Escape backslashes
             .replace(/:/g, '\\:')  // Escape colons (special in filters)
             .replace(/'/g, "\\'"); // Escape single quotes
}
