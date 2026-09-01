import type { BackgroundDefinition, EffectDefinition, PerformanceStats, PipelineState } from '@veyra/shared';
import { getEffect } from '@veyra/shared';
import { CameraSource } from './CameraSource.js';
import { MetricsCollector } from './MetricsCollector.js';
import { ShaderRenderer } from './ShaderRenderer.js';
import { shaderFor } from './shaders.js';
import { BackgroundProcessor, loadBackgroundMedia } from './background/BackgroundProcessor.js';
import { FaceTracker } from './face/FaceTracker.js';
import { drawCanvasEffect, canvasEffectKindFor, type FaceReplaceAssets } from './effects/canvasEffects.js';
import { AudioEngine, type AudioEngineState } from './audio/AudioEngine.js';

export interface ModelPaths {
  faceModel: string;
  segmentModel: string;
  wasmPath: string;
}

export interface VirtualCameraSink {
  start: (opts: { width: number; height: number; fps: number }) => Promise<void>;
  pushFrame: (blob: Blob, frameIndex: number) => void;
  stop: () => Promise<void>;
}

export interface PipelineOptions {
  displayCanvas: HTMLCanvasElement;
  modelPaths: ModelPaths;
  onStats?: (stats: PerformanceStats) => void;
  onError?: (message: string, hint?: string) => void;
  onStatusChange?: (status: 'starting' | 'running' | 'stopped' | 'error') => void;
  virtualCamera?: VirtualCameraSink;
}

const DEFAULT_RESOLUTION = { label: '1280 × 720', width: 1280, height: 720 };

export class Pipeline {
  private display: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;
  private input = document.createElement('canvas');
  private composite = document.createElement('canvas');
  private glCanvas = document.createElement('canvas');
  private gl: ShaderRenderer | null = null;
  private metrics = new MetricsCollector();
  private camera: CameraSource;
  private background: BackgroundProcessor | null = null;
  private face: FaceTracker | null = null;
  private audio = new AudioEngine();
  private video: HTMLVideoElement;

  private state: PipelineState;
  private raf = 0;
  private running = false;
  private lastProcessed = 0;
  private lastAdapt = 0;
  private goodFrames = 0;
  private vcamLastFrame = 0;
  private frameIndex = 0;
  private faceReplaceAssets: FaceReplaceAssets | null = null;
  private adaptCounter = 0;

  private modelPaths: ModelPaths;
  private onStats?: (stats: PerformanceStats) => void;
  private onError?: (message: string, hint?: string) => void;
  private onStatusChange?: (status: 'starting' | 'running' | 'stopped' | 'error') => void;
  private virtualCamera?: VirtualCameraSink;

  constructor(options: PipelineOptions) {
    this.display = options.displayCanvas;
    this.displayCtx = this.display.getContext('2d')!;
    this.modelPaths = options.modelPaths;
    this.onStats = options.onStats;
    this.onError = options.onError;
    this.onStatusChange = options.onStatusChange;
    this.virtualCamera = options.virtualCamera;

    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', 'true');
    this.video.muted = true;

    this.state = {
      running: false,
      effectId: 'none',
      effectQuality: 1,
      background: null,
      mirror: true,
      resolution: DEFAULT_RESOLUTION,
      fps: 30,
      stats: this.metrics.snapshot(),
    };

    this.camera = new CameraSource(this.video, this.onError);
  }

  get stateValue(): PipelineState {
    return { ...this.state, stats: this.metrics.snapshot() };
  }

  /** Re-point the pipeline at a (re-mounted) display canvas. */
  setDisplayCanvas(canvas: HTMLCanvasElement): void {
    this.display = canvas;
    this.displayCtx = canvas.getContext('2d')!;
  }

  get metricsValue(): MetricsCollector {
    return this.metrics;
  }

  get audioEngine(): AudioEngine {
    return this.audio;
  }

  get cameraSource(): CameraSource {
    return this.camera;
  }

  get faceTracker(): FaceTracker | null {
    return this.face;
  }

  get backgroundProcessor(): BackgroundProcessor | null {
    return this.background;
  }

  setFaceReplaceAssets(assets: FaceReplaceAssets | null): void {
    this.faceReplaceAssets = assets;
  }

  async start(cameraId?: string, micId?: string): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.onStatusChange?.('starting');

