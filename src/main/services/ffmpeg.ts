import { spawn } from 'node:child_process';
import { ProjectStore } from '@shared/types';
import { getFfmpegPath } from './paths';

export interface ExportOptions {
  input: string;
  output: string;
  startSec: number;
  endSec: number;
  project: ProjectStore;
  fontFile?: string; // optional explicit font path
}

export function buildDrawTextFilter(project: ProjectStore, fontFile?: string) {
  const wm = project.watermark;
  // ffmpeg uses fontcolor=RRGGBB@alpha
  const rgb = wm.color.replace('#', '');
  const alpha = wm.opacity;
  const fs = Math.max(1, wm.fontSizePx | 0);
  const x = wm.anchor === 'topLeft' || wm.anchor === 'bottomLeft' ? `${wm.offsetX}` : `w-tw-${wm.offsetX}`;
  const y = wm.anchor === 'topLeft' || wm.anchor === 'topRight' ? `${wm.offsetY}` : `h-th-${wm.offsetY}`;
  const fontParam = fontFile ? `:fontfile='${escapeFfmpeg(fontFile)}'` : '';
  return `drawtext=text='${escapeFfmpeg(wm.text)}'${fontParam}:fontsize=${fs}:fontcolor=${rgb}@${alpha}:x=${x}:y=${y}`;
}

export function buildFfmpegArgs(opts: ExportOptions): string[] {
  const { input, output, startSec, endSec, project, fontFile } = opts;
  const dur = Math.max(0, endSec - startSec);
  const vf = buildDrawTextFilter(project, fontFile);
  const args: string[] = [
    '-hide_banner',
    '-y',
    '-i', input,
    '-ss', startSec.toString(),
    '-t', dur.toString(),
    '-vf', vf,
  ];

  if (project.export.useHardwareAccel) {
    // Simple NVIDIA first; production would detect availability
    args.push('-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', String(project.export.quality.value));
  } else {
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(project.export.quality.value));
  }
  args.push('-c:a', 'aac', '-b:a', '192k', output);
  return args;
}

export function exportWithProgress(opts: ExportOptions, onProgress: (ratio: number) => void): Promise<void> {
  const ffmpeg = getFfmpegPath();
  const args = buildFfmpegArgs(opts);
  const targetDur = Math.max(0, opts.endSec - opts.startSec);
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let lastRatio = 0;
    child.stderr.on('data', (d) => {
      const text = d.toString();
      const m = /time=(\d+):(\d+):(\d+\.?\d*)/.exec(text);
      if (m && targetDur > 0) {
        const hh = parseInt(m[1]);
        const mm = parseInt(m[2]);
        const ss = parseFloat(m[3]);
        const sec = hh * 3600 + mm * 60 + ss;
        lastRatio = Math.max(lastRatio, Math.min(1, sec / targetDur));
        onProgress(lastRatio);
      }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed with code ${code}`));
    });
  });
}

function escapeFfmpeg(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

