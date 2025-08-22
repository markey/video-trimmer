Video Trimmer (Electron + React)

Minimal, frame-accurate trimmer with text watermark. Scaffold includes:

- Electron main + preload with safe IPC.
- React UI skeleton: preview (HTML5 fallback), timeline stub, watermark and export panels.
- Node services (stubs) for ffprobe and ffmpeg with command builder per blueprint.

Getting started

1) Install dependencies

   npm install

2) Run in dev

   npm run dev

   - Opens Vite dev server for the renderer
   - Starts Electron and loads the dev URL

3) Build

   npm run build

Binary dependencies

- FFmpeg and ffprobe must be available on PATH, or place binaries under `bin/ffmpeg(.exe)` and `bin/ffprobe(.exe)`.
- mpv integration is pending. The preview currently uses an HTML5 video as a placeholder.

Planned next steps

- Wire ffprobe IPC: read FPS, duration, resolution, codecs and store in project.
- Thumbnail generator and keyframe indexer.
- Export worker: streaming progress to renderer and cancellation.
- libmpv preview bridge for frame-accurate stepping.

