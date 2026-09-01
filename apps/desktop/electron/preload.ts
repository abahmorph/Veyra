import { contextBridge, ipcRenderer } from 'electron';
import type { VeyraIpc, VirtualCameraInfo, VirtualMicInfo } from '@veyra/shared';

const veyraAPI: VeyraIpc = {
  virtualCamera: {
    getStatus: () => ipcRenderer.invoke('vcam:getStatus') as Promise<VirtualCameraInfo>,
    start: (opts) => ipcRenderer.invoke('vcam:start', opts) as Promise<VirtualCameraInfo>,
    stop: () => ipcRenderer.invoke('vcam:stop') as Promise<VirtualCameraInfo>,
    pushFrame: (data, frameIndex) => {
      ipcRenderer.send('vcam:frame', data, frameIndex);
    },
    onStatus: (cb) => {
      const listener = (_e: unknown, info: VirtualCameraInfo) => cb(info);
      ipcRenderer.on('vcam:status', listener);
      return () => ipcRenderer.removeListener('vcam:status', listener);
    },
  },
  virtualMic: {
    getStatus: () => ipcRenderer.invoke('vmic:getStatus') as Promise<VirtualMicInfo>,
    ensure: () => ipcRenderer.invoke('vmic:ensure') as Promise<VirtualMicInfo>,
  },
  apps: {
    detect: () => ipcRenderer.invoke('apps:detect'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    getGpu: () => ipcRenderer.invoke('app:gpu') as Promise<string>,
    isElectron: true,
  },
};

contextBridge.exposeInMainWorld('veyraAPI', veyraAPI);

declare global {
  interface Window {
    veyraAPI: VeyraIpc;
  }
}
