import { app, BrowserWindow, dialog, ipcMain, protocol, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * Main Electron process entry point for the Video Trimmer application.
 * Handles window creation, IPC communication, and integrates with video processing services.
 */

// For ESM modules, use import.meta.url instead of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

/**
 * Register custom protocol to safely serve local files to the renderer during development.
 * This allows the renderer to access local video files without security restrictions.
 */
protocol.registerSchemesAsPrivileged([
  { scheme: 'safe-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

/**
 * Creates the main application window with security settings and loads the renderer.
 * Sets up web preferences for security including context isolation and node integration disabled.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, prefer renderer/index.html next to compiled main.js (packaged resources)
    const candidates = [
      path.resolve(__dirname, 'renderer', 'index.html'),
      path.resolve('dist/renderer/index.html'),
    ];
    const target = candidates.find(p => fsSync.existsSync(p));
    mainWindow.loadFile(target || candidates[1]);
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Creates and sets the application menu with relevant items for the video editor.
 * Includes File operations, View options, and Help with About dialog.
 */
function createApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Video...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Video Files', extensions: ['mp4','mov','mkv','m4v','avi','webm','mpg','mpeg','ts','m2ts','mts','wmv','flv','3gp','3g2','mxf','ogg','ogv'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('file:open', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (!mainWindow) return;
            mainWindow.webContents.send('file:save');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    // View Menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Video Trimmer',
          click: () => {
            if (!mainWindow) return;
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Video Trimmer',
              message: 'Video Trimmer',
              detail: `A minimal, frame-accurate video trimmer with text watermark and download capabilities.

Built with Electron + React
GitHub: https://github.com/markey/video-trimmer

Created by Mark Kretschmann
X: @mark_k
Email: kretschmann@kde.org`,
              buttons: ['OK'],
              icon: process.platform === 'darwin' ? undefined : path.join(__dirname, '../../build/icon.png').replace(/\\/g, '/')
            });
          }
        }
      ]
    }
  ];

  // On macOS, add the app menu at the beginning
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  // Map safe-file://local?p=<absolutePath> to the actual file path
  protocol.registerFileProtocol('safe-file', (request, callback) => {
    try {
      const url = new URL(request.url);
      let filePath: string;
      if (process.platform === 'win32') {
        const host = url.hostname; // 'c' if safe-file://c/Users/...
        let pathname = decodeURIComponent(url.pathname); // '/Users/...'
        if (host) {
          const drive = host.toUpperCase();
          filePath = `${drive}:${pathname}`; // 'C:/Users/...'
        } else {
          // safe-file:///C:/Users/... => pathname '/C:/Users/...'
          if (pathname.startsWith('/')) pathname = pathname.slice(1);
          filePath = pathname; // 'C:/Users/...'
        }
        // Normalize to Windows backslashes
        filePath = filePath.replace(/\//g, '\\');
      } else {
        filePath = decodeURIComponent(url.pathname);
      }
      callback({ path: filePath });
    } catch (e) {
      callback({ error: -2 }); // net::FAILED
    }
  });

  registerIpcHandlers();
  createApplicationMenu();
  createWindow();
});

/**
 * Registers all IPC (Inter-Process Communication) handlers for the main process.
 * These handlers provide safe communication between the renderer process and system resources.
 */
function registerIpcHandlers() {
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'All files', extensions: ['*'] },
        { name: 'Video', extensions: ['mp4','mov','mkv','m4v','avi','webm','mpg','mpeg','ts','m2ts','mts','wmv','flv','3gp','3g2','mxf','ogg','ogv'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('fs:readFile', async (_e, filePath: string) => {
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('media:probe', async (_e, input: string) => {
    const { ffprobe, extractVideoMeta } = await import('./services/ffprobe');
    const probe = await ffprobe(input);
    const meta = extractVideoMeta(probe);
    return { probe, meta };
  });

  ipcMain.handle('dialog:saveFile', async (_e, opts?: { defaultPath?: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: opts?.defaultPath,
      filters: [
        { name: 'MP4', extensions: ['mp4'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle('export:start', async (e, opts: any) => {
    const { exportWithProgress } = await import('./services/ffmpeg');
    let wmPath: string | undefined;
    try {
      if (opts.wmImageDataUrl && typeof opts.wmImageDataUrl === 'string') {
        const m = /^data:image\/png;base64,(.+)$/.exec(opts.wmImageDataUrl);
        if (m) {
          const buf = Buffer.from(m[1], 'base64');
          const tmp = path.join(os.tmpdir(), `wm_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
          await fs.writeFile(tmp, buf);
          wmPath = tmp;
        }
      }
      const args = { ...opts, wmImagePath: wmPath };
      await exportWithProgress(args, (ratio) => {
        e.sender.send('export:progress', { ratio });
      });
      return { ok: true };
    } finally {
      if (wmPath) {
        try { await fs.unlink(wmPath); } catch {}
      }
    }
  });

  /**
   * Handles video download requests from the renderer process.
   * Uses yt-dlp to download videos from URLs and streams progress back to the UI.
   */
  ipcMain.handle('download:start', async (e, opts: { url: string; outputPath: string }) => {
    const { startDownload } = await import('./services/downloader');
    await startDownload({ url: opts.url, outputPath: opts.outputPath }, (p) => {
      e.sender.send('download:progress', p);
    });
    return { ok: true };
  });

  ipcMain.handle('window:setTitle', async (_e, title: string) => {
    if (mainWindow) {
      mainWindow.setTitle(title);
    }
  });
}
