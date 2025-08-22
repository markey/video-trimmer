import { contextBridge, ipcRenderer } from 'electron';

export type OpenDialogResult = string | null;

const api = {
  openFile: async (): Promise<OpenDialogResult> => ipcRenderer.invoke('dialog:openFile'),
  readTextFile: async (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
  fileUrl: (absPath: string): string => {
    const forward = absPath.replace(/\\/g, '/');
    // Ensure safe-file:///C:/... form on Windows
    const withLeading = forward.startsWith('/') ? forward : '/' + forward;
    return `safe-file://${encodeURI(withLeading)}`;
  },
  // Placeholders for later wiring
  ffprobe: async (src: string): Promise<unknown> => ipcRenderer.invoke('media:probe', src),
  saveFile: async (defaultPath?: string): Promise<string | null> => ipcRenderer.invoke('dialog:saveFile', { defaultPath }),
  startExport: async (args: any): Promise<{ ok: true }> => ipcRenderer.invoke('export:start', args),
  onExportProgress: (cb: (ratio: number) => void) => {
    const handler = (_: any, data: { ratio: number }) => cb(data.ratio);
    ipcRenderer.on('export:progress', handler);
    return () => ipcRenderer.off('export:progress', handler);
  },
};

declare global {
  // eslint-disable-next-line no-var
  var electronAPI: typeof api;
}

contextBridge.exposeInMainWorld('electronAPI', api);
