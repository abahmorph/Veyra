import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Film, ImagePlus, ShieldCheck, Trash2, Upload, User, Video, X } from 'lucide-react';
import { BUILTIN_CHARACTERS, type PersonAsset } from '@veyra/shared';
import { useStudio } from '../store/useStudio';
import { useApp } from '../store/useApp';
import { buildPersonAssetFromFile, usePersonActions } from '../lib/person';
import { Button, PremiumBadge, SectionTitle, cx } from './ui';

export function PersonLibrary({ compact }: { compact?: boolean }) {
  const { person, people, addPerson, removePerson } = useStudio();
  const { toast } = useApp();
  const { selectPerson, clearPerson } = usePersonActions();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'photo' | 'video' | null>(null);

  const onFile = async (kind: 'photo' | 'video', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(kind);
    try {
      const asset = await buildPersonAssetFromFile(file);
      addPerson(asset);
      toast('success', `"${asset.name}" added to your people library. Select it to use it as your person.`);
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cards = [
    ...BUILTIN_CHARACTERS.map((c) => ({ ...c, kind: c.kind as PersonAsset['kind'] })),
    ...people,
  ];

  return (
    <div>
      <SectionTitle hint="Only upload photos and videos you own or have permission to use. Uploaded people are stored locally and never leave your device.">
        <span className="flex items-center gap-2">
          <User size={15} className="text-veyra" /> Character / Person
        </span>
      </SectionTitle>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input ref={photoRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/*" className="hidden" onChange={(e) => void onFile('photo', e)} />
        <input ref={videoRef} type="file" accept=".mp4,.webm,video/*" className="hidden" onChange={(e) => void onFile('video', e)} />
        <Button variant="outline" size="sm" onClick={() => photoRef.current?.click()} disabled={busy !== null}>
          {busy === 'photo' ? <Upload size={14} className="animate-pulse" /> : <ImagePlus size={14} />} Upload photo
        </Button>
        <Button variant="outline" size="sm" onClick={() => videoRef.current?.click()} disabled={busy !== null}>
          {busy === 'video' ? <Upload size={14} className="animate-pulse" /> : <Video size={14} />} Upload video
        </Button>
        <button
          onClick={clearPerson}
          className={cx(
            'rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer',
            !person ? 'border-veyra bg-veyra/15 text-veyra' : 'border-edge2 text-ink-dim hover:text-ink',
          )}
        >
          {!person ? <Check size={12} className="inline mr-1" /> : null}
          Default Camera
        </button>
      </div>

      <div className={cx('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4')}>
        {cards.map((p, index) => {
          const active = person?.id === p.id;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={cx(
                'group relative overflow-hidden rounded-2xl border transition-all',
                active ? 'border-veyra shadow-[0_0_30px_-10px_rgba(20,241,149,0.5)]' : 'border-edge hover:border-edge2',
              )}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-[#0a0a14]">
                <PersonPreview person={p} />
                {p.kind === 'video' ? (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-ink-dim backdrop-blur-sm">
                    <Film size={10} /> {formatDuration(p.durationSec)}
                  </div>
                ) : null}
                {active ? (
                  <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-veyra text-[11px] font-bold text-[#05241a]">✓</span>
                ) : null}
                {p.premium ? (
                  <div className="absolute right-2 bottom-2"><PremiumBadge /></div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 bg-panel/90 px-3 py-2">
                <span className="truncate font-display text-xs font-semibold text-ink">{p.name}</span>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => void selectPerson(p)}
                    disabled={p.id === person?.id}
                    className="rounded-lg border border-edge2 px-2 py-1 text-[10px] text-ink-dim transition-colors hover:border-veyra hover:text-veyra disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    Select
                  </button>
                  {p.source === 'uploaded' ? (
                    <button
                      title="Remove"
                      onClick={() => {
                        removePerson(p.id);
                        if (person?.id === p.id) clearPerson();
                        toast('info', `"${p.name}" removed.`);
                      }}
                      className="flex items-center justify-center rounded-lg border border-edge px-2 py-1 text-ink-faint transition-colors hover:border-danger/50 hover:text-danger cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  ) : null}
                </div>
              </div>
              {!p.transformAvailable ? (
                <div className="flex items-start gap-1.5 border-t border-edge bg-[#0c1118] px-3 py-2 text-[10px] leading-relaxed text-ink-faint">
                  <X size={11} className="mt-0.5 shrink-0 text-warn" />
                  <span>{p.transformReason}</span>
                </div>
              ) : null}
            </motion.div>
          );
        })}

        <button
          onClick={() => photoRef.current?.click()}
          className="flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-edge2 text-ink-faint transition-colors hover:border-veyra/50 hover:text-ink cursor-pointer"
        >
          <ImagePlus size={22} />
          <span className="text-xs">Add a person</span>
          <span className="text-[10px]">Photo · Video</span>
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-edge bg-panel/60 px-3 py-2.5 text-[11px] leading-relaxed text-ink-dim">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-veyra" />
        <span>
          Consent matters: use only media you own or have permission to use. Veyra does not allow impersonation of people without permission, and
          processed output is always clearly synthetic.
        </span>
      </div>
    </div>
  );
}

function PersonPreview({ person }: { person: PersonAsset }) {
  if (person.kind === 'character') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0d2b24] to-[#07251c]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-veyra/40 bg-veyra/10">
          <User size={22} className="text-veyra" />
        </div>
      </div>
    );
  }
  if (person.kind === 'video') {
    return person.thumbnail ? (
      <img src={person.thumbnail} alt={person.name} className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-black/60 text-ink-faint"><Film size={18} /></div>
    );
  }
  if (person.src) {
    return <img src={person.src} alt={person.name} className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-black/50 text-xs text-ink-faint">
      <User size={18} />
    </div>
  );
}

export function formatDuration(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
