import { create } from 'zustand';

export type Screen =
  | 'studio'
  | 'effects'
  | 'backgrounds'
  | 'voice'
  | 'presets'
  | 'apps'
  | 'premium'
  | 'settings'
  | 'dev'
  | 'onboarding';

interface NavState {
  screen: Screen;
  pending: Screen | null;
  setScreen: (s: Screen) => void;
  goPremium: () => void;
}

export const useNav = create<NavState>()((set) => ({
  screen: 'studio',
  pending: null,
  setScreen: (s) => set({ screen: s }),
  goPremium: () => set({ screen: 'premium' }),
}));
