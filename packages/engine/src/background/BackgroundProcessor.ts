import type { BackgroundDefinition } from '@veyra/shared';
import type { ImageSegmenter } from '@mediapipe/tasks-vision';

export type SegmentStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SegmentMask {
  /** Person confidence, 0..1, row-major at (width, height). */
  data: Float32Array;
  width: number;
  height: number;
  at: number;
}

export interface BackgroundProcessorOptions {
  modelPath: string;
  wasmPath: string;
  /** Internal mask resolution, e.g. 192x192 — cheaper on weak hardware. */
  maskSize?: number;
  onStatusChange?: (status: SegmentStatus, error?: string) => void;
}

export class BackgroundProcessor {
  private segmenter: ImageSegmenter | null = null;
  private status: SegmentStatus = 'idle';
  private onStatusChange?: (status: SegmentStatus, error?: string) => void;
  private mask: SegmentMask | null = null;
  private lastRun = 0;
  private maskSize: number;
  private subjectCanvas = document.createElement('canvas');
  private subjectCtx = this.subjectCanvas.getContext('2d', { willReadFrequently: false })!;

  constructor(options: BackgroundProcessorOptions) {
    this.maskSize = options.maskSize ?? 192;
    this.onStatusChange = options.onStatusChange;
    void this.init(options).catch((err) => {
      this.status = 'error';
      this.onStatusChange?.('error', String((err as Error)?.message ?? err));
    });
  }

  private async init(options: BackgroundProcessorOptions): Promise<void> {
    const vision = await import('@mediapipe/tasks-vision');
    const { FilesetResolver, ImageSegmenter } = vision;
    this.status = 'loading';
    this.onStatusChange?.('loading');

    let wasmBase: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
    try {
      wasmBase = await FilesetResolver.forVisionTasks(options.wasmPath);
    } catch (err) {
      console.warn('FilesetResolver failed on local wasm, falling back to default CDN wasm', err);
      wasmBase = await FilesetResolver.forVisionTasks();
    }

    const create = (delegate: 'GPU' | 'CPU') =>
      ImageSegmenter.createFromOptions(wasmBase, {
        baseOptions: { modelAssetPath: options.modelPath, delegate },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: true,
      });

    try {
      this.segmenter = await create('GPU');
    } catch {
      this.segmenter = await create('CPU');
    }
    this.status = 'ready';
    this.onStatusChange?.('ready');
  }

  get ready(): boolean {
    return this.status === 'ready' && !!this.segmenter;
  }

  get statusValue(): SegmentStatus {
    return this.status;
  }

  get currentMask(): SegmentMask | null {
    return this.mask;
  }

  /**
   * Run segmentation if the throttle window has elapsed.
   * Throttling keeps the pipeline smooth on weaker hardware.
   */
  segment(
    source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
    throttleMs = 66,
    now = performance.now(),
  ): SegmentMask | null {
    if (!this.ready || !this.segmenter) return this.mask;
    if (now - this.lastRun < throttleMs) return this.mask;
    this.lastRun = now;
    try {
      const result = this.segmenter.segmentForVideo(source, Math.round(now));
      // selfie_multiclass labels: 0 = background, 1 = person, rest are body parts.
      const person = result.confidenceMasks?.[1] ?? result.confidenceMasks?.[0];
      if (!person) return this.mask;
      const data = person.getAsFloat32Array();
      this.mask = { data, width: person.width, height: person.height, at: now };
    } catch (err) {
      console.warn('segmentation failed', err);
    }
    return this.mask;
  }

  get hasValidMask(): boolean {
    return !!this.mask;
  }

  /**
   * Composite the subject over the requested background using the cached mask.
   * `ctx` is the display canvas context at (width, height).
   */
  composite(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    subject: HTMLCanvasElement,
    background: BackgroundDefinition | null,
    mask?: SegmentMask | null,
  ): void {
    const useMask = mask ?? this.mask;
    // Draw the background layer.
    this.drawBackground(ctx, width, height, subject, background);

    if (useMask && this.segmenter) {
      // Draw the subject clipped by the (upscaled) person mask.
      this.drawMaskedSubject(ctx, width, height, subject, useMask);
    } else {
      ctx.drawImage(subject, 0, 0, width, height);
    }
  }

