import React, { useState } from 'react';
import type { ProjectStore } from '@shared/types';
import { defaultProject } from '@shared/types';

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<string | null>;
      readTextFile: (p: string) => Promise<string>;
      ffprobe: (src: string) => Promise<unknown>;
      fileUrl: (p: string) => string;
      saveFile: (defaultPath?: string) => Promise<string | null>;
      startExport: (args: any) => Promise<{ ok: true }>;
      onExportProgress: (cb: (ratio: number) => void) => () => void;
    };
  }
}

export const App: React.FC = () => {
  const [project, setProject] = useState<ProjectStore>(defaultProject());

  const openFile = async () => {
    const file = await window.electronAPI.openFile();
    if (!file) return;
    setProject((p) => ({ ...p, sourcePath: file }));
    try {
      const res = (await (window as any).electronAPI.ffprobe(file)) as { meta: any };
      setProject((p) => ({
        ...p,
        video: {
          fps: res.meta.fps ?? null,
          durationSec: res.meta.durationSec ?? null,
          timebase: res.meta.timebase ?? null,
          width: res.meta.width,
          height: res.meta.height,
          codec: res.meta.codec,
        },
        trim: {
          startSec: 0,
          endSec: res.meta.durationSec ?? 0,
        },
      }));
    } catch (e: any) {
      alert('ffprobe failed: ' + e.message);
    }
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#eaeaea', background: '#202124', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #333' }}>
        <button style={btnStyle} onClick={openFile}>Open File</button>
        <div style={{ opacity: 0.8 }}>
          {project.sourcePath ? `Source: ${project.sourcePath}` : 'No file loaded'}
        </div>
      </header>
      <main style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, padding: 12, flex: '1 1 auto', overflow: 'hidden' }}>
        <section style={{ display: 'grid', gridTemplateRows: 'minmax(240px, 1fr) 160px auto', gap: 12, minHeight: 0 }}>
          <PreviewPanel
            sourcePath={project.sourcePath}
            watermark={project.watermark}
            fps={project.video.fps ?? 30}
            trim={project.trim}
            onSetIn={(t) => setProject(p => ({ ...p, trim: { startSec: Math.min(t, p.trim.endSec), endSec: p.trim.endSec } }))}
            onSetOut={(t) => setProject(p => ({ ...p, trim: { startSec: p.trim.startSec, endSec: Math.max(t, p.trim.startSec) } }))}
          />
          <TimelinePanel start={project.trim.startSec} end={project.trim.endSec} duration={project.video.durationSec ?? 0} onChange={(start, end) => setProject(p => ({ ...p, trim: { startSec: start, endSec: end } }))} />
          <MetaPanel project={project} />
        </section>
        <aside style={{ overflow: 'auto' }}>
          <WatermarkPanel project={project} onChange={setProject} />
          <ExportPanel project={project} onChange={setProject} />
        </aside>
      </main>
    </div>
  );
};

const boxStyle: React.CSSProperties = { background: '#111', border: '1px solid #333', borderRadius: 8, padding: 12 };

type PreviewProps = {
  sourcePath: string | null;
  watermark: ProjectStore['watermark'];
  fps: number;
  trim: { startSec: number; endSec: number };
  onSetIn: (t: number) => void;
  onSetOut: (t: number) => void;
};

