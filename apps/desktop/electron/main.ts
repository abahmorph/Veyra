import { app, BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { createVirtualCameraAdapter, describeGpu } from './virtualCamera/platform.js';
import { getVirtualMicStatus, ensureVirtualMic } from './virtualMic/index.js';
import { detectApps } from './appsDetector.js';

const isDev = !!process.env.VEYRA_DEV_SERVER_URL;
const vcam = createVirtualCameraAdapter();

function pushVcamStatus(): void {
  vcam.detectDevice().then((status) => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('vcam:status', status));
  });
}

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#07070d',
    title: 'Veyra',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    void win.loadURL(process.env.VEYRA_DEV_SERVER_URL!);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void vcam.stop();
});

/* ------------------------- IPC handlers ------------------------- */

ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:openExternal', (_e, url: string) => shell.openExternal(url));
ipcMain.handle('app:gpu', () => describeGpu());

ipcMain.handle('vcam:getStatus', () => vcam.detectDevice());
ipcMain.handle('vcam:start', (_e, opts: { width: number; height: number; fps: number }) => {
  const result = vcam.start(opts);
  result.then(() => pushVcamStatus());
  return result;
});
ipcMain.handle('vcam:stop', () => {
  const result = vcam.stop();
  result.then(() => pushVcamStatus());
  return result;
});
ipcMain.on('vcam:frame', (_e: IpcMainInvokeEvent, data: ArrayBuffer) => {
  vcam.pushFrame(new Uint8Array(data), 0);
});

ipcMain.handle('vmic:getStatus', () => getVirtualMicStatus());
ipcMain.handle('vmic:ensure', () => ensureVirtualMic());

ipcMain.handle('apps:detect', () => detectApps());
