export type Anchor = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export interface ProjectStore {
  sourcePath: string | null;
  video: {
    fps: number | null;
    durationSec: number | null;
    timebase: string | null;
    width?: number;
    height?: number;
    codec?: string;
  };
  trim: { startSec: number; endSec: number };
  watermark: {
    text: string;
    fontFamily: string;
    fontSizePx: number;
    color: string; // #RRGGBB
    opacity: number; // 0..1
    anchor: Anchor;
    offsetX: number;
    offsetY: number;
  };
  export: {
    container: 'mp4';
    vCodec: 'h264';
    aCodec: 'aac';
    useHardwareAccel: boolean;
    quality: { mode: 'crf'; value: number };
    outputPath?: string;
  };
}

export const defaultProject = (): ProjectStore => ({
  sourcePath: null,
  video: { fps: null, durationSec: null, timebase: null },
  trim: { startSec: 0, endSec: 0 },
  watermark: {
    text: '© Watermark',
    fontFamily: 'Inter',
    fontSizePx: 48,
    color: '#FFFFFF',
    opacity: 0.5,
    anchor: 'bottomRight',
    offsetX: 24,
    offsetY: 24,
  },
  export: {
    container: 'mp4',
    vCodec: 'h264',
    aCodec: 'aac',
    useHardwareAccel: false,
    quality: { mode: 'crf', value: 18 },
  },
});

