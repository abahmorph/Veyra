import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScenePreset } from '@veyra/shared';
import { DEFAULT_PRESETS } from '@veyra/shared';

interface PresetsState {
  presets: ScenePreset[];
  add: (p: ScenePreset) => void;
  update: (id: string, patch: Partial<ScenePreset>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => string | null;
}

export const usePresets = create<PresetsState>()(
  persist(
    (set, get) => ({
      presets: DEFAULT_PRESETS,
      add: (p) => set({ presets: [p, ...get().presets] }),
      update: (id, patch) =>
        set({ presets: get().presets.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
      remove: (id) => set({ presets: get().presets.filter((p) => p.id !== id) }),
      duplicate: (id) => {
        const src = get().presets.find((p) => p.id === id);
        if (!src) return null;
        const copy: ScenePreset = {
          ...src,
          id: `preset-${Date.now()}`,
          name: `${src.name} Copy`,
          createdAt: Date.now(),
        };
        set({ presets: [copy, ...get().presets] });
        return copy.id;
      },
    }),
    { name: 'veyra-presets' },
  ),
);
