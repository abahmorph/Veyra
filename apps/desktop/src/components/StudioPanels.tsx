import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AppWindow,
  AudioLines,
  ImageIcon,
  Sparkles,
  User,
  Wand2,
  X,
  Check,
  CircleHelp,
} from 'lucide-react';
import { EFFECTS, VOICE_EFFECTS, BUILTIN_BACKGROUNDS, getBackground } from '@veyra/shared';
import { useStudio } from '../store/useStudio';
import { useNav } from '../store/useNav';
import { useEntitlement } from '../lib/entitlement';
import { appStatus } from '../lib/apps';
import { PersonLibrary } from './PersonLibrary';
import { Badge, Select, Slider, Toggle, cx } from './ui';

export type StudioPanelId = 'person' | 'effect' | 'background' | 'voice' | 'app';

const CONTROLS: { id: StudioPanelId; label: string; icon: typeof User }[] = [
  { id: 'person', label: 'Person', icon: User },
  { id: 'effect', label: 'Effect', icon: Wand2 },
  { id: 'background', label: 'Background', icon: ImageIcon },
  { id: 'voice', label: 'Voice', icon: AudioLines },
  { id: 'app', label: 'App', icon: AppWindow },
];

export function StudioControlBar({
  active,
  onOpen,
}: {
  active: StudioPanelId | null;
  onOpen: (id: StudioPanelId | null) => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center">
      <div className="nav-glass flex items-center gap-1 rounded-full px-2 py-1.5">
        {CONTROLS.map((c) => {
          const Icon = c.icon;
          const isActive = active === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(isActive ? null : c.id)}
              className={cx(
                'relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs transition-colors cursor-pointer',
                isActive ? 'text-veyra' : 'text-ink-dim hover:text-ink',
              )}
            >
              {isActive ? (
                <motion.div
                  layoutId="control-capsule"
                  className="absolute inset-0 rounded-full bg-veyra/15 border border-veyra/30"
                  style={{ boxShadow: '0 0 20px rgba(20,241,149,0.25)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              ) : null}
              <Icon size={15} className="relative z-10" />
              <span className="relative z-10 font-medium">{c.label}</span>
              {hasActiveDot(c.id) ? <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-veyra animate-pulse" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function hasActiveDot(id: StudioPanelId): boolean {
  const s = useStudio.getState();
  switch (id) {
    case 'person': return s.person !== null;
    case 'effect': return s.effectId !== 'none';
    case 'background': return s.background !== null;
    case 'voice': return s.voiceEffectId !== 'none';
    case 'app': return s.selectedApp !== null;
    default: return false;
  }
}

export function StudioPanel({ id, onClose }: { id: StudioPanelId; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <motion.aside
        initial={{ x: '110%' }}
        animate={{ x: 0 }}
        exit={{ x: '110%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="fixed inset-y-0 right-0 z-40 flex w-[380px] flex-col glass-strong border-l border-edge2"
      >
        <div className="flex items-center justify-between border-b border-edge px-5 py-4">
          <span className="font-display text-sm font-semibold text-ink">{PANEL_TITLES[id]}</span>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge text-ink-faint hover:text-ink cursor-pointer">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <PanelContent id={id} />
        </div>
      </motion.aside>
    </>
  );
}

const PANEL_TITLES: Record<StudioPanelId, string> = {
  person: 'Person & Character',
  effect: 'Face Effects',
  background: 'Background',
  voice: 'Voice',
  app: 'Video Call App',
};

function PanelContent({ id }: { id: StudioPanelId }) {
  const { setScreen } = useNav();
  switch (id) {
    case 'person': return <PersonLibrary compact />;
    case 'effect': return <EffectPanel onOpenLibrary={() => setScreen('effects')} />;
    case 'background': return <BackgroundPanel onOpenLibrary={() => setScreen('backgrounds')} />;
    case 'voice': return <VoicePanel onOpenLibrary={() => setScreen('voice')} />;
    case 'app': return <AppPanel onOpenLibrary={() => setScreen('apps')} />;
  }
}

function EffectPanel({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const { effectId } = useStudio();
  const { activate, isLocked } = useEntitlement();
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-dim">Face effects apply in real time on your camera feed.</p>
      <div className="flex flex-wrap gap-1.5">
        {EFFECTS.filter((e) => e.id !== 'none').map((e) => {
          const active = effectId === e.id;
          const locked = isLocked(e.id);
          return (
            <button
              key={e.id}
              onClick={() => void activate(e.id)}
              className={cx(
                'rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer',
                active ? 'border-veyra bg-veyra/15 text-veyra' : 'border-edge2 text-ink-dim hover:text-ink',
                locked && 'opacity-60',
              )}
            >
              {e.name}
              {locked ? ' 🔒' : ''}
            </button>
          );
        })}
      </div>
      <button onClick={onOpenLibrary} className="text-xs text-cyan hover:underline cursor-pointer">Open full Effects library →</button>
    </div>
  );
}

function BackgroundPanel({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const { background, setBackground } = useStudio();
  const { consumePremium } = useEntitlement();

  const mode = background?.mode ?? 'none';
  const pickMode = (m: string) => {
    if (m === 'none') return setBackground(null);
    if (m === 'blur') return setBackground(getBackground('bg-clean'));
    if (m === 'remove') return setBackground(getBackground('bg-transparent'));
    if (m === 'replace') {
      const first = BUILTIN_BACKGROUNDS.find((b) => b.mode === 'gradient' || b.mode === 'image');
      if (first) void selectBg(first);
    }
  };

  const selectBg = async (bg: (typeof BUILTIN_BACKGROUNDS)[number]) => {
    if (bg.premium) {
      const ok = await consumePremium();
      if (!ok) return;
    }
    setBackground(bg);
  };

  const modes = ['none', 'blur', 'remove', 'replace'].map((m) => ({
    id: m,
    label: m === 'none' ? 'Original' : m[0]!.toUpperCase() + m.slice(1),
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wider text-ink-faint">Background mode</p>
        <div className="grid grid-cols-4 gap-1.5">
          {modes.map((m) => {
            const active = m.id === 'none' ? mode === 'none' : m.id === 'replace' ? mode === 'image' || mode === 'gradient' || mode === 'video' : mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => pickMode(m.id)}
                className={cx(
                  'rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors cursor-pointer',
                  active ? 'border-veyra bg-veyra/15 text-veyra' : 'border-edge text-ink-dim hover:text-ink',
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wider text-ink-faint">Built-in backgrounds</p>
        <div className="grid grid-cols-2 gap-2">
          {BUILTIN_BACKGROUNDS.map((bg) => {
            const active = background?.id === bg.id;
            return (
              <button
                key={bg.id}
                onClick={() => void selectBg(bg)}
                className={cx(
                  'overflow-hidden rounded-xl border text-left transition-all cursor-pointer',
                  active ? 'border-veyra shadow-[0_0_20px_-8px_rgba(20,241,149,0.6)]' : 'border-edge hover:border-edge2',
                )}
              >
                <div className="aspect-video w-full bg-[#0a0a14]">
                  <BackgroundSwatch bg={bg} />
                </div>
                <div className="flex items-center justify-between bg-panel2/80 px-2 py-1.5">
                  <span className="truncate text-[11px] font-medium text-ink">{bg.name}</span>
                  {bg.premium ? <Sparkles size={10} className="text-accent" /> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <button onClick={onOpenLibrary} className="text-xs text-cyan hover:underline cursor-pointer">Open full Backgrounds library →</button>
    </div>
  );
}

function BackgroundSwatch({ bg }: { bg: (typeof BUILTIN_BACKGROUNDS)[number] }) {
  if (bg.src) return <img src={bg.src} alt={bg.name} className="h-full w-full object-cover" />;
  const g = bg.gradient ?? [{ offset: 0, color: '#1a1a2e' }, { offset: 1, color: '#0d0d17' }];
  if (bg.mode === 'blur') return <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,#334,#0a0a12)]" />;
  if (bg.mode === 'remove') return <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#222,#222_8px,#2c2c2c_8px,#2c2c2c_16px)]" />;
  if (bg.mode === 'green') return <div className="h-full w-full bg-[#00b140]" />;
  return <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${g[0]?.color ?? '#000'}, ${g[1]?.color ?? '#000'})` }} />;
}

function VoicePanel({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const {
    audioDevices,
    selectedMic,
    setMic,
    voiceEffectId,
    setVoiceEffect,
    voiceIntensity,
    setVoiceIntensity,
    inputVolume,
    setInputVolume,
    outputVolume,
    setOutputVolume,
    noiseSuppression,
    setNoiseSuppression,
    echoCancellation,
    setEchoCancellation,
    monitor,
    setMonitor,
  } = useStudio();
  const { consumePremium } = useEntitlement();

  const pickEffect = async (id: string) => {
    const effect = VOICE_EFFECTS.find((v) => v.id === id);
    if (!effect) return;
    if (effect.premium) {
      const ok = await consumePremium();
      if (!ok) return;
    }
    setVoiceEffect(id);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-faint">Microphone</p>
        <Select className="w-full" value={selectedMic} onChange={(e) => setMic(e.target.value)}>
          {audioDevices.length === 0 ? <option value="">No microphones found</option> : null}
          {audioDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wider text-ink-faint">Voice effects</p>
        <div className="flex flex-wrap gap-1.5">
          {VOICE_EFFECTS.filter((v) => v.id !== 'none').map((v) => {
            const active = voiceEffectId === v.id;
            return (
              <button
                key={v.id}
                onClick={() => void pickEffect(v.id)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer',
                  active ? 'border-veyra bg-veyra/15 text-veyra' : 'border-edge2 text-ink-dim hover:text-ink',
                )}
              >
                {v.name}
                {v.premium ? ' 🔒' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2.5 rounded-xl border border-edge bg-panel2/50 p-3">
        <Slider label="Intensity" value={voiceIntensity} onChange={setVoiceIntensity} />
        <Slider label="Input" value={inputVolume} onChange={setInputVolume} />
        <Slider label="Output" value={outputVolume} onChange={setOutputVolume} />
        <div className="space-y-1 pt-1">
          <Toggle checked={noiseSuppression} onChange={setNoiseSuppression} label="Noise suppression" />
          <Toggle checked={echoCancellation} onChange={setEchoCancellation} label="Echo cancellation" />
          <Toggle checked={monitor} onChange={setMonitor} label="Monitor (hear yourself)" />
        </div>
      </div>
      <button onClick={onOpenLibrary} className="text-xs text-cyan hover:underline cursor-pointer">Open full Voice studio →</button>
    </div>
  );
}

function AppPanel({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const { apps, vcam, selectedApp, setSelectedApp } = useStudio();
  const selected = apps.find((a) => a.name === selectedApp);

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-dim">Where do you want to use Veyra? Pick an app to see how to connect.</p>
      <div className="space-y-2">
        {apps.map((app) => {
          const active = selectedApp === app.name;
          const status = appStatus(app.running, vcam?.status);
          return (
            <button
              key={app.name}
              onClick={() => setSelectedApp(app.name)}
              className={cx(
                'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer',
                active ? 'border-veyra bg-veyra/5' : 'border-edge bg-panel2/50 hover:border-edge2',
              )}
            >
              <span className="text-sm font-medium text-ink">{app.name}</span>
              <span className="flex items-center gap-2">
                <Badge tone={status.tone}>{status.label}</Badge>
                {active ? <Check size={14} className="text-veyra" /> : null}
              </span>
            </button>
          );
        })}
        {apps.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-panel2/50 p-3 text-xs text-ink-dim">
            <CircleHelp size={14} /> No call apps detected. Open the Apps screen for details.
          </div>
        ) : null}
      </div>
      {selected ? (
        <div className="rounded-xl border border-edge bg-panel2/50 p-3 text-xs leading-relaxed text-ink-dim">
          <div className="mb-1 font-semibold text-ink">Connect {selected.name}</div>
          <ol className="list-inside list-decimal space-y-1">
            <li>Open {selected.name}.</li>
            <li>Open its video settings.</li>
            <li>Select <code className="text-veyra">Veyra Camera</code> as your camera.</li>
            <li>Optionally select <code className="text-veyra">Veyra Microphone</code> for your processed voice.</li>
          </ol>
        </div>
      ) : null}
      <button onClick={onOpenLibrary} className="text-xs text-cyan hover:underline cursor-pointer">Open full Apps screen →</button>
    </div>
  );
}