  private drawMaskedSubject(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    subject: HTMLCanvasElement,
    mask: SegmentMask,
  ): void {
    const temp = this.subjectCanvas;
    if (temp.width !== width || temp.height !== height) {
      temp.width = width;
      temp.height = height;
    }
    const tctx = this.subjectCtx;
    tctx.clearRect(0, 0, width, height);
    tctx.drawImage(subject, 0, 0, width, height);

    const maskCanvas = maskCanvasFor(mask.data, mask.width, mask.height);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(maskCanvas, 0, 0, width, height);
    tctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(temp, 0, 0, width, height);
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    subject: HTMLCanvasElement,
    background: BackgroundDefinition | null,
  ): void {
    if (!background) {
      ctx.drawImage(subject, 0, 0, width, height);
      return;
    }
    switch (background.mode) {
      case 'blur': {
        const s = background.blurStrength ?? 0.6;
        ctx.save();
        ctx.filter = `blur(${Math.round(12 + s * 30)}px)`;
        ctx.drawImage(subject, 0, 0, width, height);
        ctx.restore();
        break;
      }
      case 'remove': {
        // Transparent/black behind; subject will be drawn over it.
        ctx.clearRect(0, 0, width, height);
        break;
      }
      case 'image': {
        this.drawMedia(ctx, width, height, background.src);
        break;
      }
      case 'video': {
        this.drawMedia(ctx, width, height, background.src);
        break;
      }
      case 'gradient': {
        const stops = background.gradient ?? [{ offset: 0, color: '#000' }];
        const g = ctx.createLinearGradient(0, 0, width, height);
        for (const s of stops) g.addColorStop(s.offset, s.color);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'green': {
        ctx.fillStyle = '#00b140';
        ctx.fillRect(0, 0, width, height);
        break;
      }
    }
  }

  private drawMedia(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    src: string | undefined,
  ): void {
    const el = mediaCache.get(src ?? '');
    const readyImage = el instanceof HTMLImageElement ? el : undefined;
    const readyVideo = el instanceof HTMLVideoElement && !el.paused ? el : undefined;
    const readyEl = readyImage ?? readyVideo;
    if (readyEl) {
      ctx.save();
      // cover-fit
      const elW = readyImage?.naturalWidth ?? readyVideo?.videoWidth ?? width;
      const elH = readyImage?.naturalHeight ?? readyVideo?.videoHeight ?? height;
      const scale = Math.max(width / elW, height / elH);
      const dw = elW * scale;
      const dh = elH * scale;
      ctx.drawImage(readyEl, (width - dw) / 2, (height - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0b0b12';
      ctx.fillRect(0, 0, width, height);
    }
  }

  dispose(): void {
    this.segmenter?.close();
    this.segmenter = null;
    this.mask = null;
    this.status = 'idle';
  }
}

/* ---- Media cache for uploaded / builtin backgrounds ---- */

const mediaCache = new Map<string, HTMLImageElement | HTMLVideoElement>();
const loading = new Map<string, Promise<void>>();

export function loadBackgroundMedia(src: string, kind: 'image' | 'video'): void {
  if (mediaCache.has(src)) return;
  if (loading.has(src)) return;

  const promise = new Promise<void>((resolve, reject) => {
    if (kind === 'video') {
      const v = document.createElement('video');
      v.src = src;
      v.loop = true;
      v.muted = true;
      v.setAttribute('playsinline', 'true');
      v.playsInline = true;
      v.onloadeddata = () => {
        void v.play().catch(() => undefined);
        resolve();
      };
      v.onerror = () => reject(new Error('background video failed to load'));
      mediaCache.set(src, v);
    } else {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('background image failed to load'));
      mediaCache.set(src, img);
    }
  });
  loading.set(src, promise);
  promise.finally(() => loading.delete(src));
}

export function isBackgroundMediaReady(src: string): boolean {
  const el = mediaCache.get(src);
  if (!el) return false;
  return el instanceof HTMLImageElement ? el.complete : el.readyState >= 2;
}

export function getBackgroundMedia(src: string): HTMLImageElement | HTMLVideoElement | undefined {
  return mediaCache.get(src);
}

/* ---- Mask upscaling helper (cached canvas) ---- */

const maskCanvasPool: HTMLCanvasElement[] = [];
let poolCtx: CanvasRenderingContext2D | null = null;

function maskCanvasFor(data: Float32Array, maskW: number, maskH: number): HTMLCanvasElement {
  let canvas = maskCanvasPool.find((c) => c.width === maskW && c.height === maskH);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = maskW;
    canvas.height = maskH;
    maskCanvasPool.push(canvas);
  }
  let ctx = poolCtx;
  if (!ctx || ctx.canvas !== canvas) {
    ctx = canvas.getContext('2d')!;
    poolCtx = ctx;
  }
  // Write confidence values into the alpha channel of an RGBA ImageData.
  const img = ctx.createImageData(maskW, maskH);
  const d = img.data;
  for (let i = 0; i < data.length; i++) {
    const a = Math.max(0, Math.min(255, data[i]! * 255));
    d[i * 4] = 255;
    d[i * 4 + 1] = 255;
    d[i * 4 + 2] = 255;
    d[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function resetBackgroundMediaCache(): void {
  mediaCache.clear();
  loading.clear();
  maskCanvasPool.length = 0;
  poolCtx = null;
}
