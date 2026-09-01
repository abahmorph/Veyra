import { execFile } from 'node:child_process';
import { spawn, type ChildProcess } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type VirtualCameraBackend = 'linux-v4l2loopback' | 'windows-obs' | 'macos-syphon';

export interface VirtualCameraResult {
  status: 'available' | 'starting' | 'unavailable' | 'error' | 'module-missing';
  devicePath: string | null;
  cardLabel: string;
  width: number;
  height: number;
  fps: number;
  message?: string;
}

export interface PlatformAdapter {
  readonly backend: VirtualCameraBackend;
  detectDevice(): Promise<VirtualCameraResult>;
  start(opts: { width: number; height: number; fps: number }): Promise<VirtualCameraResult>;
  pushFrame(data: Uint8Array, frameIndex: number): void;
  stop(): Promise<VirtualCameraResult>;
}

/** Resolve the right platform adapter. */
export function createVirtualCameraAdapter(): PlatformAdapter {
  if (process.platform === 'linux') return new LinuxV4L2Adapter();
  if (process.platform === 'win32') return new WindowsAdapter();
  if (process.platform === 'darwin') return new MacAdapter();
  return new UnsupportedAdapter();
}

export const VCAM_DEVICE_LABEL = 'Veyra Camera';
export const DEFAULT_DEVICE_PATH = '/dev/video10';

/* ------------------------------------------------------------------ */
/* Linux — v4l2loopback + ffmpeg feed                                  */
/* ------------------------------------------------------------------ */

export class LinuxV4L2Adapter implements PlatformAdapter {
  readonly backend = 'linux-v4l2loopback' as const;
  private ffmpeg: ChildProcess | null = null;
  private startedWith: { width: number; height: number; fps: number } | null = null;
  private lastError = '';

  async detectDevice(): Promise<VirtualCameraResult> {
    const path = await this.findDevice();
    if (!path) {
      return {
        status: 'module-missing',
        devicePath: DEFAULT_DEVICE_PATH,
        cardLabel: VCAM_DEVICE_LABEL,
        width: 0,
        height: 0,
        fps: 0,
        message:
          'The v4l2loopback kernel module is not loaded. Run `npm run setup:virtual-camera` once (requires sudo), or run `sudo modprobe v4l2loopback video_nr=10 card_label="Veyra Camera" exclusive_caps=1`.',
      };
    }
    if (this.ffmpeg && this.startedWith) {
      return {
        status: 'available',
        devicePath: path,
        cardLabel: VCAM_DEVICE_LABEL,
        ...this.startedWith,
      };
    }
    return {
      status: 'unavailable',
      devicePath: path,
      cardLabel: VCAM_DEVICE_LABEL,
      width: 0,
      height: 0,
      fps: 0,
      message: `Device ${path} exists but the feed is not running.`,
    };
  }

  async findDevice(): Promise<string | null> {
    // Prefer a device labelled "Veyra Camera".
    try {
      const base = '/sys/class/video4linux';
      const entries = readdirSync(base);
      for (const entry of entries) {
        const nameFile = `${base}/${entry}/name`;
        if (existsSync(nameFile)) {
          const { readFileSync } = await import('node:fs');
          const name = readFileSync(nameFile, 'utf8').trim();
          if (name === VCAM_DEVICE_LABEL) return `/dev/${entry}`;
        }
      }
    } catch {
      /* fall through */
    }
    if (existsSync(DEFAULT_DEVICE_PATH)) return DEFAULT_DEVICE_PATH;
    return null;
  }

  async start(opts: { width: number; height: number; fps: number }): Promise<VirtualCameraResult> {
    if (this.ffmpeg) return this.detectDevice();
    const device = await this.findDevice();
    if (!device) return this.detectDevice();

    this.startedWith = opts;
    const result = await this.spawnFfmpeg(device, opts, 'yuyv422');
    if (result) return result;

    // Retry once with MJPEG passthrough if YUYV failed.
    await this.killFfmpeg();
    this.startedWith = opts;
    const retry = await this.spawnFfmpeg(device, opts, 'mjpeg');
    if (retry) return retry;

    this.startedWith = null;
    return {
      status: 'error',
      devicePath: device,
      cardLabel: VCAM_DEVICE_LABEL,
      width: opts.width,
      height: opts.height,
      fps: opts.fps,
      message: `Could not start the virtual camera feed (${this.lastError || 'ffmpeg failed'}).`,
    };
  }

