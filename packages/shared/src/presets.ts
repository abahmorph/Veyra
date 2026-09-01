import type { BackgroundDefinition, PersonAsset, ScenePreset, VoiceEffectDefinition } from './types.js';

export const BUILTIN_BACKGROUNDS: BackgroundDefinition[] = [
  {
    id: 'bg-clean',
    name: 'Clean Blur',
    mode: 'blur',
    premium: false,
    kind: 'builtin',
    blurStrength: 0.55,
  },
  {
    id: 'bg-heavy-blur',
    name: 'Heavy Blur',
    mode: 'blur',
    premium: false,
    kind: 'builtin',
    blurStrength: 0.85,
  },
  {
    id: 'bg-transparent',
    name: 'Remove Background',
    mode: 'remove',
    premium: false,
    kind: 'builtin',
  },
  {
    id: 'bg-studio',
    name: 'Studio',
    mode: 'gradient',
    premium: false,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#0d0d17' },
      { offset: 0.55, color: '#221a3a' },
      { offset: 1, color: '#18e0ff' },
    ],
  },
  {
    id: 'bg-office',
    name: 'Office',
    mode: 'gradient',
    premium: false,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#10141f' },
      { offset: 1, color: '#3c5a7d' },
    ],
  },
  {
    id: 'bg-gaming',
    name: 'Gaming Room',
    mode: 'gradient',
    premium: true,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#12031f' },
      { offset: 0.5, color: '#ff2e88' },
      { offset: 1, color: '#0a1128' },
    ],
  },
  {
    id: 'bg-luxury',
    name: 'Luxury Room',
    mode: 'gradient',
    premium: true,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#1a1508' },
      { offset: 0.55, color: '#6b5215' },
      { offset: 1, color: '#0d0d17' },
    ],
  },
  {
    id: 'bg-city',
    name: 'City',
    mode: 'gradient',
    premium: true,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#050a1c' },
      { offset: 0.6, color: '#0e2a5c' },
      { offset: 1, color: '#18e0ff' },
    ],
  },
  {
    id: 'bg-nature',
    name: 'Nature',
    mode: 'gradient',
    premium: true,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#07170e' },
      { offset: 0.55, color: '#14532d' },
      { offset: 1, color: '#7dd3a8' },
    ],
  },
  {
    id: 'bg-futuristic',
    name: 'Futuristic',
    mode: 'gradient',
    premium: true,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#0a0318' },
      { offset: 0.5, color: '#4c1d95' },
      { offset: 1, color: '#18e0ff' },
    ],
  },
  {
    id: 'bg-neon-gradient',
    name: 'Neon Gradient',
    mode: 'gradient',
    premium: false,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#0f0524' },
      { offset: 0.5, color: '#3b0a6e' },
      { offset: 1, color: '#0ff0c0' },
    ],
  },
  {
    id: 'bg-sunset',
    name: 'Sunset Gradient',
    mode: 'gradient',
    premium: false,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#1a0b2e' },
      { offset: 0.55, color: '#c2457a' },
      { offset: 1, color: '#f9a03f' },
    ],
  },
  {
    id: 'bg-aurora',
    name: 'Aurora Gradient',
    mode: 'gradient',
    premium: true,
    kind: 'builtin',
    gradient: [
      { offset: 0, color: '#062f2f' },
      { offset: 0.5, color: '#0d7377' },
      { offset: 1, color: '#14f195' },
    ],
  },
  {
    id: 'bg-night-city',
    name: 'Night City',
    mode: 'image',
    premium: true,
    kind: 'builtin',
    src: 'backgrounds/night-city.jpg',
  },
  {
    id: 'bg-space',
    name: 'Deep Space',
    mode: 'image',
    premium: true,
    kind: 'builtin',
    src: 'backgrounds/space.jpg',
  },
  {
    id: 'bg-green',
    name: 'Green Screen',
    mode: 'green',
    premium: false,
    kind: 'builtin',
  },
];

