import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, LayoutTemplate, Pencil, Save, Trash2, Zap } from 'lucide-react';
import type { ScenePreset } from '@veyra/shared';
import { usePresets } from '../store/usePresets';
import { useStudio } from '../store/useStudio';
import { useApp } from '../store/useApp';
import { useEntitlement } from '../lib/entitlement';
import { Badge, Button, PremiumBadge, cx } from '../components/ui';
import GlassCard from '../components/GlassCard';

export function Presets() {
  const { presets, add, update, remove, duplicate } = usePresets();
  const studio = useStudio();
  const { toast } = useApp();
  const { consumePremium } = useEntitlement();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const saveCurrent = () => {
    const { effectId, background, person, voiceEffectId, voiceIntensity } = studio;
    if (effectId === 'none' && !background && !person && voiceEffectId === 'none') {
      toast('info', 'Nothing to save yet — add an effect, background, person or voice effect first.');
      return;
    }
    const premium = effectId !== 'none' || (background?.premium ?? false) || (person?.premium ?? false) || voiceEffectId !== 'none';
    const preset: ScenePreset = {
      id: `preset-${Date.now()}`,
      name: `Scene ${presets.length + 1}`,
      effectId,
      person,
      background,
      voiceEffectId,
      voiceIntensity,
      premium,
      createdAt: Date.now(),
    };
    add(preset);
    toast('success', `Preset "${preset.name}" saved.`);
  };

  const activate = async (p: ScenePreset) => {
    if (p.premium) {
      const ok = await consumePremium();
      if (!ok) return;
    }
    studio.setEffect(p.effectId ?? 'none');
    if (p.person) studio.setPerson(p.person);
    studio.setBackground(p.background ?? null);
    studio.setVoiceEffect(p.voiceEffectId ?? 'none');
    studio.setVoiceIntensity(p.voiceIntensity);
    toast('success', `Preset "${p.name}" activated.`);
  };

  const startEdit = (p: ScenePreset) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const commitEdit = (id: string) => {
    if (editName.trim()) update(id, { name: editName.trim() });
    setEditingId(null);
  };

  const handleDuplicate = (id: string) => {
    const newId = duplicate(id);
    if (newId) toast('success', 'Preset duplicated.');
  };

  const handleDelete = (id: string) => {
    remove(id);
    toast('info', 'Preset deleted.');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto"
    >
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Scene Presets</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Combine a person + visual effect + background + voice effect and switch scenes with one click.
          </p>
        </div>
        <Button onClick={saveCurrent}>
          <Save size={15} /> Create Preset
        </Button>
      </div>

      {presets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-edge2 py-16 text-ink-faint">
          <LayoutTemplate size={30} />
          <p className="mt-3 text-sm">No presets yet. Create your first preset to begin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
          {presets.map((p, index) => {
            const editing = editingId === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <GlassCard className="overflow-hidden group">
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-[#12122a] via-[#0d1f24] to-[#1a0d26]">
                    <Zap size={22} className="text-veyra/70" />
                  </div>
                  <div className="p-3.5">
                    {editing ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => commitEdit(p.id)}
                        onKeyDown={(e) => e.key === 'Enter' && commitEdit(p.id)}
                        className="w-full rounded-lg border border-edge bg-panel2 px-2 py-1 text-sm text-ink outline-none focus:border-veyra"
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-display text-sm font-semibold text-ink">{p.name}</span>
                        {p.premium ? <PremiumBadge /> : null}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-ink-dim">
                      <Badge tone="neutral">{p.person?.name ?? 'Person: Default'}</Badge>
                      <Badge tone="neutral">{p.effectId ?? '—'}</Badge>
                      <Badge tone="neutral">{p.background?.name ?? '—'}</Badge>
                      <Badge tone="neutral">{p.voiceEffectId ?? '—'}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <Button size="sm" onClick={() => void activate(p)}>
                        <Zap size={13} /> Activate
                      </Button>
                      <div className="flex gap-1">
                        <IconBtn title="Rename" onClick={() => startEdit(p)}><Pencil size={13} /></IconBtn>
                        <IconBtn title="Duplicate" onClick={() => handleDuplicate(p.id)}><Copy size={13} /></IconBtn>
                        <IconBtn title="Delete" danger onClick={() => handleDelete(p.id)}><Trash2 size={13} /></IconBtn>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cx(
        'flex h-7 w-7 items-center justify-center rounded-lg border border-edge text-ink-faint transition-colors cursor-pointer hover:text-ink',
        danger ? 'hover:border-danger/50 hover:text-danger' : 'hover:border-edge2',
      )}
    >
      {children}
    </button>
  );
}
