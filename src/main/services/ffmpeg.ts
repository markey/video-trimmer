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
  wmImagePath?: string; // optional pre-rendered watermark image (PNG)
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
  // Add subtle shadow and soft box for elegance; this does not stretch text
  const style = `:shadowcolor=000000@0.6:shadowx=2:shadowy=2:box=1:boxcolor=000000@0.35:boxborderw=10`;
  return `drawtext=text='${escapeFfmpeg(wm.text)}'${fontParam}:fontsize=${fs}:fontcolor=${rgb}@${alpha}${style}:x=${x}:y=${y}`;
}

export function buildFfmpegArgs(opts: ExportOptions): string[] {
  const { input, output, startSec, endSec, project, fontFile, wmImagePath } = opts;
  const dur = Math.max(0, endSec - startSec);
  const args: string[] = [ '-hide_banner', '-y' ];

  // Inputs first
  args.push('-i', input);
  if (wmImagePath) {
    // Loop the PNG so it spans the entire duration; must appear before -i
    args.push('-stream_loop', '-1', '-i', wmImagePath);
  }

  // Then output trim window (applies to combined graph)
  args.push('-ss', startSec.toString(), '-t', dur.toString());

  if (wmImagePath) {
    // Overlay pre-rendered PNG watermark
    const wm = project.watermark;
    const x = (wm.anchor === 'topLeft' || wm.anchor === 'bottomLeft')
      ? `${wm.offsetX}`
      : `main_w-overlay_w-${wm.offsetX}`;
    const y = (wm.anchor === 'topLeft' || wm.anchor === 'topRight')
      ? `${wm.offsetY}`
      : `main_h-overlay_h-${wm.offsetY}`;
    const filter = `[1:v]format=rgba,setsar=1[wm];[0:v][wm]overlay=${x}:${y}:shortest=1[v]`;
    args.push('-filter_complex', filter, '-map', '[v]', '-map', '0:a?');
  } else {
    // Fallback: draw text directly
    const vf = buildDrawTextFilter(project, fontFile);
    args.push('-vf', vf);
  }

  if (project.export.useHardwareAccel) {
    // Simple NVIDIA first; production would detect availability
    args.push('-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', String(project.export.quality.value));
  } else {
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(project.export.quality.value));
  }
  args.push('-pix_fmt', 'yuv420p');
  args.push('-movflags', '+faststart');
  args.push('-shortest');
  args.push('-c:a', 'aac', '-b:a', '192k', output);
  return args;
}

export function exportWithProgress(opts: ExportOptions, onProgress: (ratio: number) => void): Promise<void> {
  const ffmpeg = getFfmpegPath();
  const args = buildFfmpegArgs(opts);
  console.log('ffmpeg args:', args.join(' '));
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