/** Selectable characters / avatars (driven by live face tracking). */
export const BUILTIN_CHARACTERS: PersonAsset[] = [
  {
    id: 'char-veyra-avatar',
    name: 'Veyra Avatar',
    kind: 'character',
    src: 'avatar',
    premium: true,
    source: 'builtin',
    transformAvailable: true,
    transformReason: 'Synthetic character driven by live face tracking.',
  },
];

export const VOICE_EFFECTS: VoiceEffectDefinition[] = [
  {
    id: 'none',
    name: 'None',
    description: 'Clean microphone audio.',
    premium: false,
    chain: 'none',
    intensityRange: [0, 1],
  },
  {
    id: 'deep',
    name: 'Deep',
    description: 'Lower pitch for a commanding voice.',
    premium: false,
    chain: 'pitch',
    intensityRange: [-1, 0],
  },
  {
    id: 'high',
    name: 'High',
    description: 'Raise your pitch, playful and bright.',
    premium: true,
    chain: 'pitch',
    intensityRange: [0, 1],
  },
  {
    id: 'robot',
    name: 'Robot',
    description: 'Metallic, synthetic machine voice.',
    premium: true,
    chain: 'robot',
    intensityRange: [0, 1],
  },
  {
    id: 'radio',
    name: 'Radio',
    description: 'AM-radio lo-fi broadcast character.',
    premium: true,
    chain: 'radio',
    intensityRange: [0, 1],
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Ambient hall echo.',
    premium: false,
    chain: 'echo',
    intensityRange: [0, 1],
  },
  {
    id: 'alien',
    name: 'Alien',
    description: 'Pitched, flanged, otherworldly.',
    premium: true,
    chain: 'alien',
    intensityRange: [0, 1],
  },
  {
    id: 'modulation',
    name: 'Modulator',
    description: 'Living voice modulation.',
    premium: true,
    chain: 'robot',
    intensityRange: [0, 1],
  },
];

export function getBackground(id: string | null | undefined): BackgroundDefinition | null {
  if (!id) return null;
  return BUILTIN_BACKGROUNDS.find((b) => b.id === id) ?? null;
}

export function getVoiceEffect(id: string | null | undefined): VoiceEffectDefinition | null {
  if (!id) return null;
  return VOICE_EFFECTS.find((v) => v.id === id) ?? null;
}

export const DEFAULT_PRESETS: ScenePreset[] = [
  {
    id: 'preset-cyber',
    name: 'Cyber Mode',
    effectId: 'cyberpunk',
    person: null,
    background: getBackground('bg-neon-gradient'),
    voiceEffectId: 'robot',
    voiceIntensity: 0.6,
    premium: true,
    createdAt: 0,
  },
  {
    id: 'preset-clean',
    name: 'Clean Meeting',
    effectId: 'beauty',
    person: null,
    background: getBackground('bg-clean'),
    voiceEffectId: 'none',
    voiceIntensity: 0,
    premium: false,
    createdAt: 0,
  },
  {
    id: 'preset-anime',
    name: 'Anime Streamer',
    effectId: 'anime',
    person: null,
    background: getBackground('bg-night-city'),
    voiceEffectId: 'alien',
    voiceIntensity: 0.4,
    premium: true,
    createdAt: 0,
  },
  {
    id: 'preset-private',
    name: 'Private',
    effectId: 'privacy-blur',
    person: null,
    background: getBackground('bg-heavy-blur'),
    voiceEffectId: 'none',
    voiceIntensity: 0,
    premium: false,
    createdAt: 0,
  },
];

export const RESOLUTIONS = [
  { label: '640 × 480', width: 640, height: 480 },
  { label: '848 × 480', width: 848, height: 480 },
  { label: '1280 × 720', width: 1280, height: 720 },
] as const;

export const FPS_OPTIONS = [15, 24, 30, 60] as const;
