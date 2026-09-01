import type { AppDetection, VeyraIpc, VirtualCameraInfo, VirtualMicInfo } from '@veyra/shared';

/** Browser fallback used when running in a plain tab (no Electron). */
const browserFallback: VeyraIpc = {
  virtualCamera: {
    getStatus: async () =>
      ({ status: 'unavailable', devicePath: null, cardLabel: 'Veyra Camera', width: 0, height: 0, fps: 0, message: 'Virtual camera requires the Veyra desktop app.' }) as VirtualCameraInfo,
    start: async () => browserFallback.virtualCamera.getStatus(),
    stop: async () => browserFallback.virtualCamera.getStatus(),
    pushFrame: () => undefined,
    onStatus: () => () => undefined,
  },
  virtualMic: {
    getStatus: async () => ({ status: 'unavailable', sink: null, source: null, message: 'Requires the Veyra desktop app.' }) as VirtualMicInfo,
    ensure: async () => browserFallback.virtualMic.getStatus(),
  },
  apps: {
    detect: async () => [] as AppDetection[],
  },
  app: {
    getVersion: async () => 'browser',
    openExternal: async (url: string) => {
      window.open(url, '_blank', 'noopener');
    },
    getGpu: async () => {
      try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
        return gl ? String(gl.getParameter(gl.RENDERER)) : 'unknown';
      } catch {
        return 'unknown';
      }
    },
    isElectron: false,
  },
};

export const ipc: VeyraIpc = window.veyraAPI ?? browserFallback;

export const isElectron = window.veyraAPI?.app.isElectron ?? false;

export function isBrowserFallback(): boolean {
  return !isElectron;
}
