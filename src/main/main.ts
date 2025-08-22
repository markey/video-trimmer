import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// For ESM modules, use import.meta.url instead of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

// Register custom protocol to safely serve local files to the renderer during dev
protocol.registerSchemesAsPrivileged([
  { scheme: 'safe-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

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
    mainWindow.loadFile(path.resolve('dist/renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
  createWindow();
});

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
    await exportWithProgress(opts, (ratio) => {
      e.sender.send('export:progress', { ratio });
    });
    return { ok: true };
  });
}
