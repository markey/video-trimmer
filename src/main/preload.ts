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
  exportVideo: async (_args: unknown): Promise<void> => {
    throw new Error('export not wired yet');
  },
};

declare global {
  // eslint-disable-next-line no-var
  var electronAPI: typeof api;
}

contextBridge.exposeInMainWorld('electronAPI', api);
