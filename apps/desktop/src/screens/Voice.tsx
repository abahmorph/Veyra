import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AudioLines, Mic, MonitorSpeaker } from 'lucide-react';
import { VOICE_EFFECTS } from '@veyra/shared';
import { useStudio } from '../store/useStudio';
import { useApp } from '../store/useApp';
import { ipc } from '../lib/bridge';
import { getPipeline } from '../engine/pipeline';
import { useEntitlement } from '../lib/entitlement';
import { Badge, Button, Card, LockOverlay, PremiumBadge, Select, SectionTitle, Slider, Toggle, cx } from '../components/ui';

export function Voice() {
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
    vmic,
    setVmic,
  } = useStudio();
  const { toast } = useApp();
  const { isLocked, consumePremium } = useEntitlement();

  useEffect(() => {
    void ipc.virtualMic.getStatus().then(setVmic);
  }, [setVmic]);

  const selectEffect = async (id: string) => {
    const effect = VOICE_EFFECTS.find((v) => v.id === id);
    if (!effect) return;
    if (effect.premium) {
      const ok = await consumePremium();
      if (!ok) return;
    }
    setVoiceEffect(id);
  };

  const ensureMic = async () => {
    const res = await ipc.virtualMic.ensure();
    setVmic(res);
    toast(res.status === 'available' ? 'success' : 'warn', res.message ?? (res.status === 'available' ? 'Veyra Microphone created.' : 'Could not create virtual microphone.'));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto"
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Voice</h1>
          <p className="mt-1 text-sm text-ink-dim">Real-time voice effects with local processing and monitoring.</p>
        </div>
        <Select
          className="w-64"
          value={selectedMic}
          onChange={(e) => setMic(e.target.value)}
          aria-label="Microphone"
        >
          {audioDevices.length === 0 ? <option value="">No microphones found</option> : null}
          {audioDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        {/* Effects */}
        <div>
          <SectionTitle hint="Voice effects apply only to your own voice — synthetic voices you do not have rights to are never available.">
            Effects
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {VOICE_EFFECTS.filter((v) => v.id !== 'none').map((effect, index) => {
              const active = voiceEffectId === effect.id;
              const locked = effect.premium && isLocked('alien');
              return (
                <motion.button
                  key={effect.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => void selectEffect(effect.id)}
                  className={cx(
                    'relative overflow-hidden rounded-2xl border p-4 text-left transition-all cursor-pointer',
                    active ? 'border-veyra bg-veyra/5 shadow-[0_0_28px_-12px_rgba(20,241,149,0.6)]' : 'border-edge bg-panel/70 hover:border-edge2',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-semibold capitalize text-ink">{effect.name}</span>
                    {effect.premium ? <PremiumBadge /> : null}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-dim">{effect.description}</p>
                  <div className="mt-3">
                    <Badge tone={active ? 'green' : 'neutral'}>{active ? 'Active' : 'Tap to use'}</Badge>
                  </div>
                  {locked ? (
                    <LockOverlay onClick={() => void selectEffect(effect.id)} />
                  ) : null}
                  {active ? (
                    <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-veyra text-[11px] font-bold text-[#05241a]">✓</span>
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <SectionTitle hint="Live level of your microphone after noise suppression, before effects.">
              Input level
            </SectionTitle>
            <AudioMeter />
          </Card>

          <Card>
            <SectionTitle>Mix</SectionTitle>
            <div className="space-y-3">
              <Slider label="Intensity" value={voiceIntensity} onChange={setVoiceIntensity} />
              <Slider label="Input" value={inputVolume} onChange={setInputVolume} />
              <Slider label="Output" value={outputVolume} onChange={setOutputVolume} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Processing</SectionTitle>
            <div className="space-y-3">
              <Toggle checked={noiseSuppression} onChange={setNoiseSuppression} label="Noise suppression" />
              <Toggle checked={echoCancellation} onChange={setEchoCancellation} label="Echo cancellation" />
              <Toggle checked={monitor} onChange={setMonitor} label="Monitor (hear yourself)" />
            </div>
          </Card>

          <Card>
            <SectionTitle hint="A virtual microphone lets call apps select your processed voice directly.">
              Veyra Microphone
            </SectionTitle>
            <div className="flex items-center justify-between">
              <Badge tone={vmic?.status === 'available' ? 'green' : vmic?.status === 'error' ? 'red' : 'neutral'}>
                {vmic?.status ?? 'checking…'}
              </Badge>
              {vmic?.status !== 'available' ? (
                <Button size="sm" onClick={ensureMic}>
                  <Mic size={14} /> Create
                </Button>
              ) : null}
            </div>
            {vmic?.message && vmic.status !== 'available' ? (
              <p className="mt-2 text-[11px] text-ink-dim">{vmic.message}</p>
            ) : null}
            {vmic?.status === 'available' ? (
              <p className="mt-2 text-[11px] text-ink-dim">
                Select <code className="text-veyra">{vmic.source}</code> as your microphone in the call app to receive your processed voice.
              </p>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center gap-3 text-xs text-ink-dim">
              <AudioLines size={18} className="text-veyra" />
              <span>
                Monitoring runs locally. To use your processed voice elsewhere, point your call app at <code className="text-ink">Veyra Microphone</code> and
                switch this device's output to it.
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-faint">
              <MonitorSpeaker size={14} />
              Echo cancellation requires hardware/OS support and may not be available on all devices.
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function AudioMeter() {
  const running = useStudio((s) => s.running);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setLevel(running ? getPipeline().audioEngine.readLevel() : 0);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const SEGMENTS = 28;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-[3px]" aria-hidden>
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const on = level * SEGMENTS > i;
          const tone = i < SEGMENTS * 0.7 ? 'bg-veyra' : i < SEGMENTS * 0.9 ? 'bg-amber-400' : 'bg-red-400';
          return (
            <span
              key={i}
              className={cx('flex-1 rounded-sm transition-colors duration-75', on ? tone : 'bg-white/10')}
              style={{ height: 10 + (i / SEGMENTS) * 26 }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className={cx('font-medium tabular-nums', level > 0.8 ? 'text-red-400' : level > 0.3 ? 'text-veyra' : 'text-ink-faint')}>
          {Math.round(level * 100)}%
        </span>
        <span className="text-ink-faint">
          {running ? 'Live input level' : 'Start the camera in Studio to see your live level'}
        </span>
      </div>
    </div>
  );
}