    try {
      this.ensureModels();
      await this.camera.start({
        deviceId: cameraId,
        audioDeviceId: micId,
        videoResolution: { width: this.state.resolution.width, height: this.state.resolution.height },
        frameRate: this.state.fps,
        echoCancellation: this.audioState.echoCancellation,
        noiseSuppression: this.audioState.noiseSuppression,
      });
    } catch {
      this.running = false;
      this.onStatusChange?.('error');
      return;
    }

    if (this.camera.audioTrack) {
      try {
        await this.audio.start(this.camera.stream!);
      } catch (err) {
        console.warn('Audio engine failed to start', err);
      }
    }

    this.setupPipelineCanvas();
    this.onStatusChange?.('running');
    this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.camera.stop();
    this.audio.stop();
    this.onStatusChange?.('stopped');
  }

  private ensureModels(): void {
    this.ensureBackground();
    this.ensureFaceTracker();
  }

  /**
   * Create (or reuse) the face landmark tracker without starting the camera.
   * Photo-driven face replacement needs landmarks even when the live preview
   * has not been started yet, so this is called on demand by the client.
   */
  ensureFaceTracker(): FaceTracker {
    if (!this.face) {
      this.face = new FaceTracker({
        modelPath: this.modelPaths.faceModel,
        wasmPath: this.modelPaths.wasmPath,
      });
    }
    return this.face;
  }

  /** Create (or reuse) the background segmentation processor. */
  ensureBackground(): BackgroundProcessor {
    if (!this.background) {
      this.background = new BackgroundProcessor({
        modelPath: this.modelPaths.segmentModel,
        wasmPath: this.modelPaths.wasmPath,
      });
    }
    return this.background;
  }

  private get audioState(): AudioEngineState {
    return this.audio['state'] as AudioEngineState;
  }

  private setupPipelineCanvas(): void {
    const W = this.state.resolution.width;
    const H = this.state.resolution.height;
    const q = this.state.effectQuality;
    const iw = Math.round(W * q);
    const ih = Math.round(H * q);
    this.input.width = iw;
    this.input.height = ih;
    this.composite.width = iw;
    this.composite.height = ih;
    this.glCanvas.width = iw;
    this.glCanvas.height = ih;
    this.display.width = W;
    this.display.height = H;
  }

  setResolution(res: { width: number; height: number; label?: string }): void {
    this.state.resolution = { ...this.state.resolution, ...res };
    if (this.running) this.setupPipelineCanvas();
  }

  setFps(fps: number): void {
    this.state.fps = fps;
    this.camera.videoTrack?.applyConstraints({ frameRate: { ideal: fps } }).catch(() => undefined);
  }

  setMirror(mirror: boolean): void {
    this.state.mirror = mirror;
  }

  setEffect(effect: EffectDefinition | null): void {
    this.state.effectId = effect?.id ?? 'none';
    this.state.effectQuality = 1;
    this.metrics.setQualityScale(1);
  }

  setBackground(background: BackgroundDefinition | null): void {
    this.state.background = background;
    if (background?.src && background.mode !== 'gradient') {
      loadBackgroundMedia(background.src, background.mode === 'video' ? 'video' : 'image');
    }
  }

  applyAudio(state: Partial<AudioEngineState>): void {
    this.audio.applyEffect(state.effect ?? this.audioState.effect, state.intensity ?? this.audioState.intensity);
    if (state.inputVolume !== undefined) this.audio.setInputVolume(state.inputVolume);
    if (state.outputVolume !== undefined) this.audio.setOutputVolume(state.outputVolume);
    if (state.noiseSuppression !== undefined) this.audio.setNoiseSuppression(state.noiseSuppression);
    if (state.echoCancellation !== undefined) this.audio.setEchoCancellation(state.echoCancellation);
    if (state.monitor !== undefined) this.audio.setMonitor(state.monitor);
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const interval = 1000 / this.state.fps;

    if (now - this.lastProcessed >= interval) {
      try {
        this.processFrame(now);
      } catch (err) {
        console.error('pipeline frame error', err);
        this.metrics.markDropped();
      }
      this.lastProcessed = now;
    }

    if (now - this.lastAdapt >= 2500) {
      this.adaptQuality();
      this.lastAdapt = now;
    }

    if (now - this.metrics['lastTick'] >= 500) {
      this.onStats?.(this.metrics.snapshot());
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private processFrame(now: number): void {
    const video = this.video;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    const W = this.input.width;
    const H = this.input.height;
    const iCtx = this.input.getContext('2d')!;
    const cCtx = this.composite.getContext('2d')!;

    let faceMs = 0;
    let bgMs = 0;
    let effMs = 0;
    const tFrame = performance.now();

    // 1) raw capture (mirrored)
    iCtx.save();
    iCtx.clearRect(0, 0, W, H);
    if (this.state.mirror) {
      iCtx.translate(W, 0);
      iCtx.scale(-1, 1);
    }
    iCtx.drawImage(video, 0, 0, W, H);
    iCtx.restore();

    // 2) face tracking (throttled internally)
    if (this.face?.ready) {
      const tf = performance.now();
      this.face.track(video, now);
      faceMs = performance.now() - tf;
    }

    // 3) background compositing
    let source = this.input;
    const bg = this.state.background;
    if (bg && this.background?.ready) {
      const tb = performance.now();
      const mask = this.background.segment(this.input, bg.mode === 'blur' || bg.mode === 'green' ? 33 : 66, now);
      this.background.composite(cCtx, W, H, this.input, bg, mask);
      bgMs = performance.now() - tb;
      source = this.composite;
    }

    const dCtx = this.displayCtx;
    dCtx.clearRect(0, 0, this.display.width, this.display.height);
    dCtx.imageSmoothingEnabled = true;
    dCtx.imageSmoothingQuality = 'medium';

    const effect = getEffect(this.state.effectId);
    const canvasKind = canvasEffectKindFor(effect?.id ?? null);

    if (!canvasKind) {
      // GPU shader path
      const sh = shaderFor(effect?.id ?? 'none');
      if (!this.gl) {
        try {
          this.gl = new ShaderRenderer(this.glCanvas);
        } catch (err) {
          this.onError?.(String((err as Error)?.message), 'gpu');
          this.gl = null;
        }
      }
      if (this.gl && sh) {
        const te = performance.now();
        this.gl.setFragment(sh.id, sh.source);
        this.gl.render(source, { uTime: now / 1000 });
        effMs = performance.now() - te;
        dCtx.drawImage(this.glCanvas, 0, 0, this.display.width, this.display.height);
      } else {
        dCtx.drawImage(source, 0, 0, this.display.width, this.display.height);
      }
    } else {
      dCtx.drawImage(source, 0, 0, this.display.width, this.display.height);
      const pose = this.face?.pose ?? null;
      if (pose) {
        drawCanvasEffect(canvasKind, dCtx, this.display, pose, now, this.faceReplaceAssets ?? undefined);
      }
    }

    this.metrics.tickFrame(effMs + bgMs + faceMs, bgMs, faceMs);
    void tFrame;

    // 4) virtual camera sampling
    this.sampleVirtualCamera(now);
  }

  private sampleVirtualCamera(now: number): void {
    if (!this.virtualCamera) return;
    const vcamFps = 30;
    if (now - this.vcamLastFrame < 1000 / vcamFps) return;
    this.vcamLastFrame = now;
    const frameIndex = this.frameIndex++;
    this.display.toBlob(
      (blob) => {
        if (blob) this.virtualCamera?.pushFrame(blob, frameIndex);
      },
      'image/jpeg',
      0.82,
    );
  }

  /** Graceful degradation: shrink internal resolution if the frame budget is blown. */
  private adaptQuality(): void {
    const s = this.metrics.snapshot();
    const budget = 1000 / Math.min(this.state.fps, 30);
    this.adaptCounter++;
    if (s.pipelineMs > budget * 1.4) {
      this.goodFrames = 0;
      const target = Math.max(0.5, this.state.effectQuality - 0.25);
      if (target !== this.state.effectQuality) {
        this.state.effectQuality = target;
        this.metrics.setQualityScale(target);
        this.setupPipelineCanvas();
      }
    } else if (s.pipelineMs < budget * 0.7) {
      this.goodFrames++;
      if (this.goodFrames > 4 && this.state.effectQuality < 1) {
        this.state.effectQuality = Math.min(1, this.state.effectQuality + 0.25);
        this.metrics.setQualityScale(this.state.effectQuality);
        this.setupPipelineCanvas();
      }
    }
  }

  dispose(): void {
    void this.stop();
    this.face?.dispose();
    this.background?.dispose();
    this.gl = null;
  }
}
