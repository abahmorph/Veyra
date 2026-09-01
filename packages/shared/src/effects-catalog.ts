import type { EffectDefinition } from './types.js';

/**
 * The effects catalog. Entitlement (free/premium) is enforced server-side,
 * this list only drives the UI and the engine. IDs must match the engine
 * effect registry keys where applicable.
 */
export const EFFECTS: EffectDefinition[] = [
  {
    id: 'none',
    name: 'None',
    category: 'face',
    description: 'Pass raw camera feed through untouched.',
    premium: false,
    cost: 'low',
    kind: 'shader',
    preview: 'Raw feed',
  },
  {
    id: 'beauty',
    name: 'Beauty',
    category: 'face',
    description: 'Subtle skin smoothing and tone enhancement.',
    premium: false,
    cost: 'medium',
    kind: 'shader',
    preview: 'Polished',
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    category: 'face',
    description: 'Flat-shaded cartoon look with bold edges.',
    premium: true,
    cost: 'medium',
    kind: 'shader',
    preview: 'Toon',
  },
  {
    id: 'anime',
    name: 'Anime Inspired',
    category: 'face',
    description: 'Anime-inspired cel shading with vibrant highlights.',
    premium: true,
    cost: 'medium',
    kind: 'shader',
    preview: 'Cel-shaded',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    category: 'face',
    description: 'Neon-drenched color grade with scanlines.',
    premium: true,
    cost: 'low',
    kind: 'shader',
    preview: 'Neon',
  },
  {
    id: 'robot',
    name: 'Robot',
    category: 'face',
    description: 'Metallic faceplate with glowing eyes and grid.',
    premium: true,
    cost: 'high',
    kind: 'face-mask',
    requiresFace: true,
    preview: 'Cyborg',
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    category: 'face',
    description: 'Soft ethereal glow with fairy-light color grade.',
    premium: true,
    cost: 'low',
    kind: 'shader',
    preview: 'Fae',
  },
  {
    id: 'horror',
    name: 'Horror',
    category: 'face',
    description: 'Cold, desaturated look with flicker and vignette.',
    premium: true,
    cost: 'low',
    kind: 'shader',
    preview: 'Dread',
  },
  {
    id: 'pixel',
    name: 'Pixel',
    category: 'face',
    description: 'Downsampled retro pixel aesthetic.',
    premium: true,
    cost: 'low',
    kind: 'pixel',
    preview: '8-bit',
  },
  {
    id: 'glitch',
    name: 'Glitch',
    category: 'face',
    description: 'Chromatic-aberration glitch distortion.',
    premium: true,
    cost: 'medium',
    kind: 'glitch',
    preview: 'Corrupt',
  },
  {
    id: 'avatar',
    name: 'Veyra Avatar',
    category: 'character',
    description: 'A synthetic character driven by your face tracking.',
    premium: true,
    cost: 'medium',
    kind: 'avatar',
    requiresFace: true,
    preview: 'Character',
  },
  {
    id: 'privacy-blur',
    name: 'Privacy Blur',
    category: 'privacy',
    description: 'Blur your face for privacy — nobody sees who you are.',
    premium: false,
    cost: 'medium',
    kind: 'privacy-blur',
    requiresFace: true,
    preview: 'Private',
  },
  {
    id: 'face-replace',
    name: 'Face Swap (consented assets)',
    category: 'face',
    description: 'Swap your face using an image you have permission to use.',
    premium: true,
    cost: 'high',
    kind: 'face-replace',
    requiresFace: true,
    preview: 'Swap',
  },
];

export const FREE_EFFECT_ID = 'beauty';

export function getEffect(id: string | null | undefined): EffectDefinition | null {
  if (!id) return null;
  return EFFECTS.find((e) => e.id === id) ?? null;
}

export function isPremiumEffect(id: string | null): boolean {
  const effect = getEffect(id);
  return effect?.premium ?? false;
}

export function effectsByCategory(category: EffectDefinition['category']): EffectDefinition[] {
  return EFFECTS.filter((e) => e.category === category);
}
