import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useNav } from '../store/useNav';
import { useApp } from '../store/useApp';
import { AuthPanel } from './AuthPanel';
import { Badge } from './ui';

export function TopBar() {
  const { setScreen } = useNav();
  const { session, devMode, setDevMode } = useApp();
  const [authOpen, setAuthOpen] = useState(false);
  const isPremium = session?.user.subscription.tier === 'premium';

  return (
    <>
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
          <button onClick={() => setScreen('premium')} className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-[#b9a7ff] hover:bg-accent/20 cursor-pointer transition-colors">
            Unlock Premium
          </button>
          {session ? (
            <div className="flex items-center gap-2 rounded-xl bg-panel2/70 border border-edge px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-accent to-pink text-[10px] font-bold text-white">
                {session.user.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <span className="text-xs text-ink">{session.user.name}</span>
              <Badge tone={isPremium ? 'purple' : 'neutral'}>{isPremium ? 'PRO' : 'Free'}</Badge>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-edge2 py-2 text-sm text-ink-dim hover:text-ink cursor-pointer transition-colors px-3"
            >
              <LogIn size={15} /> Sign in
            </button>
          )}
        </div>
      </header>
      {authOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAuthOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[420px]">
            <AuthPanel onClose={() => setAuthOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
