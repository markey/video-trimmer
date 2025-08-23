Video Trimmer (Electron + React)

Minimal, frame-accurate trimmer with text watermark and video downloading capabilities. Scaffold includes:

- Electron main + preload with safe IPC.
- React UI skeleton: preview, timeline stub, watermark and export panels.
- Node services (stubs) for ffprobe and ffmpeg with command builder per blueprint.
- **NEW:** Video download functionality using yt-dlp for downloading videos from URLs.

## Features

- **Download**: Download videos from URLs using yt-dlp (supports YouTube, Vimeo, and many other sites)
- **Trim**: Frame-accurate video trimming with precise start/end time controls
- **Watermark**: Add customizable text watermarks with font, size, color, opacity, and positioning
- **Export**: Export trimmed videos with watermark in MP4 format using FFmpeg
- **Preview**: Real-time video preview with playback controls

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

- **FFmpeg and ffprobe**: Must be available on PATH, or place binaries under `bin/ffmpeg(.exe)` and `bin/ffprobe(.exe)`.
- **yt-dlp**: Required for video downloading functionality. Must be available on PATH, or place binary under `bin/yt-dlp(.exe)`.


## Download Usage

The download panel allows you to download videos from supported URLs:

1. Click "Choose Output..." to select where to save the downloaded video
2. Enter a video URL (YouTube, Vimeo, etc.)
3. Click "Download" to start the download
4. Progress will be shown with percentage, speed, and estimated time remaining
5. Once downloaded, the video will automatically be loaded into the editor for trimming

**Supported sites**: YouTube, Vimeo, Dailymotion, Facebook, Instagram, Twitter, TikTok, and hundreds more (see [yt-dlp supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)).

Planned next steps

- Wire ffprobe IPC: read FPS, duration, resolution, codecs and store in project.
- Thumbnail generator and keyframe indexer.
- Export worker: streaming progress to renderer and cancellation.


