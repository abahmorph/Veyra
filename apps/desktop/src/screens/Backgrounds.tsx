import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { BUILTIN_BACKGROUNDS, getBackground, type BackgroundDefinition } from '@veyra/shared';
import { useStudio } from '../store/useStudio';
import { useApp } from '../store/useApp';
import { useEntitlement } from '../lib/entitlement';
import { buildBackgroundAssetFromFile } from '../lib/backgrounds';
import { Button, LockOverlay, PremiumBadge, SectionTitle, cx } from '../components/ui';

export function Backgrounds() {
  const { background, setBackground, customBackgrounds, addCustomBackground, removeCustomBackground } = useStudio();
  const { isLocked, consumePremium } = useEntitlement();
  const { toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const mode = background?.mode ?? 'none';
  const pickMode = (m: string) => {
    if (m === 'none') return setBackground(null);
    if (m === 'blur') return setBackground(getBackground('bg-clean'));
    if (m === 'remove') return setBackground(getBackground('bg-transparent'));
    if (m === 'replace') {
      const first = BUILTIN_BACKGROUNDS.find((b) => b.mode === 'gradient' || b.mode === 'image');
      if (first) void selectPremium(first);
    }
  };

  const select = (bg: BackgroundDefinition | null) => {
    setBackground(bg);
  };

  const selectPremium = async (bg: BackgroundDefinition) => {
    if (bg.premium) {
      const ok = await consumePremium();
      if (!ok) return;
    }
    setBackground(bg);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const bg = await buildBackgroundAssetFromFile(file);
      addCustomBackground(bg);
      setBackground(bg);
      toast('success', `Background "${bg.name}" added.`);
    } catch (err) {
      toast('warn', (err as Error).message);
    }
  };

  const onDelete = (bg: BackgroundDefinition) => {
    removeCustomBackground(bg.id);
    if (background?.id === bg.id) setBackground(null);
    toast('info', `Background "${bg.name}" removed.`);
  };

  const modes = ['none', 'blur', 'remove', 'replace'].map((m) => ({
    id: m,
    label: m === 'none' ? 'Original' : m[0]!.toUpperCase() + m.slice(1),
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto"
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Backgrounds</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Remove, blur or replace your background in real time. Everything is processed locally.
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,image/*,video/*" className="hidden" onChange={onUpload} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Upload background
          </Button>
        </div>
      </div>

      {/* Modes */}
      <div className="mb-7">
        <SectionTitle hint="Choose how the camera feed relates to the background.">Mode</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {modes.map((m) => {
            const active =
              m.id === 'none' ? mode === 'none' : m.id === 'replace' ? mode === 'image' || mode === 'gradient' || mode === 'video' : mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => pickMode(m.id)}
                className={cx(
                  'rounded-xl border px-3 py-3 text-sm font-medium transition-colors cursor-pointer',
                  active ? 'border-veyra bg-veyra/15 text-veyra shadow-[0_0_20px_-10px_rgba(20,241,149,0.6)]' : 'border-edge bg-panel/70 text-ink-dim hover:text-ink',
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Built-in */}
      <div className="mb-7">
        <SectionTitle>Built-in</SectionTitle>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
          {BUILTIN_BACKGROUNDS.map((bg, index) => {
            const active = background?.id === bg.id;
            const locked = bg.premium && isLocked('cyberpunk');
            return (
              <motion.button
                key={bg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => void selectPremium(bg)}
                className={cx(
                  'group relative overflow-hidden rounded-2xl border text-left transition-all cursor-pointer',
                  active ? 'border-veyra shadow-[0_0_30px_-10px_rgba(20,241,149,0.5)]' : 'border-edge hover:border-edge2',
                )}
              >
                <BackgroundThumb bg={bg} />
                <div className="relative flex items-center justify-between bg-panel/90 px-3 py-2.5">
                  <span className="font-display text-sm font-semibold text-ink">{bg.name}</span>
                  {bg.premium ? <PremiumBadge /> : null}
                </div>
                {active ? (
                  <span className="absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-veyra text-[11px] font-bold text-[#05241a]">✓</span>
                ) : null}
                {locked ? (
                  <LockOverlay onClick={() => void selectPremium(bg)} description="Premium background — unlock to use." />
                ) : null}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Custom gallery */}
      <div className="mb-7">
        <div className="flex items-center justify-between">
          <SectionTitle>Your backgrounds</SectionTitle>
          <button onClick={() => fileRef.current?.click()} className="mb-3 flex items-center gap-1.5 text-xs text-cyan hover:underline cursor-pointer">
            <Upload size={12} /> Upload more
          </button>
        </div>
        {customBackgrounds.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-edge2 py-10 text-ink-faint transition-colors hover:border-veyra/50 hover:text-ink cursor-pointer"
          >
            <ImagePlus size={26} />
            <span className="text-xs">Add your own</span>
            <span className="text-[10px] text-ink-faint">JPG · PNG · WEBP · MP4 — stored locally</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {customBackgrounds.map((bg, index) => {
              const active = background?.id === bg.id;
              return (
                <motion.div
                  key={bg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cx(
                    'group relative overflow-hidden rounded-2xl border text-left transition-all',
                    active ? 'border-veyra shadow-[0_0_30px_-10px_rgba(20,241,149,0.5)]' : 'border-edge hover:border-edge2',
                  )}
                >
                  <button onClick={() => select(bg)} className="w-full cursor-pointer">
                    <BackgroundThumb bg={bg} />
                    <div className="relative flex items-center justify-between bg-panel/90 px-3 py-2.5">
                      <span className="truncate font-display text-sm font-semibold text-ink">{bg.name}</span>
                      {bg.mode === 'video' ? <span className="text-[10px] text-ink-faint">video</span> : null}
                    </div>
                  </button>
                  {active ? (
                    <span className="absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-veyra text-[11px] font-bold text-[#05241a]">✓</span>
                  ) : null}
                  <button
                    onClick={() => onDelete(bg)}
                    title="Remove background"
                    className="absolute right-2 top-9 z-20 flex h-6 w-6 items-center justify-center rounded-lg border border-edge bg-black/60 text-ink-faint opacity-0 backdrop-blur transition-opacity hover:text-danger group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-edge bg-panel/80 p-4">
        <SectionTitle hint="Transparent backgrounds and green screen feed directly into compositing. Chroma-keyed output is emitted when Green Screen mode is active so downstream apps can key it.">
          Green screen mode
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={background?.mode === 'green' ? 'primary' : 'outline'}
            onClick={() => select({ id: 'bg-green', name: 'Green Screen', mode: 'green', premium: false, kind: 'builtin' })}
          >
            Enable Green Screen
          </Button>
          {background?.mode === 'green' ? (
            <Button variant="ghost" onClick={() => select(null)}>Disable</Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-dim">
          Upload only backgrounds you own or have rights to use. Media is stored locally on your device and never uploaded.
        </p>
      </div>
    </motion.div>
  );
}

function BackgroundThumb({ bg }: { bg: BackgroundDefinition }) {
  const g = bg.gradient ?? [
    { offset: 0, color: '#0d0d17' },
    { offset: 1, color: '#1a1a2e' },
  ];
  return (
    <div className="aspect-video w-full">
      {bg.src ? (
        <img src={bg.src} alt={bg.name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${g[0]?.color ?? '#000'}, ${g[1]?.color ?? '#000'})` }} />
      )}
      {bg.mode === 'blur' ? (
        <div className="flex h-full w-full items-center justify-center bg-black/30 text-xs text-white/70">Blur</div>
      ) : null}
      {bg.mode === 'remove' ? (
        <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,#111,#111_10px,#1a1a1a_10px,#1a1a1a_20px)] text-xs text-white/70">Transparent</div>
      ) : null}
      {bg.mode === 'green' ? (
        <div className="flex h-full w-full items-center justify-center bg-[#00b140] text-xs text-white/70">Green Screen</div>
      ) : null}
      {bg.mode === 'video' && !bg.src ? (
        <div className="flex h-full w-full items-center justify-center bg-black text-xs text-white/70">Video (session)</div>
      ) : null}
    </div>
  );
}