const PreviewPanel: React.FC<PreviewProps> = ({ sourcePath, watermark, fps, trim, onSetIn, onSetOut }) => {
  const src = sourcePath ? window.electronAPI.fileUrl(sourcePath) : null;
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [cur, setCur] = React.useState(0);
  const [dur, setDur] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [loopTrim, setLoopTrim] = React.useState(true);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [volume, setVolume] = React.useState(1);
  const [muted, setMuted] = React.useState(false);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const wasPlayingRef = React.useRef(false);

  const updateTime = () => {
    const v = videoRef.current; if (!v) return; setCur(v.currentTime);
  };

  const togglePlay = async () => {
    const v = videoRef.current; if (!v) return;
    try {
      if (v.paused) {
        await v.play();
      } else {
        v.pause();
      }
    } catch (e) {
      console.warn('Play failed, retrying muted', e);
      try {
        v.muted = true;
        await v.play();
      } catch (e2) {
        console.error('Play failed', e2);
      }
    }
  };

  const step = 1 / Math.max(1, Math.round(fps || 30));
  const seekBy = (delta: number) => {
    const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min((isFinite(v.duration) ? v.duration : Infinity), v.currentTime + delta));
  };

  const timeStr = (t: number) => {
    const s = Math.max(0, t);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = (s % 60).toFixed(3).padStart(6, '0');
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss}`;
  };

  // Apply playback rate and volume/mute
  React.useEffect(() => {
    const v = videoRef.current; if (!v) return;
    v.playbackRate = playbackRate;
  }, [playbackRate]);
  React.useEffect(() => {
    const v = videoRef.current; if (!v) return;
    v.volume = volume;
  }, [volume]);
  React.useEffect(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = muted;
  }, [muted]);

  // Loop within trim if enabled
  React.useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => {
      if (!loopTrim) return;
      if (v.currentTime > trim.endSec) {
        v.currentTime = trim.startSec;
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [loopTrim, trim.startSec, trim.endSec]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current; if (!v) return;
      if (e.target && (e.target as HTMLElement).tagName.match(/INPUT|SELECT|TEXTAREA/)) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); seekBy(e.shiftKey ? -1 : -step); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); seekBy(e.shiftKey ? 1 : step); }
      else if (e.key.toLowerCase() === 'j') { v.playbackRate = Math.max(0.25, v.playbackRate - 0.25); setPlaybackRate(v.playbackRate); }
      else if (e.key.toLowerCase() === 'l') { v.playbackRate = Math.min(4, v.playbackRate + 0.25); setPlaybackRate(v.playbackRate); }
      else if (e.key.toLowerCase() === 'k') { togglePlay(); }
      else if (e.key.toLowerCase() === 'i') { onSetIn(v.currentTime); }
      else if (e.key.toLowerCase() === 'o') { onSetOut(v.currentTime); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onSetIn, onSetOut]);

  // Seek bar background to show progress and buffered
  const playedPct = dur > 0 ? (cur / dur) * 100 : 0;
  const bufferedEnd = React.useMemo(() => {
    const v = videoRef.current; if (!v) return 0;
    try {
      const b = v.buffered; if (!b || b.length === 0) return 0;
      return b.end(b.length - 1);
    } catch { return 0; }
  }, [cur, dur, src]);
  const bufferedPct = dur > 0 ? Math.min(100, (bufferedEnd / dur) * 100) : 0;

  const seekBg = `linear-gradient(to right,
    #6ab0ff 0%,
    #6ab0ff ${playedPct}%,
    #3a3f45 ${playedPct}%,
    #3a3f45 ${bufferedPct}%,
    #24272b ${bufferedPct}%,
    #24272b 100%)`;

  return (
    <div style={{ ...boxStyle, position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {!sourcePath && <div style={{ opacity: 0.6, margin: 'auto' }}>Open a file to preview. mpv integration pending; using HTML5 fallback temporarily.</div>}
      {src && (
        <>
          <div style={{ position: 'relative', width: '100%', flex: '1 1 auto', minHeight: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 6, background: '#000' }}>
            {/* Temporary fallback. Replace with libmpv view later. */}
            <video
              ref={videoRef}
              src={src}
              controls={false}
              playsInline
              preload="auto"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center center', background: 'black' }}
              onTimeUpdate={updateTime}
              onSeeked={updateTime}
              onLoadedMetadata={() => { const v = videoRef.current; if (v) { setDur(v.duration || 0); setCur(v.currentTime || 0); } }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => {
                const v = videoRef.current as any;
                console.error('Video error', v?.error);
              }}
            />
            {/* Watermark preview matching export styling */}
            {watermark.text && (
              <div style={{
                position: 'absolute',
                color: watermark.color,
                opacity: watermark.opacity,
                fontFamily: watermark.fontFamily,
                fontSize: watermark.fontSizePx,
                textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.6)',
                background: 'rgba(0,0,0,0.35)',
                padding: '6px 10px',
                borderRadius: 8,
                pointerEvents: 'none',
                whiteSpace: 'pre',
                ...(watermark.anchor === 'topLeft' ? { top: watermark.offsetY, left: watermark.offsetX }
                  : watermark.anchor === 'topRight' ? { top: watermark.offsetY, right: watermark.offsetX }
                  : watermark.anchor === 'bottomLeft' ? { bottom: watermark.offsetY, left: watermark.offsetX }
                  : { bottom: watermark.offsetY, right: watermark.offsetX }),
              }}>
                {watermark.text}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gap: 8, paddingTop: 8 }}>
            {/* Seek bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                min={0}
                max={Math.max(0, dur) || 0}
                step={step}
                value={isFinite(cur) ? cur : 0}
                onMouseDown={(e) => { wasPlayingRef.current = playing; setIsScrubbing(true); const v = videoRef.current; if (v) v.pause(); }}
                onTouchStart={() => { wasPlayingRef.current = playing; setIsScrubbing(true); const v = videoRef.current; if (v) v.pause(); }}
                onInput={(e) => { const t = parseFloat((e.target as HTMLInputElement).value); const v = videoRef.current; if (v) { v.currentTime = t; setCur(t); } }}
                onChange={(e) => { const t = parseFloat((e.target as HTMLInputElement).value); const v = videoRef.current; if (v) { v.currentTime = t; setCur(t); } setIsScrubbing(false); if (wasPlayingRef.current) togglePlay(); }}
                style={{ width: '100%', height: 6, borderRadius: 4, background: seekBg, outline: 'none', cursor: 'pointer' }}
              />
              <div style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.9 }}>{timeStr(cur)} / {timeStr(dur)}</div>
            </div>

            {/* Transport controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={btnStyle} onClick={() => seekBy(-1)} title="Back 1s">-1s</button>
              <button style={btnStyle} onClick={() => seekBy(-step)} title="Prev frame">⟨</button>
              <button style={{ ...btnStyle, padding: '6px 14px', fontWeight: 600 }} onClick={togglePlay}>{playing ? 'Pause ⏸' : 'Play ▶'}</button>
              <button style={btnStyle} onClick={() => seekBy(step)} title="Next frame">⟩</button>
              <button style={btnStyle} onClick={() => seekBy(1)} title="Forward 1s">+1s</button>

              <div style={{ width: 1, height: 20, background: '#333', margin: '0 6px' }} />

              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Rate
                <select value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} style={selectStyle}>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map(r => (
                    <option key={r} value={r}>{r}×</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                Vol
                <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); if (muted) setMuted(false); }} style={{ width: 100 }} />
              </label>
              <button style={btnStyle} onClick={() => setMuted(m => !m)} title={muted ? 'Unmute' : 'Mute'}>{muted ? 'Unmute' : 'Mute'}</button>

              <div style={{ width: 1, height: 20, background: '#333', margin: '0 6px' }} />

              <button style={btnStyle} onClick={() => onSetIn(cur)} title="Set In at current">Set In</button>
              <button style={btnStyle} onClick={() => onSetOut(cur)} title="Set Out at current">Set Out</button>
              <span style={{ opacity: 0.8, fontSize: 12 }}>In: {timeStr(trim.startSec)} | Out: {timeStr(trim.endSec)}</span>
              <button style={btnStyle} onClick={() => { const v = videoRef.current; if (v) v.currentTime = trim.startSec; }} title="Jump to In">⇤ In</button>
              <button style={btnStyle} onClick={() => { const v = videoRef.current; if (v) v.currentTime = trim.endSec; }} title="Jump to Out">Out ⇥</button>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <input type="checkbox" checked={loopTrim} onChange={(e) => setLoopTrim(e.target.checked)} />
                Loop selection
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Shared control styles
const btnStyle: React.CSSProperties = {
  background: '#2b3036',
  color: '#eaeaea',
  border: '1px solid #3a3f45',
  padding: '6px 10px',
  borderRadius: 6,
  cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  background: '#2b3036',
  color: '#eaeaea',
  border: '1px solid #3a3f45',
  borderRadius: 6,
  padding: '4px 8px',
};

const inputStyle: React.CSSProperties = {
  background: '#2b3036',
  color: '#eaeaea',
  border: '1px solid #3a3f45',
  borderRadius: 6,
  padding: '6px 8px',
  width: '100%',
};

const rangeStyle: React.CSSProperties = {
  width: '100%',
};

const fieldRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 10,
};

const labelStyle: React.CSSProperties = { width: 80, opacity: 0.9 };

const valueBadge: React.CSSProperties = {
  background: '#2b3036',
  border: '1px solid #3a3f45',
  borderRadius: 6,
  padding: '2px 6px',
  fontSize: 12,
  opacity: 0.9,
};

const sectionTitle: React.CSSProperties = { marginBottom: 8, fontWeight: 600 };

const TimelinePanel: React.FC<{ start: number; end: number; duration: number; onChange: (s: number, e: number) => void }> = ({ start, end, duration, onChange }) => {
  const [localStart, setLocalStart] = useState(start);
  const [localEnd, setLocalEnd] = useState(end);

  React.useEffect(() => { setLocalStart(start); }, [start]);
  React.useEffect(() => { setLocalEnd(end); }, [end]);

  const clamp = (v: number) => Math.max(0, Math.min(isFinite(duration) && duration > 0 ? duration : Number.MAX_SAFE_INTEGER, v));
  const onStartChange = (v: number) => {
    const s = clamp(Math.min(v, localEnd));
    setLocalStart(s);
    onChange(s, localEnd);
  };
  const onEndChange = (v: number) => {
    const e = clamp(Math.max(v, localStart));
    setLocalEnd(e);
    onChange(localStart, e);
  };

  const pct = (t: number) => duration > 0 ? (t / duration) * 100 : 0;
  const bg = `linear-gradient(to right,
    #24272b 0%,
    #24272b ${pct(localStart)}%,
    #6ab0ff ${pct(localStart)}%,
    #6ab0ff ${pct(localEnd)}%,
    #24272b ${pct(localEnd)}%,
    #24272b 100%)`;

  return (
    <div style={boxStyle}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Timeline</div>
      <div style={{ position: 'relative', height: 28, display: 'grid', alignItems: 'center' }}>
        {/* Overlapped dual-range to emulate a range slider */}
        <input type="range" min={0} max={Math.max(0, duration) || 0} step={0.001} value={localStart}
          onChange={(e) => onStartChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: 6, borderRadius: 4, background: bg }} />
        <input type="range" min={0} max={Math.max(0, duration) || 0} step={0.001} value={localEnd}
          onChange={(e) => onEndChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: 6, borderRadius: 4, background: 'transparent' }} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
        <label>
          Start (s)
          <input type="number" step="0.001" value={localStart} onChange={(e) => onStartChange(parseFloat(e.target.value))} />
        </label>
        <label>
          End (s)
          <input type="number" step="0.001" value={localEnd} onChange={(e) => onEndChange(parseFloat(e.target.value))} />
        </label>
        <div style={{ marginLeft: 'auto', opacity: 0.8, fontSize: 12 }}>Duration: {duration ? duration.toFixed(3) : '—'} s</div>
      </div>
    </div>
  );
};

const MetaPanel: React.FC<{ project: ProjectStore }> = ({ project }) => {
  return (
    <div style={boxStyle}>
      <div>Metadata</div>
      <div style={{ opacity: 0.8, fontSize: 12 }}>
        <div>FPS: {project.video.fps ?? '—'}</div>
        <div>Duration: {project.video.durationSec ?? '—'} s</div>
        <div>Timebase: {project.video.timebase ?? '—'}</div>
        <div>Resolution: {project.video.width}×{project.video.height}</div>
      </div>
    </div>
  );
};

const WatermarkPanel: React.FC<{ project: ProjectStore; onChange: (p: ProjectStore) => void }> = ({ project, onChange }) => {
  const wm = project.watermark;
  const set = (patch: Partial<ProjectStore['watermark']>) => onChange({ ...project, watermark: { ...wm, ...patch } });
  return (
    <div style={{ ...boxStyle, marginBottom: 12 }}>
      <div style={sectionTitle}>Watermark</div>

      <div style={fieldRow}>
        <label style={labelStyle}>Text</label>
        <input style={inputStyle} type="text" value={wm.text} onChange={(e) => set({ text: e.target.value })} placeholder="Watermark text" />
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>Size</label>
        <input style={{ ...rangeStyle, flex: 1 }} type="range" min={12} max={160} step={1} value={wm.fontSizePx} onChange={(e) => set({ fontSizePx: parseInt(e.target.value) })} />
        <div style={valueBadge}>{wm.fontSizePx}px</div>
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>Color</label>
        <input style={{ ...inputStyle, padding: 2, width: 48 }} type="color" value={wm.color} onChange={(e) => set({ color: e.target.value })} />
        <div style={{ width: 12 }} />
        <label style={labelStyle}>Opacity</label>
        <input style={{ ...rangeStyle, flex: 1 }} type="range" min={0} max={1} step={0.01} value={wm.opacity} onChange={(e) => set({ opacity: parseFloat(e.target.value) })} />
        <div style={valueBadge}>{wm.opacity.toFixed(2)}</div>
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>Position</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, flex: 1 }}>
          {([
            ['topLeft', '↖'],
            ['topRight', '↗'],
            ['bottomLeft', '↙'],
            ['bottomRight', '↘'],
          ] as const).map(([val, icon]) => (
            <button key={val} style={{ ...btnStyle, padding: '6px 8px', background: wm.anchor === val ? '#3a3f45' : '#2b3036' }} onClick={() => set({ anchor: val as any })}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>Offset X</label>
        <input style={{ ...rangeStyle, flex: 1 }} type="range" min={0} max={200} step={1} value={wm.offsetX} onChange={(e) => set({ offsetX: parseInt(e.target.value) })} />
        <div style={valueBadge}>{wm.offsetX}px</div>
      </div>
      <div style={fieldRow}>
        <label style={labelStyle}>Offset Y</label>
        <input style={{ ...rangeStyle, flex: 1 }} type="range" min={0} max={200} step={1} value={wm.offsetY} onChange={(e) => set({ offsetY: parseInt(e.target.value) })} />
        <div style={valueBadge}>{wm.offsetY}px</div>
      </div>
    </div>
  );
};

const ExportPanel: React.FC<{ project: ProjectStore; onChange: (p: ProjectStore) => void }> = ({ project, onChange }) => {
  const exp = project.export;
  const set = (patch: Partial<ProjectStore['export']>) => onChange({ ...project, export: { ...exp, ...patch } });
  const [progress, setProgress] = useState<number | null>(null);
  React.useEffect(() => {
    const off = window.electronAPI.onExportProgress((r) => setProgress(r));
    return () => { off?.(); };
  }, []);

  const chooseOutput = async () => {
    const path = await window.electronAPI.saveFile(exp.outputPath);
    if (path) set({ outputPath: path });
  };

  const onExport = async () => {
    if (!project.sourcePath) return alert('No source file');
    let out = exp.outputPath;
    if (!out) {
      out = await window.electronAPI.saveFile();
      if (!out) return;
      set({ outputPath: out });
    }
    // Pre-render watermark as PNG so export matches preview exactly
    const wm = project.watermark;
    let wmImageDataUrl: string | undefined;
    if (wm.text && wm.text.trim()) {
      try {
        const padX = 10; const padY = 6; const radius = 8;
        // Create measuring canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        // Build a robust font string: quote multi-word families so Canvas parses correctly
        const families = wm.fontFamily.split(',').map(s => s.trim()).filter(Boolean).map(f => /\s/.test(f) ? `'${f}'` : f).join(', ');
        ctx.font = `${wm.fontSizePx}px ${families}`;
        const metrics = ctx.measureText(wm.text);
        const textW = Math.ceil(metrics.width);
        const ascent = metrics.actualBoundingBoxAscent || wm.fontSizePx * 0.8;
        const descent = metrics.actualBoundingBoxDescent || wm.fontSizePx * 0.2;
        const textH = Math.ceil(ascent + descent);
        const width = textW + padX * 2;
        const height = textH + padY * 2;
        canvas.width = width;
        canvas.height = height;

        // Draw background pill
        const bgAlpha = 0.35 * wm.opacity;
        const r = radius;
        const bg = canvas.getContext('2d')!;
        bg.fillStyle = `rgba(0,0,0,${bgAlpha.toFixed(3)})`;
        bg.beginPath();
        bg.moveTo(r, 0);
        bg.lineTo(width - r, 0);
        bg.quadraticCurveTo(width, 0, width, r);
        bg.lineTo(width, height - r);
        bg.quadraticCurveTo(width, height, width - r, height);
        bg.lineTo(r, height);
        bg.quadraticCurveTo(0, height, 0, height - r);
        bg.lineTo(0, r);
        bg.quadraticCurveTo(0, 0, r, 0);
        bg.closePath();
        bg.fill();

        // Draw text with subtle shadow
        const toRgb = (hex: string) => {
          const h = hex.replace('#', '');
          const r = parseInt(h.slice(0, 2), 16);
          const g = parseInt(h.slice(2, 4), 16);
          const b = parseInt(h.slice(4, 6), 16);
          return { r, g, b };
        };
        const { r: rr, g: gg, b: bb } = toRgb(wm.color || '#FFFFFF');
        ctx.font = `${wm.fontSizePx}px ${families}`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${wm.opacity.toFixed(3)})`;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.fillText(wm.text, padX, padY + ascent);

        wmImageDataUrl = canvas.toDataURL('image/png');
      } catch (e) {
        console.warn('Watermark prerender failed, falling back to drawtext', e);
      }
    }
    const args = {
      input: project.sourcePath,
      output: out,
      startSec: project.trim.startSec,
      endSec: project.trim.endSec,
      project,
      wmImageDataUrl,
    };
    setProgress(0);
    try {
      await window.electronAPI.startExport(args);
      setProgress(1);
      alert('Export completed');
    } catch (e: any) {
      console.error(e);
      alert('Export failed: ' + e.message);
      setProgress(null);
    }
  };
  return (
    <div style={boxStyle}>
      <div style={sectionTitle}>Export</div>

      <div style={fieldRow}>
        <label style={labelStyle}>Use GPU</label>
        <input type="checkbox" checked={exp.useHardwareAccel} onChange={(e) => set({ useHardwareAccel: e.target.checked })} />
      </div>

      <div style={fieldRow}>
        <label style={labelStyle}>CRF</label>
        <input style={{ ...rangeStyle, flex: 1 }} type="range" min={0} max={51} step={1} value={exp.quality.value} onChange={(e) => set({ quality: { mode: 'crf', value: parseInt(e.target.value) } })} />
        <div style={valueBadge}>{exp.quality.value}</div>
      </div>
      <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
        Lower = better quality, 18–23 recommended for H.264.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={btnStyle} onClick={chooseOutput}>Choose Output…</button>
        <span style={{ opacity: 0.8, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.outputPath ?? '(not set)'}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <button style={btnStyle} disabled={!project.sourcePath || progress !== null} onClick={onExport}>Export</button>
        {progress !== null && (
          <span style={{ marginLeft: 8 }}>Progress: {(progress * 100).toFixed(0)}%</span>
        )}
      </div>
    </div>
  );
};
