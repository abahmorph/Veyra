import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AmbientBackground from './components/AmbientBackground';
import PageTransition from './components/PageTransition';
import BottomNav from './components/BottomNav';
import SplashScreen from './components/SplashScreen';
import { PipelineSync } from './components/PipelineSync';
import { Toasts } from './components/Toasts';
import { Studio } from './screens/Studio';
import { Effects } from './screens/Effects';
import { Backgrounds } from './screens/Backgrounds';
import { Voice } from './screens/Voice';
import { Premium } from './screens/Premium';
import { Presets } from './screens/Presets';
import { Apps } from './screens/Apps';
import { Settings } from './screens/Settings';
import { useNav } from './store/useNav';
import { useApp } from './store/useApp';
import { AuthPanel } from './components/AuthPanel';

const screens: Record<string, ComponentType> = {
  studio: Studio,
  effects: Effects,
  backgrounds: Backgrounds,
  voice: Voice,
  premium: Premium,
  presets: Presets,
  apps: Apps,
  settings: Settings,
};

export default function App() {
  const { screen, setScreen } = useNav();
  const { session, devMode, setDevMode } = useApp();
  const [authOpen, setAuthOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const ActiveScreen = screens[screen] || Studio;

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void">
      <PipelineSync />
      <Toasts />
      <AnimatePresence mode="wait">
        {!booted ? (
          <SplashScreen key="splash" />
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, scale: 0.995 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative z-10 flex flex-col h-full"
          >
            <AmbientBackground />
        <header className="flex h-13 items-center justify-between border-b border-edge px-7 bg-void/80 backdrop-blur-sm z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-veyra to-cyan text-[#05241a] font-display font-bold text-lg">
                V
              </div>
              <div>
                <div className="font-display text-lg font-bold tracking-tight text-ink">Veyra</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">AI Video Studio</div>
              </div>
            </div>
            <div className="glass-panel-sm rounded-full px-3.5 py-1.5 flex items-center gap-2">
              <span className="text-xs text-ink-dim font-medium">Veyra AI</span>
              <div className="w-2 h-2 rounded-full bg-veyra animate-pulse-glow" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDevMode(!devMode)}
              className="rounded-lg border border-edge px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink-faint hover:text-ink cursor-pointer transition-colors"
            >
              {devMode ? 'Dev: On' : 'Dev: Off'}
            </button>
            <button
              onClick={() => setScreen('premium')}
              className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-[#b9a7ff] hover:bg-accent/20 cursor-pointer transition-colors"
            >
              Unlock Premium
            </button>
            {session ? (
              <div className="flex items-center gap-2 rounded-xl bg-panel2/70 border border-edge px-3 py-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-accent to-pink text-[10px] font-bold text-white">
                  {session.user.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="text-xs text-ink">{session.user.name}</span>
                <span className="text-[10px] text-ink-faint">{session.user.subscription.tier === 'premium' ? 'PRO' : 'Free'}</span>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-edge2 py-2 text-sm text-ink-dim hover:text-ink cursor-pointer transition-colors px-3"
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        <PageTransition pageKey={screen}>
          <ActiveScreen />
        </PageTransition>

        <BottomNav activeTab={screen} onTabChange={setScreen} />
          </motion.div>
        )}
      </AnimatePresence>

      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAuthOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[420px]">
            <AuthPanel onClose={() => setAuthOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
