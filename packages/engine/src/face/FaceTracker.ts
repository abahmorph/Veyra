import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface FacePose {
  /** 478 normalized landmarks [0..1]. */
  landmarks: NormalizedLandmark[];
  /** approximate head rotation from the face transformation matrix, radians. */
  headTilt: number;
  headYaw: number;
  mouthOpen: number;
  blink: number;
  boundingBox: { x: number; y: number; w: number; h: number } | null;
  timestamp: number;
}

/** Key landmark indices in the 478-point MediaPipe face mesh. */
export const FACE = {
  rightEyeOuter: 33,
  rightEyeInner: 133,
  leftEyeInner: 362,
  leftEyeOuter: 263,
  noseTip: 1,
  noseBridge: 168,
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  chin: 152,
  foreheadLeft: 127,
  foreheadRight: 356,
  rightCheek: 234,
  leftCheek: 454,
  rightEar: 127,
  leftEar: 356,
} as const;

export type FaceTrackerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FaceTrackerOptions {
  modelPath: string;
  wasmPath: string;
  /** Seconds between detection runs (throttling). 0 = every frame. */
  throttleMs?: number;
  onStatusChange?: (status: FaceTrackerStatus, error?: string) => void;
}

export class FaceTracker {
  private landmarker: import('@mediapipe/tasks-vision').FaceLandmarker | null = null;
  private lastDetection = 0;
  private throttleMs: number;
  private lastPose: FacePose | null = null;
  status: FaceTrackerStatus = 'idle';
  /** Last load failure message (empty when the model loaded successfully). */
  errorMessage = '';
  private onStatusChange?: (status: FaceTrackerStatus, error?: string) => void;

  constructor(options: FaceTrackerOptions) {
    this.throttleMs = options.throttleMs ?? 66;
    this.onStatusChange = options.onStatusChange;
    void this.load(options).catch((err) => {
      this.errorMessage = String(err?.message ?? err);
      this.status = 'error';
      this.onStatusChange?.('error', this.errorMessage);
    });
  }

  private async load(options: FaceTrackerOptions): Promise<void> {
    const vision = await import('@mediapipe/tasks-vision');
    const { FilesetResolver, FaceLandmarker } = vision;

    this.status = 'loading';
    this.onStatusChange?.('loading');

    let wasmBase: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
    try {
      wasmBase = await FilesetResolver.forVisionTasks(options.wasmPath);
    } catch (err) {
      console.warn('FilesetResolver failed on local wasm, falling back to default CDN wasm', err);
      wasmBase = await FilesetResolver.forVisionTasks();
    }

    const tryDelegate = async (delegate: 'GPU' | 'CPU') => {
      return FaceLandmarker.createFromOptions(wasmBase, {
        baseOptions: {
          modelAssetPath: options.modelPath,
          delegate,
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      });
    };

    try {
      this.landmarker = await tryDelegate('GPU');
    } catch (gpuErr) {
      try {
        this.landmarker = await tryDelegate('CPU');
      } catch (err) {
        this.errorMessage = String((err as Error)?.message ?? err);
        this.status = 'error';
        this.onStatusChange?.('error', this.errorMessage);
        console.warn('FaceLandmarker GPU + CPU delegate both failed', gpuErr, err);
        throw err;
      }
    }

    this.status = 'ready';
    this.onStatusChange?.('ready');
  }

  get ready(): boolean {
    return this.status === 'ready' && !!this.landmarker;
  }

  get pose(): FacePose | null {
    return this.lastPose;
  }

  get statusValue(): FaceTrackerStatus {
    return this.status;
  }

  /**
   * One-shot face detection on a static image/canvas (e.g. an uploaded photo).
   * Used to build face-replace source assets without needing a live stream.
   */
  detectImage(source: HTMLImageElement | HTMLCanvasElement): FacePose | null {
    if (!this.ready || !this.landmarker) return null;
    try {
      const result = this.landmarker.detectForVideo(source, performance.now());
      const face = result.faceLandmarks?.[0];
      if (!face || face.length < 478) return null;
      return this.buildPose(face, performance.now());
    } catch (err) {
      console.warn('FaceLandmarker.detectImage failed', err);
      return null;
    }
  }

  /**
   * Run detection if enough time has passed since the last run.
   * Returns the cached pose when throttled.
   */
  track(video: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, now = performance.now()): FacePose | null {
    if (!this.ready || !this.landmarker) return this.lastPose;
    if (now - this.lastDetection < this.throttleMs) return this.lastPose;
    this.lastDetection = now;

    try {
      const result = this.landmarker.detectForVideo(video, Math.round(now));
      const face = result.faceLandmarks?.[0];
      if (!face || face.length < 478) return this.lastPose;
      this.lastPose = this.buildPose(face, now);
    } catch (err) {
      console.warn('FaceLandmarker.detectForVideo failed', err);
    }
    return this.lastPose;
  }

  private buildPose(landmarks: NormalizedLandmark[], timestamp: number): FacePose {
    const p = (i: number) => landmarks[i]!;
    const mouthOpen =
      Math.abs(p(FACE.mouthTop).y - p(FACE.mouthBottom).y) +
      Math.abs(p(FACE.mouthTop).x - p(FACE.mouthBottom).x) * 0.3;
    const headTilt = Math.atan2(
      p(FACE.rightEar).y - p(FACE.leftEar).y,
      p(FACE.rightEar).x - p(FACE.leftEar).x,
    );
    const mid = (a: number, b: number) => ({
      x: (p(a).x + p(b).x) / 2,
      y: (p(a).y + p(b).y) / 2,
    });
    const nose = p(FACE.noseTip);
    const headMid = mid(FACE.rightEar, FACE.leftEar);
    const headYaw = Math.atan2(nose.x - headMid.x, Math.abs(p(FACE.rightEar).x - p(FACE.leftEar).x));

    const xs = landmarks.map((l) => l.x);
    const ys = landmarks.map((l) => l.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      landmarks,
      headTilt,
      headYaw,
      mouthOpen,
      blink: 0.5,
      boundingBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      timestamp,
    };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastPose = null;
    this.status = 'idle';
  }
}