  private spawnFfmpeg(
    device: string,
    opts: { width: number; height: number; fps: number },
    pixFmt: 'yuyv422' | 'mjpeg',
  ): Promise<VirtualCameraResult | null> {
    return new Promise((resolve) => {
      const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'mjpeg',
        '-i', 'pipe:0',
        '-an',
        '-vf', `scale=${opts.width}:${opts.height}`,
        '-r', String(opts.fps),
        '-f', 'v4l2',
        '-pix_fmt', pixFmt,
        device,
      ];
      const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
      let stderr = '';
      proc.stderr?.on('data', (d) => {
        stderr = String(d).slice(0, 800);
      });
      proc.on('error', (err) => {
        this.lastError = String(err.message);
        this.ffmpeg = null;
        resolve({ status: 'error', devicePath: device, cardLabel: VCAM_DEVICE_LABEL, width: opts.width, height: opts.height, fps: opts.fps, message: `ffmpeg not found or failed to launch: ${err.message}` });
      });
      // If ffmpeg exits quickly (< 1.5s) it likely failed to open the device.
      const failTimer = setTimeout(() => resolve(null), 1500);
      proc.on('exit', (code) => {
        if (code !== 0 && this.ffmpeg === proc) {
          this.lastError = stderr.trim() || `ffmpeg exited with code ${code}`;
          this.ffmpeg = null;
        }
      });
      proc.stdin.on('drain', () => undefined);
      this.ffmpeg = proc;
      // give it a moment, then treat as started
      setTimeout(() => {
        if (this.ffmpeg === proc) {
          clearTimeout(failTimer);
          resolve(null);
        }
      }, 1400);
    });
  }

  pushFrame(data: Uint8Array, _frameIndex: number): void {
    const proc = this.ffmpeg;
    if (!proc || proc.stdin === null || !proc.stdin.writable || proc.stdin.destroyed) return;
    try {
      proc.stdin.write(data);
    } catch (err) {
      console.warn('[vcam] write failed', err);
    }
  }

  private async killFfmpeg(): Promise<void> {
    const proc = this.ffmpeg;
    this.ffmpeg = null;
    if (!proc) return;
    if (proc.stdin) proc.stdin.end();
    proc.kill('SIGTERM');    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 800);
      proc.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  async stop(): Promise<VirtualCameraResult> {
    await this.killFfmpeg();
    const device = await this.findDevice();
    return {
      status: device ? 'unavailable' : 'module-missing',
      devicePath: device,
      cardLabel: VCAM_DEVICE_LABEL,
      width: 0,
      height: 0,
      fps: 0,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Windows — OBS Virtual Camera (documented bridge)                    */
/* ------------------------------------------------------------------ */

export class WindowsAdapter implements PlatformAdapter {
  readonly backend = 'windows-obs' as const;
  detectDevice(): Promise<VirtualCameraResult> {
    return Promise.resolve({
      status: 'unavailable',
      devicePath: null,
      cardLabel: VCAM_DEVICE_LABEL,
      width: 0,
      height: 0,
      fps: 0,
      message:
        'Windows support requires the OBS Virtual Camera plugin or the e2e-overlay driver. Install OBS with the Virtual Camera plugin, create a "Veyra Camera" source, then return here. (Planned: native e2e-overlay driver.)',
    });
  }
  async start(): Promise<VirtualCameraResult> {
    return this.detectDevice();
  }
  pushFrame(): void {
    /* no-op until driver bridge is implemented */
  }
  async stop(): Promise<VirtualCameraResult> {
    return this.detectDevice();
  }
}

/* ------------------------------------------------------------------ */
/* macOS — Syphon / ScreenCaptureKit bridge (documented)               */
/* ------------------------------------------------------------------ */

export class MacAdapter implements PlatformAdapter {
  readonly backend = 'macos-syphon' as const;
  detectDevice(): Promise<VirtualCameraResult> {
    return Promise.resolve({
      status: 'unavailable',
      devicePath: null,
      cardLabel: VCAM_DEVICE_LABEL,
      width: 0,
      height: 0,
      fps: 0,
      message:
        'macOS uses virtual cameras differently (no user-space V4L2). Planned bridge: a HAL plugin / Syphon server exposed as a camera via a helper binary. For now apps can capture the Veyra preview window directly.',
    });
  }
  async start(): Promise<VirtualCameraResult> {
    return this.detectDevice();
  }
  pushFrame(): void {
    /* no-op */
  }
  async stop(): Promise<VirtualCameraResult> {
    return this.detectDevice();
  }
}

/* ------------------------------------------------------------------ */
/* Unsupported OS                                                      */
/* ------------------------------------------------------------------ */

export class UnsupportedAdapter implements PlatformAdapter {
  readonly backend = 'linux-v4l2loopback' as const;
  detectDevice(): Promise<VirtualCameraResult> {
    return Promise.resolve({
      status: 'unavailable',
      devicePath: null,
      cardLabel: VCAM_DEVICE_LABEL,
      width: 0,
      height: 0,
      fps: 0,
      message: `Virtual camera is not yet supported on ${process.platform}.`,
    });
  }
  async start(): Promise<VirtualCameraResult> {
    return this.detectDevice();
  }
  pushFrame(): void {
    /* no-op */
  }
  async stop(): Promise<VirtualCameraResult> {
    return this.detectDevice();
  }
}

/** Report GPU/Vulkan-ish info for the dev screen (best-effort). */
export async function describeGpu(): Promise<string> {
  if (process.platform === 'linux') {
    try {
      const { stdout } = await execFileAsync('lspci', ['-nn']);
      const line = stdout.split('\n').find((l) => /VGA|3D|Display/i.test(l))?.trim();
      return line ?? 'unknown';
    } catch {
      return 'unknown (lspci unavailable)';
    }
  }
  return 'unknown';
}
