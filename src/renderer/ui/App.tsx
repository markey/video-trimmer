import React, { useState } from 'react';
import type { ProjectStore } from '@shared/types';
import { defaultProject } from '@shared/types';

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<string | null>;
      readTextFile: (p: string) => Promise<string>;
      ffprobe: (src: string) => Promise<unknown>;
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
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#eaeaea', background: '#202124', height: '100vh' }}>
      <header style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #333' }}>
        <button onClick={openFile}>Open File</button>
        <div style={{ opacity: 0.8 }}>
          {project.sourcePath ? `Source: ${project.sourcePath}` : 'No file loaded'}
        </div>
      </header>
      <main style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, padding: 12, height: 'calc(100vh - 54px)' }}>
        <section style={{ display: 'grid', gridTemplateRows: 'minmax(320px, 1fr) 160px auto', gap: 12 }}>
          <PreviewPanel sourcePath={project.sourcePath} watermarkText={project.watermark.text} />
          <TimelinePanel start={project.trim.startSec} end={project.trim.endSec} onChange={(start, end) => setProject(p => ({ ...p, trim: { startSec: start, endSec: end } }))} />
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

const PreviewPanel: React.FC<{ sourcePath: string | null; watermarkText: string }> = ({ sourcePath, watermarkText }) => {
  return (
    <div style={{ ...boxStyle, position: 'relative' }}>
      {!sourcePath && <div style={{ opacity: 0.6 }}>Open a file to preview. mpv integration pending; using HTML5 fallback temporarily.</div>}
      {sourcePath && (
        <div style={{ position: 'relative' }}>
          {/* Temporary fallback. Replace with libmpv view later. */}
          <video src={sourcePath} controls style={{ width: '100%', height: 'auto', background: 'black' }} />
          <div style={{ position: 'absolute', right: 16, bottom: 16, color: 'white', opacity: 0.5, pointerEvents: 'none' }}>{watermarkText}</div>
        </div>
      )}
    </div>
  );
};

const TimelinePanel: React.FC<{ start: number; end: number; onChange: (s: number, e: number) => void }> = ({ start, end, onChange }) => {
  const [localStart, setLocalStart] = useState(start);
  const [localEnd, setLocalEnd] = useState(end);
  return (
    <div style={boxStyle}>
      <div style={{ marginBottom: 8 }}>Timeline (stub)</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <label>
          Start (s)
          <input type="number" step="0.001" value={localStart} onChange={(e) => setLocalStart(parseFloat(e.target.value))} onBlur={() => onChange(localStart, localEnd)} />
        </label>
        <label>
          End (s)
          <input type="number" step="0.001" value={localEnd} onChange={(e) => setLocalEnd(parseFloat(e.target.value))} onBlur={() => onChange(localStart, localEnd)} />
        </label>
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
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Watermark</div>
      <label style={{ display: 'block', marginBottom: 6 }}>
        Text
        <input type="text" value={wm.text} onChange={(e) => set({ text: e.target.value })} />
      </label>
      <label style={{ display: 'block', marginBottom: 6 }}>
        Font size
        <input type="number" value={wm.fontSizePx} onChange={(e) => set({ fontSizePx: parseInt(e.target.value) })} />
      </label>
      <label style={{ display: 'block', marginBottom: 6 }}>
        Color
        <input type="color" value={wm.color} onChange={(e) => set({ color: e.target.value })} />
      </label>
      <label style={{ display: 'block', marginBottom: 6 }}>
        Opacity
        <input type="range" min={0} max={1} step={0.01} value={wm.opacity} onChange={(e) => set({ opacity: parseFloat(e.target.value) })} /> {wm.opacity.toFixed(2)}
      </label>
      <label style={{ display: 'block', marginBottom: 6 }}>
        Anchor
        <select value={wm.anchor} onChange={(e) => set({ anchor: e.target.value as any })}>
          <option value="topLeft">Top Left</option>
          <option value="topRight">Top Right</option>
          <option value="bottomLeft">Bottom Left</option>
          <option value="bottomRight">Bottom Right</option>
        </select>
      </label>
      <div style={{ display: 'flex', gap: 12 }}>
        <label>
          Offset X
          <input type="number" value={wm.offsetX} onChange={(e) => set({ offsetX: parseInt(e.target.value) })} />
        </label>
        <label>
          Offset Y
          <input type="number" value={wm.offsetY} onChange={(e) => set({ offsetY: parseInt(e.target.value) })} />
        </label>
      </div>
    </div>
  );
};

const ExportPanel: React.FC<{ project: ProjectStore; onChange: (p: ProjectStore) => void }> = ({ project, onChange }) => {
  const exp = project.export;
  const set = (patch: Partial<ProjectStore['export']>) => onChange({ ...project, export: { ...exp, ...patch } });
  const onExport = async () => {
    alert('Export not wired yet. This will construct FFmpeg command per blueprint.');
  };
  return (
    <div style={boxStyle}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Export</div>
      <label style={{ display: 'block', marginBottom: 6 }}>
        Use GPU
        <input type="checkbox" checked={exp.useHardwareAccel} onChange={(e) => set({ useHardwareAccel: e.target.checked })} />
      </label>
      <label style={{ display: 'block', marginBottom: 6 }}>
        CRF
        <input type="number" min={0} max={51} value={exp.quality.value} onChange={(e) => set({ quality: { mode: 'crf', value: parseInt(e.target.value) } })} />
      </label>
      <button disabled={!project.sourcePath} onClick={onExport}>Export</button>
    </div>
  );
};
