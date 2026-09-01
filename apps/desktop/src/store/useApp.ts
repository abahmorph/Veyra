import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../lib/api';
import { api, setAuthToken } from '../lib/api';

export type QualityMode = 'auto' | 'high' | 'balanced' | 'performance';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

interface AppState {
  session: { token: string; user: User } | null;
  backendReachable: boolean | null;
  onboarded: boolean;
  qualityMode: QualityMode;
  devMode: boolean;
  toasts: Toast[];
  toastSeq: number;

  // auth
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;

  // app
  setOnboarded: (v: boolean) => void;
  setQualityMode: (m: QualityMode) => void;
  setDevMode: (v: boolean) => void;
  checkBackend: () => Promise<void>;
  toast: (kind: Toast['kind'], message: string) => void;
  dismissToast: (id: number) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      session: null,
      backendReachable: null,
      onboarded: false,
      qualityMode: 'auto',
      devMode: false,
      toasts: [],
      toastSeq: 0,

      login: async (email, password) => {
        const session = await api.auth.login(email, password);
        setAuthToken(session.token);
        set({ session });
      },
      signup: async (email, password, name) => {
        const session = await api.auth.signup(email, password, name);
        setAuthToken(session.token);
        set({ session });
      },
      logout: async () => {
        try {
          await api.auth.logout();
        } catch {
          /* offline logout is fine */
        }
        setAuthToken(null);
        set({ session: null });
      },
      refreshUser: async () => {
        const s = get().session;
        if (!s) return;
        try {
          const { user } = await api.user.me();
          set({ session: { ...s, user } });
        } catch (err) {
          if ((err as { status?: number }).status === 401) {
            setAuthToken(null);
            set({ session: null });
          }
        }
      },

      setOnboarded: (v) => set({ onboarded: v }),
      setQualityMode: (m) => set({ qualityMode: m }),
      setDevMode: (v) => set({ devMode: v }),
      checkBackend: async () => {
        const reachable = await import('../lib/api').then((m) => m.isBackendReachable());
        set({ backendReachable: reachable });
        if (reachable && get().session?.token) {
          try {
            await get().refreshUser();
          } catch {
            /* keep cached */
          }
        }
      },
      toast: (kind, message) => {
        const id = get().toastSeq + 1;
        set({ toastSeq: id, toasts: [...get().toasts, { id, kind, message }] });
        setTimeout(() => get().dismissToast(id), 5200);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    {
      name: 'veyra-app',
      partialize: (s) => ({
        session: s.session,
        onboarded: s.onboarded,
        qualityMode: s.qualityMode,
        devMode: s.devMode,
      }),
    },
  ),
);
