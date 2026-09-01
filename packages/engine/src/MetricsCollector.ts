export interface Metrics {
  fps: number;
  captureFps: number;
  processingMs: number;
  pipelineMs: number;
  backgroundMs: number;
  faceMs: number;
  droppedFrames: number;
  qualityScale: number;
  lastFrameAt: number;
}

const DEFAULT: Metrics = {
  fps: 0,
  captureFps: 0,
  processingMs: 0,
  pipelineMs: 0,
  backgroundMs: 0,
  faceMs: 0,
  droppedFrames: 0,
  qualityScale: 1,
  lastFrameAt: 0,
};

export class MetricsCollector {
  private fpsWindow: number[] = [];
  private captureWindow: number[] = [];
  private processingWindow: number[] = [];
  private backgroundWindow: number[] = [];
  private faceWindow: number[] = [];
  private frameCounter = 0;
  private captureCounter = 0;
  private lastTick = performance.now();
  private lastCaptureTick = performance.now();
  private lastStats = { ...DEFAULT };

  reset(): void {
    this.fpsWindow = [];
    this.captureWindow = [];
    this.processingWindow = [];
    this.backgroundWindow = [];
    this.faceWindow = [];
    this.frameCounter = 0;
    this.captureCounter = 0;
    this.lastTick = performance.now();
    this.lastCaptureTick = performance.now();
    this.lastStats = { ...DEFAULT };
  }

  /** Called once per rendered frame. */
  tickFrame(processingMs?: number, backgroundMs?: number, faceMs?: number): void {
    const now = performance.now();
    this.frameCounter += 1;
    if (processingMs !== undefined) this.pushAvg(this.processingWindow, processingMs, 60);
    if (backgroundMs !== undefined) this.pushAvg(this.backgroundWindow, backgroundMs, 60);
    if (faceMs !== undefined) this.pushAvg(this.faceWindow, faceMs, 60);

    const elapsed = now - this.lastTick;
    if (elapsed >= 500) {
      this.fpsWindow.push((this.frameCounter * 1000) / elapsed);
      if (this.fpsWindow.length > 20) this.fpsWindow.shift();
      this.frameCounter = 0;
      this.lastTick = now;
    }
  }

  /** Called whenever a new raw camera frame is available (video requestVideoFrameCallback). */
  tickCapture(): void {
    const now = performance.now();
    this.captureCounter += 1;
    const elapsed = now - this.lastCaptureTick;
    if (elapsed >= 500) {
      this.captureWindow.push((this.captureCounter * 1000) / elapsed);
      if (this.captureWindow.length > 20) this.captureWindow.shift();
      this.captureCounter = 0;
      this.lastCaptureTick = now;
    }
  }

  markDropped(): void {
    this.lastStats.droppedFrames += 1;
  }

  setQualityScale(scale: number): void {
    this.lastStats.qualityScale = scale;
  }

  snapshot(): Metrics {
    this.lastStats = {
      ...this.lastStats,
      fps: this.avg(this.fpsWindow),
      captureFps: this.avg(this.captureWindow),
      processingMs: this.avg(this.processingWindow),
      backgroundMs: this.avg(this.backgroundWindow),
      faceMs: this.avg(this.faceWindow),
      pipelineMs:
        this.avg(this.processingWindow) + this.avg(this.backgroundWindow) + this.avg(this.faceWindow),
      lastFrameAt: performance.now(),
    };
    return { ...this.lastStats };
  }

  private avg(w: number[]): number {
    if (w.length === 0) return 0;
    return w.reduce((a, b) => a + b, 0) / w.length;
  }

  private pushAvg(window: number[], value: number, max: number): void {
    window.push(value);
    if (window.length > max) window.shift();
  }
}
