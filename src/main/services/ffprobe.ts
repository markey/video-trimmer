import { spawn } from 'node:child_process';
import path from 'node:path';
import { getFfprobePath } from './paths';

export interface ProbeResult {
  streams: any[];
  format: any;
}

export function ffprobe(input: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const ffprobeBin = getFfprobePath();
    const args = [
      '-hide_banner',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      input,
    ];
    const child = spawn(ffprobeBin, args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(out));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`ffprobe failed (${code}): ${err}`));
      }
    });
  });
}

export function extractVideoMeta(probe: ProbeResult) {
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const fps = v?.avg_frame_rate && v.avg_frame_rate !== '0/0' ?
    safeEvalFrac(v.avg_frame_rate) :
    (v?.r_frame_rate && v.r_frame_rate !== '0/0' ? safeEvalFrac(v.r_frame_rate) : null);
  const durationSec = probe.format?.duration ? parseFloat(probe.format.duration) : null;
  const timebase = v?.time_base ?? null;
  const width = v?.width;
  const height = v?.height;
  const codec = v?.codec_name;
  return { fps, durationSec, timebase, width, height, codec };
}

function safeEvalFrac(frac: string): number | null {
  const [a, b] = frac.split('/').map(Number);
  if (!isFinite(a) || !isFinite(b) || b === 0) return null;
  return a / b;
}

