export type Resolution = {
  label: string;
  width: number;
  height: number;
};

export type FpsOption = 15 | 24 | 30 | 60;

export type EffectCategory =
  | 'face'
  | 'character'
  | 'background'
  | 'color'
  | 'privacy';

export type PremiumTier = 'free' | 'premium';

export interface EffectDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  premium: boolean;
  /** GPU cost heuristic: 'low' | 'medium' | 'high' — used for auto quality degradation. */
  cost: 'low' | 'medium' | 'high';
  /** Whether the effect requires face landmarks. */
  requiresFace?: boolean;
  /** Optional shader id handled by the engine. */
  kind:
    | 'shader'
    | 'face-mask'
    | 'avatar'
    | 'privacy-blur'
    | 'color-grade'
    | 'face-replace'
    | 'pixel'
    | 'glitch';
  preview: string;
}

export type BackgroundMode =
  | 'none'
  | 'blur'
  | 'remove'
  | 'image'
  | 'video'
  | 'gradient'
  | 'green';

export interface GradientStop {
  offset: number;
  color: string;
}

export type BackgroundDefinition = {
  id: string;
  name: string;
  mode: Exclude<BackgroundMode, 'none'>;
  premium: boolean;
  kind: 'builtin' | 'uploaded' | 'custom';
  /** URL or data URI for image/video backgrounds. */
  src?: string;
  gradient?: GradientStop[];
  blurStrength?: number;
};

export type VoiceEffectDefinition = {
  id: string;
  name: string;
  description: string;
  premium: boolean;
  /** Which DSP chain the engine applies. */
  chain: 'pitch' | 'robot' | 'radio' | 'echo' | 'alien' | 'none';
  intensityRange: [number, number];
};

export type PersonKind = 'photo' | 'video' | 'character';

/** A person / character used as the transformation source in the Studio. */
export interface PersonAsset {
  id: string;
  name: string;
  kind: PersonKind;
  /** Data URL for uploads (persisted locally), builtin token for characters. */
  src: string;
  /** Optional small data-URL preview. */
  thumbnail?: string;
  /** Video duration in seconds (for uploaded videos). */
  durationSec?: number;
  premium: boolean;
  source: 'uploaded' | 'builtin';
  /**
   * Whether the current AI build can drive live transformation from this asset.
   * When false the UI must say so honestly instead of pretending.
   */
  transformAvailable: boolean;
  /** Human-readable reason when transformAvailable is false. */
  transformReason?: string;
}

export interface ScenePreset {
  id: string;
  name: string;
  effectId: string | null;
  person: PersonAsset | null;
  background: BackgroundDefinition | null;
  voiceEffectId: string | null;
  voiceIntensity: number;
  premium: boolean;
  createdAt: number;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
}

export type VirtualCameraStatus =
  | 'available'
  | 'starting'
  | 'unavailable'
  | 'error'
  | 'module-missing';

export interface VirtualCameraInfo {
  status: VirtualCameraStatus;
  devicePath: string | null;
  cardLabel: string;
  width: number;
  height: number;
  fps: number;
  message?: string;
}

export type VirtualMicStatus =
  | 'available'
  | 'unavailable'
  | 'starting'
  | 'error';

export interface VirtualMicInfo {
  status: VirtualMicStatus;
  sink: string | null;
  source: string | null;
  message?: string;
}

export interface AppDetection {
  name: string;
  running: boolean;
  cameraCompatible: boolean;
  micCompatible: boolean;
  notes: string;
}

export interface PerformanceStats {
  fps: number;
  captureFps: number;
  processingMs: number;
  pipelineMs: number;
  backgroundMs: number;
  faceMs: number;
  droppedFrames: number;
  qualityScale: number;
  gpu?: {
    backend: 'webgl2' | 'webgpu' | 'software';
    renderer: string;
    vendor: string;
  } | null;
}

export interface PipelineState {
  running: boolean;
  effectId: string | null;
  effectQuality: number;
  background: BackgroundDefinition | null;
  mirror: boolean;
  resolution: Resolution;
  fps: number;
  stats: PerformanceStats;
}

export type QualityMode = 'auto' | 'high' | 'balanced' | 'performance';

/** IPC contract shared between renderer and Electron main. */
export interface VeyraIpc {
  virtualCamera: {
    getStatus: () => Promise<VirtualCameraInfo>;
    start: (opts: { width: number; height: number; fps: number }) => Promise<VirtualCameraInfo>;
    stop: () => Promise<VirtualCameraInfo>;
    pushFrame: (data: ArrayBuffer, frameIndex: number) => void;
    onStatus: (cb: (info: VirtualCameraInfo) => void) => () => void;
  };
  virtualMic: {
    getStatus: () => Promise<VirtualMicInfo>;
    ensure: () => Promise<VirtualMicInfo>;
  };
  apps: {
    detect: () => Promise<AppDetection[]>;
  };
  app: {
    getVersion: () => Promise<string>;
    openExternal: (url: string) => Promise<void>;
    getGpu?: () => Promise<string>;
    isElectron: boolean;
  };
}
