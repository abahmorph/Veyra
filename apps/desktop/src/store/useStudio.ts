import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppDetection,
  BackgroundDefinition,
  CameraDeviceInfo,
  PerformanceStats,
  PersonAsset,
  VirtualCameraInfo,
  VirtualMicInfo,
} from '@veyra/shared';
import { BUILTIN_BACKGROUNDS, FPS_OPTIONS } from '@veyra/shared';

export interface StudioState {
  devices: CameraDeviceInfo[];
  videoDevices: CameraDeviceInfo[];
  audioDevices: CameraDeviceInfo[];
  selectedCamera: string;
  selectedMic: string;
  resolution: { label: string; width: number; height: number };
  fps: number;
  mirror: boolean;
  effectId: string;
  person: PersonAsset | null;
  people: PersonAsset[];
  background: BackgroundDefinition | null;
  customBackgrounds: BackgroundDefinition[];
  voiceEffectId: string;
  voiceIntensity: number;
  inputVolume: number;
  outputVolume: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  monitor: boolean;
  running: boolean;
  status: 'idle' | 'starting' | 'running' | 'stopped' | 'error';
  stats: PerformanceStats | null;
  vcam: VirtualCameraInfo | null;
  vmic: VirtualMicInfo | null;
  apps: AppDetection[];
  selectedApp: string | null;
  compareRaw: boolean;
  faceModelReady: boolean;
  segmentModelReady: boolean;
  errorMessage: string | null;

  setDevices: (d: CameraDeviceInfo[]) => void;
  setCamera: (id: string) => void;
  setMic: (id: string) => void;
  setResolution: (r: { label: string; width: number; height: number }) => void;
  setFps: (f: number) => void;
  setMirror: (m: boolean) => void;
  setEffect: (id: string) => void;
  setPerson: (p: PersonAsset | null) => void;
  addPerson: (p: PersonAsset) => void;
  removePerson: (id: string) => void;
  setBackground: (b: BackgroundDefinition | null) => void;
  addCustomBackground: (b: BackgroundDefinition) => void;
  removeCustomBackground: (id: string) => void;
  setVoiceEffect: (id: string) => void;
  setVoiceIntensity: (v: number) => void;
  setInputVolume: (v: number) => void;
  setOutputVolume: (v: number) => void;
  setNoiseSuppression: (v: boolean) => void;
  setEchoCancellation: (v: boolean) => void;
  setMonitor: (v: boolean) => void;
  setRunning: (r: boolean) => void;
  setStatus: (s: StudioState['status']) => void;
  setStats: (s: PerformanceStats) => void;
  setVcam: (v: VirtualCameraInfo | null) => void;
  setVmic: (v: VirtualMicInfo | null) => void;
  setApps: (a: AppDetection[]) => void;
  setSelectedApp: (name: string | null) => void;
  setCompareRaw: (v: boolean) => void;
  setFaceModelReady: (v: boolean) => void;
  setSegmentModelReady: (v: boolean) => void;
  setErrorMessage: (m: string | null) => void;
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      devices: [],
      videoDevices: [],
      audioDevices: [],
      selectedCamera: '',
      selectedMic: '',
      resolution: { label: '1280 × 720', width: 1280, height: 720 },
      fps: 30,
      mirror: true,
      effectId: 'none',
      person: null,
      people: [],
      background: null,
      customBackgrounds: [],
      voiceEffectId: 'none',
      voiceIntensity: 0.5,
      inputVolume: 1,
      outputVolume: 1,
      noiseSuppression: true,
      echoCancellation: false,
      monitor: true,
      running: false,
      status: 'idle',
      stats: null,
      vcam: null,
      vmic: null,
      apps: [],
      selectedApp: null,
      compareRaw: false,
      faceModelReady: false,
      segmentModelReady: false,
      errorMessage: null,

      setDevices: (devices) => {
        const video = devices.filter((d) => d.kind === 'videoinput');
        const audio = devices.filter((d) => d.kind === 'audioinput');
        const state = get();
        const selectedCamera =
          video.some((d) => d.deviceId === state.selectedCamera) ? state.selectedCamera : video[0]?.deviceId ?? '';
        const selectedMic =
          audio.some((d) => d.deviceId === state.selectedMic) ? state.selectedMic : audio[0]?.deviceId ?? '';
        set({ devices, videoDevices: video, audioDevices: audio, selectedCamera, selectedMic });
      },
      setCamera: (id) => set({ selectedCamera: id }),
      setMic: (id) => set({ selectedMic: id }),
      setResolution: (r) => set({ resolution: r }),
      setFps: (f) => set({ fps: FPS_OPTIONS.includes(f as (typeof FPS_OPTIONS)[number]) ? f : 30 }),
      setMirror: (m) => set({ mirror: m }),
      setEffect: (id) => set({ effectId: id }),
      setPerson: (p) => set({ person: p }),
      addPerson: (p) => set({ people: [p, ...get().people.filter((x) => x.id !== p.id)] }),
      removePerson: (id) => set({ people: get().people.filter((p) => p.id !== id) }),
      setBackground: (b) => set({ background: b }),
      addCustomBackground: (b) => set({ customBackgrounds: [b, ...get().customBackgrounds.filter((x) => x.id !== b.id)] }),
      removeCustomBackground: (id) => set({ customBackgrounds: get().customBackgrounds.filter((b) => b.id !== id) }),
      setVoiceEffect: (id) => set({ voiceEffectId: id }),
      setVoiceIntensity: (v) => set({ voiceIntensity: Math.max(0, Math.min(1, v)) }),
      setInputVolume: (v) => set({ inputVolume: v }),
      setOutputVolume: (v) => set({ outputVolume: v }),
      setNoiseSuppression: (v) => set({ noiseSuppression: v }),
      setEchoCancellation: (v) => set({ echoCancellation: v }),
      setMonitor: (v) => set({ monitor: v }),
      setRunning: (r) => set({ running: r }),
      setStatus: (s) => set({ status: s }),
      setStats: (s) => set({ stats: s }),
      setVcam: (v) => set({ vcam: v }),
      setVmic: (v) => set({ vmic: v }),
      setApps: (a) => set({ apps: a }),
      setSelectedApp: (name) => set({ selectedApp: name }),
      setCompareRaw: (v) => set({ compareRaw: v }),
      setFaceModelReady: (v) => set({ faceModelReady: v }),
      setSegmentModelReady: (v) => set({ segmentModelReady: v }),
      setErrorMessage: (m) => set({ errorMessage: m }),
    }),
    {
      name: 'veyra-studio',
      partialize: (s) => ({
        person: s.person && s.person.kind !== 'video' ? s.person : null,
        people: s.people.map((p) => (p.kind === 'video' ? { ...p, src: '', thumbnail: undefined } : p)),
        customBackgrounds: s.customBackgrounds.map((b) => (b.mode === 'video' ? { ...b, src: '' } : b)),
        selectedApp: s.selectedApp,
        effectId: s.effectId,
        voiceEffectId: s.voiceEffectId,
        voiceIntensity: s.voiceIntensity,
        inputVolume: s.inputVolume,
        outputVolume: s.outputVolume,
        noiseSuppression: s.noiseSuppression,
        echoCancellation: s.echoCancellation,
        monitor: s.monitor,
      }),
    },
  ),
);

export function backgroundById(id: string | null): BackgroundDefinition | null {
  if (!id) return null;
  return BUILTIN_BACKGROUNDS.find((b) => b.id === id) ?? null;
}
