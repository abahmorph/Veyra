import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import { EFFECTS, type EffectDefinition } from '@veyra/shared';
import { useStudio } from '../store/useStudio';
import { useEntitlement } from '../lib/entitlement';
import { PersonLibrary } from '../components/PersonLibrary';
import { Badge, LockOverlay, PremiumBadge, SectionTitle, cx } from '../components/ui';

const CATEGORIES: { id: EffectDefinition['category'] | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'face', label: 'Face' },
  { id: 'character', label: 'Character' },
  { id: 'privacy', label: 'Privacy' },
];

const CATEGORY_LABEL: Record<string, string> = {
  face: 'Face Effects',
  character: 'Character Effects',
  privacy: 'Privacy',
};

export function Effects() {
  const { effectId } = useStudio();
  const { isLocked, activate, premium, creditsRemaining } = useEntitlement();
  const [category, setCategory] = useState<'all' | EffectDefinition['category']>('all');

  const items = EFFECTS.filter((e) => e.id !== 'none' && (category === 'all' || e.category === category));
  const groups = [...new Set(items.map((e) => e.category))];

  const select = async (effect: EffectDefinition) => {
    await activate(effect.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto"
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Effects</h1>
          <p className="mt-1 text-sm text-ink-dim">
            {premium
              ? 'All premium effects unlocked.'
              : `${creditsRemaining} free premium effect${creditsRemaining === 1 ? '' : 's'} remaining. Activate one to try it.`}
          </p>
        </div>
        <div className="flex gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id as typeof category)}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-xs transition-colors cursor-pointer',
                category === c.id ? 'border-veyra bg-veyra/15 text-veyra' : 'border-edge2 text-ink-dim hover:text-ink',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-7">
        <SectionTitle hint="Upload a photo or video of someone you have rights to use, or pick a built-in character. Character and face-swap effects drive live from this.">
          Person & Character
        </SectionTitle>
        <PersonLibrary />
      </div>

      {groups.map((g, groupIndex) => (
        <div key={g} className="mb-7">
          <SectionTitle>{CATEGORY_LABEL[g] ?? g}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {items
              .filter((e) => e.category === g)
              .map((effect, index) => {
                const active = effectId === effect.id;
                const locked = isLocked(effect.id);
                return (
                  <motion.button
                    key={effect.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 + groupIndex * 0.1 }}
                    onClick={() => void select(effect)}
                    className={cx(
                      'group relative overflow-hidden rounded-2xl border text-left transition-all cursor-pointer',
                      active ? 'border-veyra shadow-[0_0_30px_-10px_rgba(20,241,149,0.5)]' : 'border-edge hover:border-edge2',
                    )}
                  >
                    <Thumbnail effect={effect} active={active} />
                    <div className="relative bg-panel/90 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold text-ink">{effect.name}</span>
                        {effect.premium ? <PremiumBadge /> : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-dim">{effect.description}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge tone={active ? 'green' : 'neutral'}>{active ? 'Active' : effect.preview}</Badge>
                        {effect.requiresFace ? <span className="text-[10px] text-ink-faint">needs face tracking</span> : null}
                      </div>
                    </div>
                    {locked ? <LockOverlay onClick={() => void select(effect)} /> : null}
                    {active ? (
                      <span className="absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-veyra text-[11px] font-bold text-[#05241a]">✓</span>
                    ) : null}
                  </motion.button>
                );
              })}
          </div>
        </div>
      ))}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-ink-faint">
          <Wand2 size={30} />
          <p className="mt-3 text-sm">No effects in this category yet.</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-edge2 bg-gradient-to-r from-[#120f2b] to-[#0c1f1a] p-4 text-xs leading-relaxed text-ink-dim">
        <span className="font-semibold text-ink">Trust & disclosure:</span> effects that transform or replace a face are clearly
        synthetic. Veyra never markets face-swap or voice cloning for impersonation. Use only media you own or have permission to use.
      </div>
    </motion.div>
  );
}

function Thumbnail({ effect, active }: { effect: EffectDefinition; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = 320;
    const H = 180;
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#0d0d17');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 - 10, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(W / 2 - 40, H / 2 + 22, 80, 44, 18);
    ctx.fill();
    ctx.fillStyle = active ? 'rgba(20,241,149,0.5)' : 'rgba(124,92,255,0.35)';
    const dots = effect.id.length;
    for (let i = 0; i < dots; i++) {
      ctx.beginPath();
      ctx.arc(16 + i * 22, H - 14, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(effect.name, 12, 20);
  }, [effect, active]);
  return <canvas ref={ref} width={320} height={180} className="aspect-[16/9] w-full object-cover" />;
}
