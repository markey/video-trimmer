import { spawn } from 'node:child_process';
import path from 'node:path';
import { getFfprobePath } from './paths';

/**
 * Service for video/audio file metadata extraction using ffprobe.
 * Provides detailed information about codecs, dimensions, duration, and other media properties.
 */

export interface ProbeResult {
  streams: any[]; // Array of media streams (video, audio, subtitles)
  format: any; // Container format information
}

/**
 * Probes a media file for metadata using ffprobe.
 * @param input - Path to the media file to analyze
 * @returns Promise resolving to structured probe data
 */
export function ffprobe(input: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const ffprobeBin = getFfprobePath();

    // Build ffprobe arguments for comprehensive metadata extraction
    const args = [
      '-hide_banner', // Don't show version banner
      '-print_format', 'json', // Output in JSON format for easy parsing
      '-show_streams', // Include stream information (video, audio, etc.)
      '-show_format', // Include container format information
      input, // Input file path
    ];

    // Spawn ffprobe process
    const child = spawn(ffprobeBin, args, { windowsHide: true });

    let out = ''; // Collect stdout (JSON output)
    let err = ''; // Collect stderr (error messages)

    // Capture stdout data (the JSON result)
    child.stdout.on('data', (d) => (out += d.toString()));

    // Capture stderr data (for error reporting)
    child.stderr.on('data', (d) => (err += d.toString()));

    // Handle process spawn errors
    child.on('error', reject);

    // Handle process completion
    child.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(out)); // Parse and return the JSON metadata
        } catch (e) {
          reject(e); // JSON parsing error
        }
      } else {
        reject(new Error(`ffprobe failed (${code}): ${err}`));
      }
    });
  });
}

/**
 * Extracts essential video metadata from ffprobe results.
 * Focuses on video stream properties needed for the video editor.
 * @param probe - Raw probe data from ffprobe
 * @returns Structured video metadata object
 */
export function extractVideoMeta(probe: ProbeResult) {
  // Find the first video stream in the media file
  const v = probe.streams.find((s) => s.codec_type === 'video');

  // Extract frame rate with fallback logic
  // avg_frame_rate is preferred, but fall back to r_frame_rate if needed
  const fps = v?.avg_frame_rate && v.avg_frame_rate !== '0/0'
    ? safeEvalFrac(v.avg_frame_rate) // Try average frame rate first
    : (v?.r_frame_rate && v.r_frame_rate !== '0/0' ? safeEvalFrac(v.r_frame_rate) : null); // Fallback to real frame rate

  // Extract duration from container format (more reliable than stream duration)
  const durationSec = probe.format?.duration ? parseFloat(probe.format.duration) : null;

  // Extract additional video properties
  const timebase = v?.time_base ?? null; // Timebase for frame timing calculations
  const width = v?.width; // Video width in pixels
  const height = v?.height; // Video height in pixels
  const codec = v?.codec_name; // Video codec name (e.g., 'h264', 'vp9')

  return { fps, durationSec, timebase, width, height, codec };
}

/**
 * Safely evaluates a fraction string (e.g., "30/1" or "29970/1000") to a decimal number.
 * Used for converting frame rate fractions from ffprobe to usable decimal values.
 * @param frac - Fraction string in format "numerator/denominator"
 * @returns Decimal result or null if invalid fraction
 */
function safeEvalFrac(frac: string): number | null {
  const [a, b] = frac.split('/').map(Number); // Split and convert to numbers
  if (!isFinite(a) || !isFinite(b) || b === 0) return null; // Validate inputs
  return a / b; // Perform division
}

